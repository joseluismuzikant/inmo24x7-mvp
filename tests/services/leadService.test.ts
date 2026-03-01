import { describe, expect, it, vi } from "vitest";

const { createLeadMock, updateLeadMock } = vi.hoisted(() => ({
  createLeadMock: vi.fn(),
  updateLeadMock: vi.fn(),
}));

vi.mock("../../src/repositories/leadRepo.js", () => ({
  createLead: createLeadMock,
  updateLead: updateLeadMock,
  getLeadByVisitorId: vi.fn(),
}));

import { LeadService } from "../../src/services/leadService.ts";

describe("leadService", () => {
  it("returns existing session lead id without creating", async () => {
    const service = new LeadService();

    const leadId = await service.loadOrCreateLead("visitor-1", "tenant-1", "web_chat", { zona: "X" }, 77 as any);

    expect(leadId).toBe(77);
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it("creates lead when minimum data is present", async () => {
    createLeadMock.mockResolvedValue(123);
    const service = new LeadService();

    const leadId = await service.loadOrCreateLead("visitor-1", "tenant-1", "whatsapp", {
      operacion: "alquiler",
      zona: "Palermo",
      presupuestoMax: 300000,
    });

    expect(leadId).toBe(123);
    expect(createLeadMock).toHaveBeenCalledWith({
      tenant_id: "tenant-1",
      visitor_id: "visitor-1",
      source_type: "whatsapp",
      operacion: "alquiler",
      zona: "Palermo",
      presupuesto_max: 300000,
      nombre: undefined,
      contacto: undefined,
    });
  });

  it("skips creation when data is insufficient", async () => {
    const service = new LeadService();

    const leadId = await service.loadOrCreateLead("visitor-1", "tenant-1", "web_chat", {
      operacion: "venta",
    });

    expect(leadId).toBeUndefined();
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it("maps update payload and summary when updating lead", async () => {
    const service = new LeadService();

    await service.updateLeadData(
      9,
      "tenant-1",
      {
        operacion: "venta",
        presupuestoMax: 700000,
        nombre: "Juan",
      },
      "Lead summary"
    );

    expect(updateLeadMock).toHaveBeenCalledWith(9, "tenant-1", {
      operacion: "venta",
      presupuesto_max: 700000,
      nombre: "Juan",
      summary: "Lead summary",
    });
  });
});
