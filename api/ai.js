// =====================================================
// /api/ai — прокси к Anthropic
// Ключ живёт ТОЛЬКО на сервере, никогда не уезжает в браузер.
//
// Поддерживает 4 типа промптов из брифа:
//   POST /api/ai/recommendations  { context }
//   POST /api/ai/ideas            { context, tab: "expert|personal|fun" }
//   POST /api/ai/block-summary    { blockKey, answers }
//   POST /api/ai/suggest-tasks    { context }
//
// Все возвращают строгий JSON.
// =====================================================

import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY не задан в .env");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

// --- helper: вызвать Claude и распарсить JSON-ответ ---
async function callClaude({ system, user, maxTokens = 2000 }) {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content?.[0]?.text || "";
  // Извлекаем JSON из ответа (на случай если Claude обернёт его в ```json…```)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude не вернул JSON: " + text.slice(0, 200));
  return JSON.parse(match[0]);
}

// --- AI Recommendations: 5–6 рекомендаций по стратегии ---
router.post("/recommendations", async (req, res) => {
  try {
    const { context = {} } = req.body;
    const data = await callClaude({
      system:
        "Ты — стратег по личному бренду. Отвечай ТОЛЬКО JSON без комментариев. " +
        "Формат: {\"recommendations\":[{\"label\":\"...\",\"text\":\"...\"}]}. " +
        "Дай 5–6 конкретных рекомендаций.",
      user:
        "Стратегия эксперта:\n" +
        JSON.stringify(context, null, 2) +
        "\n\nДай 5–6 стратегических рекомендаций по контенту, опираясь на эти ответы.",
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Ideas Bank: 8 идей под выбранную вкладку ---
router.post("/ideas", async (req, res) => {
  try {
    const { context = {}, tab = "expert" } = req.body;
    const tabMap = {
      expert: "экспертные (фреймворки, методы, разборы)",
      personal: "личные (история, ценности, путь)",
      fun: "развлекательные (юмор, тренды, провокация)",
    };
    const data = await callClaude({
      system:
        "Ты — продюсер контента для эксперта. Отвечай ТОЛЬКО JSON без комментариев. " +
        'Формат: {"ideas":[{"fmt":"Reels|Карусель|Лонгрид|...","platform":"ig|th|yt|tt","title":"...","description":"..."}]}. ' +
        "Сгенерируй ровно 8 идей.",
      user:
        `Тип идей: ${tabMap[tab] || tab}\n\nКонтекст эксперта:\n` +
        JSON.stringify(context, null, 2) +
        "\n\nИспользуй точные слова клиента, суперсилу и якорные ассоциации из контекста.",
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Block Summary: краткое резюме блока ---
router.post("/block-summary", async (req, res) => {
  try {
    const { blockKey, answers = {} } = req.body;
    const client = getClient();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system:
        "Ты — мягкий и точный консультант по личному бренду. " +
        "Сделай резюме блока стратегии в 4–6 предложений: что человек уже знает о себе и где есть пробелы.",
      messages: [
        {
          role: "user",
          content: `Блок: ${blockKey}\n\nОтветы:\n${JSON.stringify(answers, null, 2)}`,
        },
      ],
    });
    res.json({ summary: msg.content?.[0]?.text || "" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Weekly Tasks: предложить задачи на неделю ---
router.post("/suggest-tasks", async (req, res) => {
  try {
    const { context = {} } = req.body;
    const data = await callClaude({
      system:
        "Ты — наставник по контенту. Отвечай ТОЛЬКО JSON. " +
        'Формат: {"tasks":["...","..."]}. Дай 5 коротких задач на эту неделю, ' +
        "каждая выполнима за 30–90 минут.",
      user:
        "Стратегия эксперта:\n" + JSON.stringify(context, null, 2) +
        "\n\nЗадачи должны опираться на блоки стратегии (позиционирование, аудитория, контент-стратегия).",
      maxTokens: 800,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
