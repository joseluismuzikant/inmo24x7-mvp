import express from "express";
import dotenv from "dotenv";
import { messageRouter } from "./routes/message.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "inmo24x7-mvp" }));
app.use(messageRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`✅ Inmo24x7 MVP running on http://localhost:${port}`);
});
