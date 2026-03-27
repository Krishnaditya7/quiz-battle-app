// ============================================================
// AI HELPERS
// Only one job now: generate discussion questions for a topic.
// Uses Groq (free tier) instead of Gemini.
// Called by socketGameService.js during discussion game mode.
// ============================================================

import Groq from 'groq-sdk';



// ─────────────────────────────────────────────
// Generate a single discussion question for a topic.
// Called in socketGameService when discussion game needs
// the next question (Q1 on match start, Q2+ on leader ready).
// ─────────────────────────────────────────────
export async function generateDiscussionQuestion(topic, questionNumber) {
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