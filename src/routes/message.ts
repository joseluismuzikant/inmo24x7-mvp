import { Router } from "express";
import { z } from "zod";
import { botReply } from "../services/botService.js";

export const messageRouter = Router();

const MessageSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1)
});

messageRouter.post("/message", async (req, res) => {
  const parsed = MessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { userId, text } = parsed.data;
  const reply = await botReply({ userId, text });

  return res.json(reply);
});
