import { searchProperties } from "./propertyService";
import { leadService } from "./leadService";
import { ensureLeadData, getLeadId, setLeadId } from "./sessionService";
import { parseBuscarPropiedadesArgs, parseDerivarAHumanoArgs, parseGuardarContactoArgs } from "./toolParser";
import type { SessionState } from "../types/types";

export interface ToolResult {
  role: "tool";
  tool_call_id: string;
  content: string;
}

export interface HandoffData {
  summary: string;
}

export interface ToolExecutionResult {
  results: ToolResult[];
  handoff?: HandoffData;
}

class ToolExecutor {
  executeBuscarPropiedades(
    args: unknown,
    session: SessionState,
    userId: string
  ): { properties: ReturnType<typeof searchProperties>; leadId?: number } {
    const parsedArgs = parseBuscarPropiedadesArgs(args);
    if (!parsedArgs) {
      return { properties: [] };
    }

    const data = ensureLeadData(session);
    data.operacion = parsedArgs.operacion;
    data.zona = parsedArgs.zona;
    data.presupuestoMax = parsedArgs.presupuestoMax;

    // Search properties
    const properties = searchProperties({
      operacion: parsedArgs.operacion,
      zona: parsedArgs.zona,
      presupuestoMax: parsedArgs.presupuestoMax,
      limit: 3,
    });

    // Create or update lead in background
    const leadId = leadService.loadOrCreateLead(userId, data, getLeadId(session));
    if (leadId) {
      setLeadId(session, leadId);
    }

    return { properties, leadId };
  }

  executeDerivarAHumano(
    args: unknown,
    session: SessionState,
    userId: string
  ): { ok: boolean; leadId?: number; summary: string } {
    const parsedArgs = parseDerivarAHumanoArgs(args);
    const summary = parsedArgs?.summary ?? "Lead interesado";

    const data = ensureLeadData(session);
    const existingLeadId = getLeadId(session);

    // Create or update lead
    const leadId = leadService.loadOrCreateLead(userId, data, existingLeadId);
    if (leadId) {
      setLeadId(session, leadId);
      leadService.updateLeadData(leadId, {}, summary);
    }

    return { ok: true, leadId, summary };
  }

  executeGuardarContacto(
    args: unknown,
    session: SessionState,
    userId: string
  ): { ok: boolean; nombre?: string; contacto?: string; leadId?: number } {
    const parsedArgs = parseGuardarContactoArgs(args);
    if (!parsedArgs) {
      return { ok: false };
    }

    const data = ensureLeadData(session);
    
    // Update session data with contact info
    if (parsedArgs.nombre) {
      data.nombre = parsedArgs.nombre;
    }
    if (parsedArgs.contacto) {
      data.contacto = parsedArgs.contacto;
    }

    // Update lead in database if it exists
    const leadId = getLeadId(session);
    if (leadId) {
      leadService.updateLeadData(leadId, {
        nombre: data.nombre,
        contacto: data.contacto,
      });
    }

    return {
      ok: true,
      nombre: parsedArgs.nombre,
      contacto: parsedArgs.contacto,
      leadId,
    };
  }
}

const toolExecutor = new ToolExecutor();

export function executeToolCalls(
  toolCalls: Array<{ id: string; function: { name: string; arguments?: string } }>,
  session: SessionState,
  userId: string
): ToolExecutionResult {
  const results: ToolResult[] = [];
  let handoff: HandoffData | undefined;

  for (const tc of toolCalls) {
    const name = tc.function.name;
    const argsJson = tc.function.arguments ?? "{}";
    const args = JSON.parse(argsJson);

    switch (name) {
      case "buscarPropiedades": {
        const result = toolExecutor.executeBuscarPropiedades(args, session, userId);
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ results: result.properties }),
        });
        break;
      }

      case "guardarContactoLead": {
        const result = toolExecutor.executeGuardarContacto(args, session, userId);
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ ok: result.ok, nombre: result.nombre, contacto: result.contacto }),
        });
        break;
      }

      case "derivarAHumano": {
        const result = toolExecutor.executeDerivarAHumano(args, session, userId);
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ ok: result.ok, summary: result.summary }),
        });
        handoff = { summary: result.summary };
        break;
      }

      default:
        results.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ error: `Unknown tool: ${name}` }),
        });
    }
  }

  return { results, handoff };
}
