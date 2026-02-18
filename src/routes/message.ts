import { Router } from "express";
import { z } from "zod";
import { botReply } from "../services/botService.js";

export const messageRouter = Router();

const MessageSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1)
});

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
messageRouter.post("/message", async (req, res) => {
  const parsed = MessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { userId, text } = parsed.data;
  const reply = await botReply({ userId, text });

  return res.json(reply);
});
