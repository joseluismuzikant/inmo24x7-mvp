import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { maybeSingleMock, getSupabaseClientMock, botReplyMock } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const queryBuilder: any = {};
  queryBuilder.select = vi.fn(() => queryBuilder);
  queryBuilder.eq = vi.fn(() => queryBuilder);
  queryBuilder.order = vi.fn(() => queryBuilder);
  queryBuilder.limit = vi.fn(() => queryBuilder);
  queryBuilder.maybeSingle = maybeSingle;

  return {
    maybeSingleMock: maybeSingle,
    getSupabaseClientMock: vi.fn(() => ({ from: vi.fn(() => queryBuilder) })),
    botReplyMock: vi.fn(),
  };
});

vi.mock("../../src/lib/supabase.js", () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

vi.mock("../../src/services/botService.js", () => ({
  botReply: botReplyMock,
}));

import { whatsappRouter } from "../../src/routes/whatsapp.ts";

function buildApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(whatsappRouter);
  return app;
}

function signBody(rawBody: string): string {
  const secret = process.env.WA_APP_SECRET as string;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

describe("whatsapp routes", () => {
  beforeEach(() => {
    process.env.WA_VERIFY_TOKEN = "verify-token";
    process.env.WA_APP_SECRET = "app-secret";
    process.env.WA_GRAPH_VERSION = "v22.0";

    maybeSingleMock.mockResolvedValue({
      data: { tenant_id: "tenant-1", access_token: "token-1" },
      error: null,
    });

    botReplyMock.mockResolvedValue({ messages: ["Hola desde bot"] });

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
  });

  it("verifies webhook challenge with valid token", async () => {
    const app = buildApp();

    const res = await request(app)
      .get("/webhooks/whatsapp")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "verify-token",
        "hub.challenge": "12345",
      });

    expect(res.status).toBe(200);
    expect(res.text).toBe("12345");
  });

  it("rejects webhook challenge with invalid token", async () => {
    const app = buildApp();

    const res = await request(app)
      .get("/webhooks/whatsapp")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "12345",
      });

    expect(res.status).toBe(403);
  });

  it("returns 401 when signature is invalid", async () => {
    const app = buildApp();
    const payload = JSON.stringify({ object: "whatsapp_business_account" });

    const res = await request(app)
      .post("/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", "sha256=deadbeef")
      .send(payload);

    expect(res.status).toBe(401);
  });

  it("accepts valid signature and processes text message", async () => {
    const app = buildApp();
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "123456" },
                messages: [{ from: "5491112345678", text: { body: "Hola" } }],
              },
            },
          ],
        },
      ],
    };
    const rawBody = JSON.stringify(payload);

    const res = await request(app)
      .post("/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signBody(rawBody))
      .send(rawBody);

    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(botReplyMock).toHaveBeenCalledWith({
        userId: "5491112345678",
        text: "Hola",
        tenantId: "tenant-1",
        sourceType: "whatsapp",
      });
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v22.0/123456/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
      })
    );
  });
});
