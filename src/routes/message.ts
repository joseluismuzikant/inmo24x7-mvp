import { Router } from "express";
import { z } from "zod";
import { botReply } from "../services/botService.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import type { SourceType } from "../types/types";

export const messageRouter = Router();

const MessageSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1)
});

const DEFAULT_SOURCE_TYPE: SourceType = (process.env.DEFAULT_SOURCE_TYPE as SourceType) || 'web_chat';

/**
 * @swagger
 * /message:
 *   post:
 *     summary: Send a message to the bot
 *     description: Send a user message and receive a bot response
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageRequest'
 *     responses:
 *       200:
 *         description: Bot response received successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Invalid request payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: object
 *       401:
 *         description: Unauthorized - Missing or invalid token
 */
messageRouter.post("/message", async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = MessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const { userId, text } = parsed.data;
    
    // Get tenant and source from auth token
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized - No tenant_id" });
    }
    console.log(`Received message from userId: ${userId}, tenantId: ${tenantId}`);
    const sourceType = req.user?.source_type || DEFAULT_SOURCE_TYPE;

    const reply = await botReply({ 
      userId, 
      text, 
      tenantId, 
      sourceType 
    });

    return res.json(reply);
  } catch (error: any) {
    console.error("❌ Error in /message route:", error);
    return res.status(500).json({ 
      error: "Internal server error", 
      message: error.message 
    });
  }
});
