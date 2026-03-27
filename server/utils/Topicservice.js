// ============================================================
// TOPIC SERVICE
// Fetches trending news via GNews, categorizes + generates
// discussion questions via Groq, caches in Redis for 6 hours.
// Run fetchAndCacheTopics() on server start + every 6 hours.
// ============================================================
import Groq from 'groq-sdk';
import redis from '../config/redis.js';



const REDIS_KEY = 'app:trending_topics';
const TTL_SECONDS = 6 * 60 * 60; // 6 hours

// ─────────────────────────────────────────────
// STEP 1: Fetch top headlines from GNews
// ─────────────────────────────────────────────
async function fetchHeadlines() {
  const url = `https://gnews.io/api/v4/top-headlines?lang=en&country=in&max=20&apikey=${process.env.GNEWS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GNews API error: ${res.status}`);
  const data = await res.json();
  return data.articles.map(a => ({
    title: a.title,
    description: a.description || '',
  }));
}

// ─────────────────────────────────────────────
// STEP 2: Ask Groq to categorize + generate questions
// ─────────────────────────────────────────────
async function categorizeWithGroq(headlines) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const headlineText = headlines
    .map((h, i) => `${i + 1}. ${h.title} — ${h.description}`)
    .join('\n');

  const prompt = `
You are given today's top Indian news headlines.
Group them into 5-7 broad engaging topic categories suitable for a discussion game for students aged 13-22.

Headlines:
${headlineText}

Respond ONLY in this exact JSON format with no extra text, no markdown, no backticks:
{
  "topics": [
    {
      "category": "Bollywood",
      "emoji": "🎬",
      "description": "Latest from Indian cinema",
      "headlines": ["headline 1", "headline 2"]
    }
  ]
}`;

  const result = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.1-8b-instant',
    max_tokens: 600,   // way smaller now — no questions to generate
    temperature: 0.7,
  });

  const text = result.choices[0]?.message?.content?.trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}
// ─────────────────────────────────────────────
// STEP 3: Cache result in Redis
// ─────────────────────────────────────────────
async function cacheTopics(data) {
  await redis.set(REDIS_KEY, JSON.stringify(data), 'EX', TTL_SECONDS);
  console.log(`✅ Trending topics cached — ${data.topics.length} categories`);
}

// ─────────────────────────────────────────────
// MAIN: Fetch → Categorize → Cache
// Called on server boot + by cron every 6 hours
// ─────────────────────────────────────────────
export async function fetchAndCacheTopics() {
  try {
      
    // Check Redis first — if fresh cache exists, don't touch GNews at all
    const cached = await redis.get(REDIS_KEY);
    if (cached) {
      console.log('⚡ Topics already cached — skipping GNews fetch');
      return JSON.parse(cached);
    }

    console.log('🔄 No cache found — fetching from GNews...');
    const headlines = await fetchHeadlines();
    const categorized = await categorizeWithGroq(headlines);
    await cacheTopics(categorized);
    return categorized;
  } catch (err) {
    console.error('❌ Topic fetch failed:', err.message);

    // If cache exists (even expired), keep serving it rather than crashing
    const cached = await redis.get(REDIS_KEY);
    if (cached) {
      console.log('⚠️  Serving stale cached topics as fallback');
      return JSON.parse(cached);
    }

    // Last resort: return static fallback topics
    return getStaticFallback();
  }
}

// ─────────────────────────────────────────────
// GET cached topics (for the API route)
// ─────────────────────────────────────────────
export async function getCachedTopics() {
  const cached = await redis.get(REDIS_KEY);
  if (cached) return JSON.parse(cached);

  // Cache miss — fetch fresh
  return await fetchAndCacheTopics();
}

// ─────────────────────────────────────────────
// Static fallback if everything fails
// ─────────────────────────────────────────────
function getStaticFallback() {
  return {
    topics: [
      {
        category: 'Science & Technology',
        emoji: '🔬',
        description: 'Latest in tech and science',
        headlines: [],
        questions: [
          'How is AI changing the job market in India?',
          'Should India invest more in space exploration?',
          'What are the pros and cons of electric vehicles?',
          'How important is coding education in schools?',
          'What role does technology play in solving climate change?',
          'Should social media platforms be regulated more strictly?',
          'How has the internet changed how we learn?',
          'What technology will most change our lives in 10 years?'
        ],
        debateTopics: [
          'Artificial intelligence will cause more unemployment than it creates',
          'India should prioritize space research over poverty alleviation',
          'Social media does more harm than good to society'
        ]
      },
      {
        category: 'Sports',
        emoji: '🏏',
        description: 'Cricket, football and more',
        headlines: [],
        questions: [
          'Should India focus on sports other than cricket?',
          'How important is the IPL for Indian cricket?',
          'What makes a great sports captain?',
          'Should athletes be allowed to speak on political issues?',
          'How can India improve its Olympics medal count?',
          'What role does mental health play in sports performance?',
          'Should match fixing result in lifetime bans?',
          'How has T20 cricket changed the game?'
        ],
        debateTopics: [
          'Cricket gets too much attention compared to other Indian sports',
          'Athletes are overpaid compared to teachers and doctors',
          'Performance-enhancing drugs should be allowed in sports'
        ]
      },
      {
        category: 'Education',
        emoji: '📚',
        description: 'School, college and learning',
        headlines: [],
        questions: [
          'Should board exams be abolished in India?',
          'How important is English education in India?',
          'What is more valuable — marks or skills?',
          'Should vocational training be mandatory in schools?',
          'How has online learning changed education?',
          'Should private schools be regulated by the government?',
          'What subjects should be added to school curriculum?',
          'How can India reduce exam pressure on students?'
        ],
        debateTopics: [
          'Grades and marks are not an accurate measure of intelligence',
          'Private coaching institutes are destroying the education system',
          'Homework should be banned for school students'
        ]
      }
    ],
    lastUpdated: new Date().toISOString(),
    isStatic: true
  };
}