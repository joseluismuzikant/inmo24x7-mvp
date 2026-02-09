import { openai } from "./openaiClient";
import { resetSession } from "./sessionStore";
import { searchProperties } from "./propertyService";
import {
  loadSession,
  saveSession,
  ensureLeadData,
  getLeadId,
  setLeadId,
  addMessageToHistory,
  getHistory,
} from "./sessionService";
import { leadService } from "./leadService";
import { hasToolCalls, parseToolCalls } from "./toolParser";
import { executeToolCalls, type ToolResult } from "./toolHandler";
import type { BotReply, ChatMsg, SessionState } from "../types/types";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

const SYSTEM_PROMPT = `
Sos Inmo24x7, asistente virtual de una inmobiliaria.
Objetivo: calificar el lead (operación, zona, presupuesto) y mostrar SOLO propiedades disponibles del listado.
Reglas:
- No inventes propiedades ni precios.
- Hacé una pregunta por mensaje. Máximo 3 preguntas seguidas.
- Si el usuario confirma interés ("sí", "quiero visitar", etc.), ofrecé derivarlo a un asesor.
- Si faltan datos, preguntá lo mínimo necesario.
- Respuestas cortas, claras y en español rioplatense.
`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "buscarPropiedades",
      description:
        "Busca propiedades disponibles según operación, zona y presupuesto máximo. Devuelve hasta 3 opciones.",
      parameters: {
        type: "object",
        properties: {
          operacion: { type: "string", enum: ["venta", "alquiler"] },
          zona: { type: "string" },
          presupuestoMax: { type: "number" },
        },
        required: ["operacion", "zona", "presupuestoMax"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "derivarAHumano",
      description:
        "Marca el lead como listo para asesor humano. Debe incluir un resumen corto del caso.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
        },
        required: ["summary"],
      },
    },
  },
];

function isResetCommand(text: string): boolean {
  return text.trim().toLowerCase() === "/reset";
}

function isOpenAIRateLimitOrQuota(err: any): boolean {
  return err?.status === 429;
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function buildMessages(history: ChatMsg[]) {
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];
}

async function callModel(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  tools?: typeof TOOLS
) {
  try {
    return await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: tools ? "auto" : undefined,
    });
  } catch (err: any) {
    if (isOpenAIRateLimitOrQuota(err)) {
      return null;
    }
    throw err;
  }
}

async function handleToolCalls(
  msg: any,
  session: SessionState,
  userId: string,
  nextHistory: ChatMsg[]
): Promise<BotReply> {
  const toolCalls = parseToolCalls(msg);
  if (toolCalls.length === 0) {
    throw new Error("No valid tool calls found");
  }

  // Execute tool calls
  const { results, handoff } = executeToolCalls(
    toolCalls.map((tc) => ({ id: tc.id, function: tc.function })),
    session,
    userId
  );

  // Persist session state
  saveSession(userId, session);

  // Build messages for second call
  const messagesForSecondCall: any[] = [
    ...buildMessages(nextHistory),
    {
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: msg.tool_calls,
    },
    ...results,
  ];

  // Second call to get final response
  const resp2 = await openai.chat.completions.create({
    model: MODEL,
    messages: messagesForSecondCall,
  });

  const finalMsg = resp2.choices[0]?.message?.content?.trim();
  if (!finalMsg) {
    return { messages: ["Ok. ¿Querés que te muestre opciones?"] };
  }

  // Update history with final response
  addMessageToHistory(session, { role: "assistant", content: finalMsg });
  saveSession(userId, session);

  // Update lead with summary if handoff occurred
  if (handoff?.summary) {
    const leadId = getLeadId(session);
    if (leadId) {
      leadService.updateLeadData(leadId, {}, handoff.summary);
    }
    return {
      messages: [finalMsg],
      handoff: { summary: handoff.summary },
    };
  }

  return { messages: [finalMsg] };
}

async function handleDirectResponse(
  msg: any,
  session: SessionState,
  userId: string,
  nextHistory: ChatMsg[]
): Promise<BotReply> {
  const content = (msg.content ?? "").trim();
  if (!content) {
    return { messages: ["¿Me decís si buscás comprar o alquilar?"] };
  }

  addMessageToHistory(session, { role: "assistant", content });
  saveSession(userId, session);

  return { messages: [content] };
}

function initializeLeadFromDatabase(userId: string, session: SessionState): void {
  const leadId = leadService.loadOrCreateLead(userId, ensureLeadData(session), getLeadId(session));
  if (leadId) {
    setLeadId(session, leadId);
  }
}

export async function botReply(args: { userId: string; text: string }): Promise<BotReply> {
  const { userId, text } = args;

  // Handle reset command
  if (isResetCommand(text)) {
    resetSession(userId);
    return { messages: ["Listo ✅ Reinicié la conversación. ¿Buscás comprar o alquilar?"] };
  }

  // Load session and initialize lead from database
  const session = loadSession(userId);
  ensureLeadData(session);
  initializeLeadFromDatabase(userId, session);

  // Build history
  const history = getHistory(session);
  const nextHistory: ChatMsg[] = [...history, { role: "user", content: text }];
  addMessageToHistory(session, { role: "user", content: text });

  // First call to OpenAI
  const resp = await callModel(buildMessages(nextHistory), TOOLS);
  if (!resp) {
    return {
      messages: [
        "Ahora mismo estoy sin cupo de IA ⚠️ (demo).",
        "¿Buscás comprar o alquilar?",
      ],
    };
  }

  const msg = resp.choices[0]?.message;
  if (!msg) {
    return { messages: ["Tuve un problema 😅 ¿me repetís eso?"] };
  }

  // Handle tool calls or direct response
  if (hasToolCalls(msg)) {
    return handleToolCalls(msg, session, userId, nextHistory);
  } else {
    return handleDirectResponse(msg, session, userId, nextHistory);
  }
}
