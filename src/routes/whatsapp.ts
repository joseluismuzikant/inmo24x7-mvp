import crypto from "node:crypto";
import type { Request } from "express";
import { Router } from "express";
import { getSupabaseClient } from "../lib/supabase.js";
import { botReply } from "../services/botService.js";

export const whatsappRouter = Router();

type RawBodyRequest = Request & { rawBody?: Buffer };

type WhatsAppNumberConfig = {
  tenantId: string;
  accessToken: string;
};

function readText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return undefined;
}

function isValidWhatsAppSignature(req: RawBodyRequest): boolean {
  const appSecret = process.env.WA_APP_SECRET;
  const signature = req.header("x-hub-signature-256");

  if (!appSecret || !signature || !req.rawBody) {
    return false;
  }

  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const expected = crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");
  const received = signature.slice("sha256=".length);

  if (!/^[0-9a-fA-F]+$/.test(received)) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function resolveWhatsAppConfig(phoneNumberId: string): Promise<WhatsAppNumberConfig | null> {
  let dbTenantId: string | undefined;
  let dbAccessToken: string | undefined;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("whatsapp_numbers")
      .select("tenant_id, access_token")
      .eq("phone_number_id", phoneNumberId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve whatsapp number: ${error.message}`);
    }

    dbTenantId = readText(data?.tenant_id);
    dbAccessToken = readText(data?.access_token);
  } catch (error) {
    console.warn("⚠️ Could not resolve whatsapp number in Supabase, using env fallback", error);
  }

  const accessToken = dbAccessToken || readText(process.env.WA_ACCESS_TOKEN);
  const tenantId = dbTenantId || readText(process.env.WA_DEFAULT_TENANT_ID) || readText(process.env.DEFAULT_TENANT_ID);

  if (!accessToken || !tenantId) {
    return null;
  }

  return {
    tenantId,
    accessToken,
  };
}

async function sendWhatsAppTextMessage(args: {
  phoneNumberId: string;
  to: string;
  text: string;
  accessToken: string;
}): Promise<void> {
  const graphVersion = readText(process.env.WA_GRAPH_VERSION) || "v22.0";
  const url = `https://graph.facebook.com/${graphVersion}/${args.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: args.to,
      type: "text",
      text: {
        body: args.text,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Graph API error (${response.status}): ${details}`);
  }
}

async function processIncomingMessage(payload: any): Promise<void> {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId = readText(value?.metadata?.phone_number_id);
  const message = value?.messages?.[0];
  
  if (!message) {
    console.log("ℹ️ WhatsApp webhook without message payload (likely status update)");
    return;
  }

  const from = readText(message?.from);
  const text = readText(message?.text?.body);

  console.log("WA phone_number_id:", phoneNumberId, "from:", from);

  if (!phoneNumberId || !from || !text) {
    console.log("ℹ️ WhatsApp non-text or incomplete message ignored");
    return;
  }

  const config = await resolveWhatsAppConfig(phoneNumberId);
  if (!config) {
    console.error("❌ Missing WhatsApp config: tenant_id/access_token not found");
    return;
  }

  const reply = await botReply({
    userId: from,
    text,
    tenantId: config.tenantId,
    sourceType: "whatsapp",
  });

  const messages = reply.messages.filter((msg) => typeof msg === "string" && msg.trim().length > 0);
  for (const botMessage of messages) {
    await sendWhatsAppTextMessage({
      phoneNumberId,
      to: from,
      text: botMessage,
      accessToken: config.accessToken,
    });
  }
}

/**
 * @swagger
 * /webhooks/whatsapp:
 *   get:
 *     summary: Verify WhatsApp webhook
 *     description: Meta calls this endpoint when pressing "Verify and save".
 *     tags: [WhatsApp]
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification mode (`subscribe`).
 *       - in: query
 *         name: hub.verify_token
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification token from Meta.
 *       - in: query
 *         name: hub.challenge
 *         required: true
 *         schema:
 *           type: string
 *         description: Challenge string to echo back.
 *     responses:
 *       200:
 *         description: Verified successfully.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       403:
 *         description: Invalid mode or verification token.
 */
whatsappRouter.get("/webhooks/whatsapp", (req, res) => {
  const hubMode = req.query["hub.mode"];
  const hubVerifyToken = req.query["hub.verify_token"];
  const hubChallenge = req.query["hub.challenge"];

  const mode = Array.isArray(hubMode) ? hubMode[0] : hubMode;
  const verifyToken = Array.isArray(hubVerifyToken) ? hubVerifyToken[0] : hubVerifyToken;
  const challenge = Array.isArray(hubChallenge) ? hubChallenge[0] : hubChallenge;
  const expectedToken = process.env.WA_VERIFY_TOKEN;

  if (mode === "subscribe" && expectedToken && verifyToken === expectedToken) {
    return res.status(200).send(challenge ?? "");
  }

  return res.sendStatus(403);
});

/**
 * @swagger
 * /webhooks/whatsapp:
 *   post:
 *     summary: Receive WhatsApp webhook events
 *     description: Receives incoming events from Meta, validates request signature, and asynchronously processes text messages.
 *     tags: [WhatsApp]
 *     parameters:
 *       - in: header
 *         name: X-Hub-Signature-256
 *         required: true
 *         schema:
 *           type: string
 *         description: Signature header sent by Meta.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Event received.
 *       401:
 *         description: Invalid signature.
 */
whatsappRouter.post("/webhooks/whatsapp", (req: RawBodyRequest, res) => {
  if (!isValidWhatsAppSignature(req)) {
    return res.sendStatus(401);
  }

  res.sendStatus(200);

  void processIncomingMessage(req.body).catch((error) => {
    console.error("❌ Error processing WhatsApp webhook:", error);
  });
});
