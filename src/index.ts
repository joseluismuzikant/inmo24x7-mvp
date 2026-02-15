import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { messageRouter } from "./routes/message.js";
import { leadsRouter } from "./routes/leads.js";
import { adminRouter } from "./routes/admin";
import { authMiddleware } from "./middleware/auth.js";

import path from "node:path";

import OpenAI from "openai";


const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(process.cwd(), "src", "public")));

// Health endpoint - unprotected
app.get("/health", (_req, res) => res.json({ ok: true, service: "inmo24x7-mvp" }));

// Auth middleware - protects all routes below
app.use(authMiddleware);

// Protected routes
app.use(messageRouter);
app.use(leadsRouter);
app.use(adminRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`✅ Inmo24x7 MVP running on http://localhost:${port}`);
});
