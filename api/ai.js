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

function getClient(lang = "ru") {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      lang === "en"
        ? "ANTHROPIC_API_KEY is not configured on the server"
        : "ANTHROPIC_API_KEY не задан на сервере"
    );
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

// --- helper: инструкция по языку ответа (интерфейс двуязычный: ru / en) ---
function langRule(lang) {
  return lang === "en"
    ? " IMPORTANT: write every text value in the JSON in English. Never answer in Russian."
    : " ВАЖНО: пиши все текстовые значения в JSON на русском языке.";
}

// Токены формата — это ключи UI (FMT в index.html), а не текст для перевода.
// Модель обязана вернуть их ровно в этом виде на любом языке интерфейса.
const FMT_TOKENS =
  '"Reels" | "Пост-карусель" | "Пост-фото" | "Сторис" | "Прямой эфир" | ' +
  '"Тред" | "Пост" | "Видео" | "Shorts" | "Короткое видео"';

// --- helper: вызвать Claude и распарсить JSON-ответ ---
async function callClaude({ system, user, maxTokens = 2000, lang = "ru" }) {
  const client = getClient(lang);
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content?.[0]?.text || "";
  // Извлекаем JSON из ответа (на случай если Claude обернёт его в ```json…```)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match)
    throw new Error(
      (lang === "en" ? "Claude did not return JSON: " : "Claude не вернул JSON: ") +
        text.slice(0, 200)
    );
  return JSON.parse(match[0]);
}

// --- AI Recommendations: 5–6 рекомендаций по стратегии ---
router.post("/recommendations", async (req, res) => {
  try {
    const { context = {}, lang = "ru" } = req.body;
    const en = lang === "en";
    const data = await callClaude({
      lang,
      system: en
        ? "You are a personal brand strategist. Reply with JSON ONLY, no commentary. " +
          'Format: {"recommendations":[{"label":"...","text":"..."}]}. ' +
          "Give 5–6 specific recommendations." + langRule(lang)
        : "Ты — стратег по личному бренду. Отвечай ТОЛЬКО JSON без комментариев. " +
          "Формат: {\"recommendations\":[{\"label\":\"...\",\"text\":\"...\"}]}. " +
          "Дай 5–6 конкретных рекомендаций." + langRule(lang),
      user: en
        ? "The expert's strategy:\n" +
          JSON.stringify(context, null, 2) +
          "\n\nGive 5–6 strategic content recommendations based on these answers."
        : "Стратегия эксперта:\n" +
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
    const { context = {}, tab = "expert", lang = "ru" } = req.body;
    const en = lang === "en";
    const tabMap = en
      ? {
          expert: "expert (frameworks, methods, breakdowns)",
          personal: "personal (story, values, journey)",
          fun: "entertaining (humour, trends, provocation)",
        }
      : {
          expert: "экспертные (фреймворки, методы, разборы)",
          personal: "личные (история, ценности, путь)",
          fun: "развлекательные (юмор, тренды, провокация)",
        };
    // "fmt" и "platform" — служебные токены интерфейса, их переводить нельзя
    const shape =
      '{"ideas":[{"fmt":<one of ' + FMT_TOKENS + '>,' +
      '"platform":"Instagram"|"Threads"|"YouTube"|"TikTok",' +
      '"title":"...","description":"..."}]}';
    const tokenRule = en
      ? ' "fmt" and "platform" are interface tokens: return them EXACTLY as listed above, ' +
        "never translated and never invented. Only \"title\" and \"description\" are free text."
      : ' Поля "fmt" и "platform" — служебные токены интерфейса: возвращай их РОВНО в перечисленном виде, ' +
        "не переводи и не придумывай свои. Свободный текст — только в \"title\" и \"description\".";
    const data = await callClaude({
      lang,
      system: en
        ? "You are a content producer for an expert. Reply with JSON ONLY, no commentary. " +
          "Format: " + shape + ". Generate exactly 8 ideas." + tokenRule + langRule(lang)
        : "Ты — продюсер контента для эксперта. Отвечай ТОЛЬКО JSON без комментариев. " +
          "Формат: " + shape + ". Сгенерируй ровно 8 идей." + tokenRule + langRule(lang),
      user: en
        ? `Idea type: ${tabMap[tab] || tab}\n\nExpert context:\n` +
          JSON.stringify(context, null, 2) +
          "\n\nUse the client's exact words, the superpower and the anchor associations from the context."
        : `Тип идей: ${tabMap[tab] || tab}\n\nКонтекст эксперта:\n` +
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
    const { blockKey, answers = {}, lang = "ru" } = req.body;
    const client = getClient(lang);
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system:
        lang === "en"
          ? "You are a gentle and precise personal brand consultant. " +
            "Summarise this strategy block in 4–6 sentences: what the person already knows about themselves and where the gaps are. " +
            "Write the summary in English."
          : "Ты — мягкий и точный консультант по личному бренду. " +
            "Сделай резюме блока стратегии в 4–6 предложений: что человек уже знает о себе и где есть пробелы. " +
            "Пиши резюме на русском языке.",
      messages: [
        {
          role: "user",
          content:
            lang === "en"
              ? `Block: ${blockKey}\n\nAnswers:\n${JSON.stringify(answers, null, 2)}`
              : `Блок: ${blockKey}\n\nОтветы:\n${JSON.stringify(answers, null, 2)}`,
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
    const { context = {}, lang = "ru" } = req.body;
    const en = lang === "en";
    const data = await callClaude({
      lang,
      system: en
        ? "You are a content mentor. Reply with JSON ONLY. " +
          'Format: {"tasks":["...","..."]}. Give 5 short tasks for this week, ' +
          "each doable in 30–90 minutes." + langRule(lang)
        : "Ты — наставник по контенту. Отвечай ТОЛЬКО JSON. " +
          'Формат: {"tasks":["...","..."]}. Дай 5 коротких задач на эту неделю, ' +
          "каждая выполнима за 30–90 минут." + langRule(lang),
      user: en
        ? "The expert's strategy:\n" + JSON.stringify(context, null, 2) +
          "\n\nThe tasks must build on the strategy blocks (positioning, audience, content strategy)."
        : "Стратегия эксперта:\n" + JSON.stringify(context, null, 2) +
          "\n\nЗадачи должны опираться на блоки стратегии (позиционирование, аудитория, контент-стратегия).",
      maxTokens: 800,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
