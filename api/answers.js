// =====================================================
// /api/answers — сохранение и чтение ответов стратегии
// Использует Supabase service-role (без проверки RLS), потому что
// клиент уже прошёл /api/auth и мы доверяем id пользователя из JWT.
//
// На этом этапе — минимальный CRUD на одну таблицу strategy_answers.
// =====================================================

import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// MOCK-режим: пока нет .env c Supabase, держим ответы в памяти процесса.
// Это удобно для локального запуска прототипа без реальной БД.
const memStore = new Map(); // userId -> { blockKey: answer }

// GET /api/answers?userId=...
router.get("/", async (req, res) => {
  const userId = req.query.userId || "demo-user";
  const sb = getSupabase();
  if (!sb) {
    return res.json({ answers: memStore.get(userId) || {} });
  }
  const { data, error } = await sb
    .from("strategy_answers")
    .select("block_key,value")
    .eq("user_id", userId);
  if (error) return res.status(500).json({ error: error.message });
  const answers = Object.fromEntries(data.map((r) => [r.block_key, r.value]));
  res.json({ answers });
});

// PUT /api/answers  { userId, blockKey, value }
router.put("/", async (req, res) => {
  const { userId = "demo-user", blockKey, value } = req.body;
  if (!blockKey) return res.status(400).json({ error: "blockKey is required" });
  const sb = getSupabase();
  if (!sb) {
    const obj = memStore.get(userId) || {};
    obj[blockKey] = value;
    memStore.set(userId, obj);
    return res.json({ ok: true, mock: true });
  }
  const { error } = await sb
    .from("strategy_answers")
    .upsert(
      { user_id: userId, block_key: blockKey, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,block_key" }
    );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
