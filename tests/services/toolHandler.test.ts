import { describe, expect, it, vi } from "vitest";

const { searchPropertiesMock, leadServiceMock } = vi.hoisted(() => ({
  searchPropertiesMock: vi.fn(),
  leadServiceMock: {
    loadOrCreateLead: vi.fn(),
    updateLeadData: vi.fn(),
  },
}));

vi.mock("../../src/services/propertyService.js", () => ({
  searchProperties: searchPropertiesMock,
}));

vi.mock("../../src/services/leadService.js", () => ({
  leadService: leadServiceMock,
}));

import { executeToolCalls } from "../../src/services/toolHandler.ts";

describe("toolHandler", () => {
  it("executes buscarPropiedades tool and returns tool payload", async () => {
    searchPropertiesMock.mockResolvedValue({
      results: [
        {
          id: "p1",
          titulo: "Depto",
          precio: 100,
          zona: "Palermo",
          link: "https://example.com",
          tipo: "departamento",
          ambientes: 2,
        },
      ],
      userBudget: 200,
      propertiesWithinBudget: 1,
    });
    leadServiceMock.loadOrCreateLead.mockResolvedValue(44);

    const session: any = { step: "start" };
    const result = await executeToolCalls(
      [
        {
          id: "tc-1",
          function: {
            name: "buscarPropiedades",
            arguments: JSON.stringify({ operacion: "alquiler", zona: "Palermo", presupuestoMax: 200 }),
          },
        },
      ],
      session,
      "visitor-1",
      "tenant-1",
      "whatsapp"
    );

    expect(result.results).toHaveLength(1);
    expect(result.handoff).toBeUndefined();
    const payload = JSON.parse(result.results[0].content);
    expect(payload.totalProperties).toBe(1);
    expect(session.leadId).toBe(44);
  });

  it("executes derivarAHumano and returns handoff data", async () => {
    leadServiceMock.loadOrCreateLead.mockResolvedValue(99);

    const session: any = {
      step: "start",
      data: { zona: "Belgrano" },
    };

    const summary = "Lead Juan Perez quiere visitar depto en Belgrano, contacto: 11223344";

    const result = await executeToolCalls(
      [
        {
          id: "tc-2",
          function: {
            name: "derivarAHumano",
            arguments: JSON.stringify({ summary }),
          },
        },
      ],
      session,
      "visitor-2",
      "tenant-2",
      "whatsapp"
    );

    expect(result.handoff).toEqual({ summary });
    expect(leadServiceMock.updateLeadData).toHaveBeenCalledWith(
      99,
      "tenant-2",
      {
        nombre: "Juan Perez",
        contacto: "11223344",
        zona: "Belgrano",
      },
      summary
    );
  });

  it("returns unknown tool error for unsupported tools", async () => {
    const session: any = { step: "start" };

    const result = await executeToolCalls(
      [
        {
          id: "tc-3",
          function: {
            name: "toolThatDoesNotExist",
            arguments: "{}",
          },
        },
      ],
      session,
      "visitor-3",
      "tenant-3",
      "web_chat"
    );

    const payload = JSON.parse(result.results[0].content);
    expect(payload.error).toContain("Unknown tool");
  });
});
