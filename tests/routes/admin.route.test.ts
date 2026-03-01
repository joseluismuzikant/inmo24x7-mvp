import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listLeadsMock, getLeadByIdMock } = vi.hoisted(() => ({
  listLeadsMock: vi.fn(),
  getLeadByIdMock: vi.fn(),
}));

vi.mock("../../src/repositories/leadRepo.js", () => ({
  listLeads: listLeadsMock,
  getLeadById: getLeadByIdMock,
}));

import { adminRouter } from "../../src/routes/admin.ts";

function buildApp(user?: Record<string, unknown>) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  app.use(adminRouter);
  return app;
}

describe("admin routes", () => {
  beforeEach(() => {
    listLeadsMock.mockResolvedValue([]);
    getLeadByIdMock.mockResolvedValue(null);
  });

  it("returns 401 when tenant id is missing", async () => {
    const app = buildApp({});

    const res = await request(app).get("/admin/leads");

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Unauthorized");
  });

  it("renders leads list HTML", async () => {
    const app = buildApp({ tenant_id: "tenant-1" });
    listLeadsMock.mockResolvedValue([
      {
        id: 10,
        created_at: "2025-01-01T10:00:00Z",
        operacion: "alquiler",
        zona: "Palermo",
        presupuesto_max: 500000,
        nombre: "Ana",
        contacto: "11223344",
        summary: "Lead listo",
      },
    ]);

    const res = await request(app).get("/admin/leads");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Leads capturados");
    expect(res.text).toContain("/admin/leads/10");
  });

  it("returns 400 for invalid lead detail id", async () => {
    const app = buildApp({ tenant_id: "tenant-1" });

    const res = await request(app).get("/admin/leads/abc");

    expect(res.status).toBe(400);
    expect(res.text).toContain("ID inválido");
  });

  it("returns 404 when lead detail is missing", async () => {
    const app = buildApp({ tenant_id: "tenant-1" });
    getLeadByIdMock.mockResolvedValue(null);

    const res = await request(app).get("/admin/leads/99");

    expect(res.status).toBe(404);
    expect(res.text).toContain("Lead no encontrado");
  });
});
