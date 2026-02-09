import { z } from "zod";
import type { SessionState, Operation } from "../types/types";
import type { LeadData } from "./sessionService";

const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string().optional(),
  }),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export function parseToolCalls(message: unknown): ToolCall[] {
  if (!message || typeof message !== "object") return [];
  const msg = message as Record<string, unknown>;
  if (!Array.isArray(msg.tool_calls)) return [];
  
  return msg.tool_calls
    .map((tc) => {
      const result = ToolCallSchema.safeParse(tc);
      return result.success ? result.data : null;
    })
    .filter((tc): tc is ToolCall => tc !== null);
}

export function hasToolCalls(message: unknown): boolean {
  return parseToolCalls(message).length > 0;
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type BuscarPropiedadesArgs = {
  operacion: Operation;
  zona: string;
  presupuestoMax: number;
};

export type DerivarAHumanoArgs = {
  summary: string;
};

export function parseBuscarPropiedadesArgs(args: unknown): BuscarPropiedadesArgs | null {
  if (!args || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  
  if (
    (a.operacion === "venta" || a.operacion === "alquiler") &&
    typeof a.zona === "string" &&
    typeof a.presupuestoMax === "number"
  ) {
    return {
      operacion: a.operacion,
      zona: a.zona,
      presupuestoMax: a.presupuestoMax,
    };
  }
  return null;
}

export function parseDerivarAHumanoArgs(args: unknown): DerivarAHumanoArgs | null {
  if (!args || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  
  if (typeof a.summary === "string") {
    return { summary: a.summary };
  }
  return null;
}
