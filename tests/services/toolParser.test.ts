import { describe, expect, it } from "vitest";
import {
  hasToolCalls,
  parseBuscarPropiedadesArgs,
  parseDerivarAHumanoArgs,
  parseGuardarContactoArgs,
  parseToolCalls,
  safeJsonParse,
} from "../../src/services/toolParser.ts";

describe("toolParser", () => {
  it("parses valid tool calls and filters invalid ones", () => {
    const parsed = parseToolCalls({
      tool_calls: [
        {
          id: "1",
          type: "function",
          function: { name: "buscarPropiedades", arguments: "{}" },
        },
        {
          id: 2,
          type: "function",
          function: { name: "invalid" },
        },
      ],
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("1");
    expect(hasToolCalls({ tool_calls: parsed })).toBe(true);
    expect(hasToolCalls({ tool_calls: [] })).toBe(false);
  });

  it("parses JSON safely with fallback", () => {
    expect(safeJsonParse("{\"ok\":true}", { ok: false })).toEqual({ ok: true });
    expect(safeJsonParse("not-json", { ok: false })).toEqual({ ok: false });
  });

  it("parses buscar propiedades args", () => {
    const valid = parseBuscarPropiedadesArgs({
      operacion: "alquiler",
      zona: "Palermo",
      presupuestoMax: 500000,
    });
    expect(valid).toEqual({
      operacion: "alquiler",
      zona: "Palermo",
      presupuestoMax: 500000,
    });

    expect(parseBuscarPropiedadesArgs({ operacion: "alquiler", zona: "Palermo" })).toBeNull();
  });

  it("parses derivar a humano args", () => {
    expect(parseDerivarAHumanoArgs({ summary: "Lead listo" })).toEqual({ summary: "Lead listo" });
    expect(parseDerivarAHumanoArgs({ summary: 123 })).toBeNull();
  });

  it("parses guardar contacto args", () => {
    expect(parseGuardarContactoArgs({ nombre: " Ana ", contacto: " 1122 " })).toEqual({
      nombre: "Ana",
      contacto: "1122",
    });
    expect(parseGuardarContactoArgs({ nombre: "", contacto: "" })).toBeNull();
  });
});
