// =====================================================
// /api/auth — заглушка под Supabase Auth
// На прод-этапе клиент логинится напрямую в Supabase через JS SDK,
// и сюда приходит JWT в Authorization-заголовке.
//
// Сейчас оставлены простые эндпоинты, чтобы можно было быстро
// перейти на реальный supabase.auth.signInWithPassword().
// =====================================================

import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST /api/auth/signup  { email, password }
router.post("/signup", async (req, res) => {
  const sb = getSupabase();
  if (!sb) return res.status(200).json({ mock: true, userId: "demo-user" });
  const { email, password } = req.body;
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// POST /api/auth/signin  { email, password }
router.post("/signin", async (req, res) => {
  const sb = getSupabase();
  if (!sb) return res.status(200).json({ mock: true, userId: "demo-user" });
  const { email, password } = req.body;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

export default router;
