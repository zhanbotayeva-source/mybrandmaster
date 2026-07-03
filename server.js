// =====================================================
// Brandmaster — Express server
// Раздаёт статику из public/, проксирует AI-запросы к Anthropic,
// хранит ответы стратегии в Supabase.
// =====================================================

import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import aiRouter from "./api/ai.js";
import answersRouter from "./api/answers.js";
import authRouter from "./api/auth.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// --- API ---
app.use("/api/ai", aiRouter);
app.use("/api/answers", answersRouter);
app.use("/api/auth", authRouter);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: {
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasSupabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    },
  });
});

// --- статика ---
app.use(express.static(path.join(__dirname, "public")));

// SPA fallback на index.html (для будущих /strategy, /calendar и т.п.)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Brandmaster: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("  ⚠ ANTHROPIC_API_KEY не задан — /api/ai вернёт 500");
  }
  if (!process.env.SUPABASE_URL) {
    console.warn("  ⚠ SUPABASE_URL не задан — /api/answers и /api/auth работают в режиме mock");
  }
});
