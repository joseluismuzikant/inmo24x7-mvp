import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAllLeadsMock, getLeadByIdMock, deleteLeadMock } = vi.hoisted(() => ({
  getAllLeadsMock: vi.fn(),
  getLeadByIdMock: vi.fn(),
  deleteLeadMock: vi.fn(),
}));

vi.mock("../../src/repositories/leadRepo.js", () => ({
  getAllLeads: getAllLeadsMock,
  getLeadById: getLeadByIdMock,
  deleteLead: deleteLeadMock,
}));

import { leadsRouter } from "../../src/routes/leads.ts";

function buildApp(user?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  app.use(leadsRouter);
  return app;
}

describe("leads routes", () => {
  beforeEach(() => {
    getAllLeadsMock.mockResolvedValue([]);
    getLeadByIdMock.mockResolvedValue(null);
    deleteLeadMock.mockResolvedValue(undefined);
  });

  it("lists leads for tenant", async () => {
    const app = buildApp({ tenant_id: "tenant-1" });
    getAllLeadsMock.mockResolvedValue([{ id: 1 }]);

    const res = await request(app).get("/api/leads");

    expect(res.status).toBe(200);
    expect(getAllLeadsMock).toHaveBeenCalledWith("tenant-1");
    expect(res.body).toEqual({ leads: [{ id: 1 }] });
  });

  it("returns 400 on invalid lead id", async () => {
    const app = buildApp({ tenant_id: "tenant-1" });

    const res = await request(app).get("/api/leads/not-a-number");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid");
  });

  it("returns 404 when lead is not found", async () => {
    const app = buildApp({ tenant_id: "tenant-1" });
    getLeadByIdMock.mockResolvedValue(null);

    const res = await request(app).get("/api/leads/123");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Lead not found");
  });

  it("deletes lead successfully", async () => {
    const app = buildApp({ tenant_id: "tenant-1" });

    const res = await request(app).delete("/api/leads/9");

    expect(res.status).toBe(200);
    expect(deleteLeadMock).toHaveBeenCalledWith(9, "tenant-1");
    expect(res.body).toEqual({ success: true });
  });
});
