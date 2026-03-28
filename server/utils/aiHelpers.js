// ============================================================
// AI HELPERS
// Only one job now: generate discussion questions for a topic.
// Uses Groq (free tier) instead of Gemini.
// Called by socketGameService.js during discussion game mode.
// Questions are cached in Redis to avoid repeat Groq calls.
// ============================================================

import Groq from 'groq-sdk';
import redis from '../config/redis.js';

// Cache key: topic:question:<normalized-topic>:<questionNumber>
// TTL: 24 hours — questions don't go stale like news does
const QUESTION_TTL = 24 * 60 * 60;

function getQuestionCacheKey(topic, questionNumber) {
  // Normalize topic → lowercase, spaces to hyphens, strip special chars
  const slug = topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `topic:question:${slug}:${questionNumber}`;
}

// ─────────────────────────────────────────────
// Generate a single discussion question for a topic.
// Called in socketGameService when discussion game needs
// the next question (Q1 on match start, Q2+ on leader ready).
// Checks Redis first — hits Groq only on a cache miss.
// ─────────────────────────────────────────────
export async function generateDiscussionQuestion(topic, questionNumber) {
  const cacheKey = getQuestionCacheKey(topic, questionNumber);

  // ── Cache check ──────────────────────────────
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`⚡ Question cache hit — ${cacheKey}`);
      return cached;
    }
  } catch (err) {
    // Redis being down shouldn't block question generation
    console.warn('Redis read failed, proceeding to Groq:', err.message);
  }

  // ── Cache miss → ask Groq ────────────────────
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const prompt = `Generate discussion question #${questionNumber} about "${topic}".
Rules:
- One sentence only
- Open-ended, thought-provoking
- Suitable for students aged 13-22
- No yes/no questions
- Do NOT number it or add any prefix
- Just the question text itself, nothing else`;

    const result = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      max_tokens: 100,
      temperature: 0.8,
    });

    const question = result.choices[0]?.message?.content?.trim();

    // Sanity check — if Groq returned something weird, use fallback
    if (!question || question.length < 10 || question.length > 300) {
      return getFallbackQuestion(topic, questionNumber);
    }

    // ── Cache the fresh question ─────────────────
    try {
      await redis.set(cacheKey, question, 'EX', QUESTION_TTL);
      console.log(`✅ Question cached — ${cacheKey}`);
    } catch (err) {
      console.warn('Redis write failed, question not cached:', err.message);
    }

    return question;

  } catch (err) {
    console.error('Groq question generation error:', err.message);
    return getFallbackQuestion(topic, questionNumber);
  }
}

// ─────────────────────────────────────────────
// Fallback questions when Groq fails/rate limits
// ─────────────────────────────────────────────
function getFallbackQuestion(topic, questionNumber) {
  const templates = [
    `What do you think is the most important aspect of ${topic}?`,
    `How has ${topic} changed the way people think or live?`,
    `What would happen if ${topic} suddenly disappeared from the world?`,
    `Should society change its approach to ${topic}, and why?`,
    `What is the biggest misconception people have about ${topic}?`,
    `How does ${topic} affect people differently depending on their background?`,
    `What would you change about how ${topic} works today?`,
    `If you could teach someone one thing about ${topic}, what would it be?`,
  ];
  const index = (questionNumber - 1) % templates.length;
  return templates[index];
}

export default { generateDiscussionQuestion };