import { hf, AI_MODELS } from '../config/aiConfig.js';

// ============================================================
// FUNCTION 1: Translate Question to English
// ============================================================
export async function translateToEnglish(text, sourceLanguage = 'auto') {
  try {
    // Try Hugging Face translation
    const result = await hf.translation({
      model: AI_MODELS.translation,
      inputs: text,
      parameters: {
        src_lang: sourceLanguage, // auto-detect or specify
        tgt_lang: 'en_XX' // English
      }
    });
    
    return result.translation_text || text;
    
  } catch (error) {
    console.error('HF Translation error:', error);
    
    // Fallback: LibreTranslate (also FREE, no API key)
    try {
      const response = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        body: JSON.stringify({
          q: text,
          source: 'auto',
          target: 'en',
          format: 'text'
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      return data.translatedText || text;
      
    } catch (fallbackError) {
      console.error('LibreTranslate fallback failed:', fallbackError);
      return text; // Return original if all fails
    }
  }
}

// ============================================================
// FUNCTION 2: Compute AI Answer for Quiz Question
// ============================================================
export async function computeAIAnswer(question) {
  try {
    // Use question-answering model
    const result = await hf.questionAnswering({
      model: AI_MODELS.questionAnswering,
      inputs: {
        question: question,
        context: question // Use question as context for factual Q&A
      }
    });
    
    return result.answer || '[Answer unavailable]';
    
  } catch (error) {
    console.error('AI answer computation error:', error);
    
    // Fallback: Try text generation for general questions
    try {
      const prompt = `Answer this question concisely in 1-2 words: ${question}`;
      
      const result = await hf.textGeneration({
        model: AI_MODELS.textGeneration,
        inputs: prompt,
        parameters: {
          max_new_tokens: 20,
          temperature: 0.1,
          return_full_text: false
        }
      });
      
      // Extract answer (remove prompt from result)
      const answer = result.generated_text.trim().split('\n')[0];
      return answer || '[Answer unavailable]';
      
    } catch (fallbackError) {
      console.error('Fallback AI failed:', fallbackError);
      return '[Answer unavailable]';
    }
  }
}

// ============================================================
// FUNCTION 3: Generate Discussion Question
// ============================================================
export async function generateDiscussionQuestion(topic, questionNumber) {
  try {
    const prompt = `Generate an engaging discussion question #${questionNumber} about "${topic}". The question should be open-ended and thought-provoking. Question:`;
    
    const result = await hf.textGeneration({
      model: AI_MODELS.textGeneration,
      inputs: prompt,
      parameters: {
        max_new_tokens: 100,
        temperature: 0.8, // Higher for creativity
        do_sample: true,
        top_p: 0.95
      }
    });
    
    // Extract just the question
    let question = result.generated_text.replace(prompt, '').trim();
    question = question.split('\n')[0]; // First line only
    
    return question || `Discussion Question ${questionNumber}: What are your thoughts on ${topic}?`;
    
  } catch (error) {
    console.error('Question generation error:', error);
    
    // Fallback: Simple template questions
    const templates = [
      `What are your thoughts on ${topic}?`,
      `How has ${topic} impacted society?`,
      `What's the most interesting aspect of ${topic}?`,
      `Should we change our approach to ${topic}?`,
      `What's the future of ${topic}?`
    ];
    
    const index = (questionNumber - 1) % templates.length;
    return `Discussion Question ${questionNumber}: ${templates[index]}`;
  }
}

// ============================================================
// FUNCTION 4: Judge Debate (Analyze Arguments)
// ============================================================
export async function judgeDebate(topic, teamAStance, teamBStance, teamAArgs, teamBArgs) {
  try {
    const prompt = `You are a debate judge. Analyze these arguments:

Topic: ${topic}

Team A (${teamAStance}):
${teamAArgs.map((arg, i) => `${i+1}. ${arg}`).join('\n')}

Team B (${teamBStance}):
${teamBArgs.map((arg, i) => `${i+1}. ${arg}`).join('\n')}

Based on logic, evidence, and persuasiveness, which team presented better arguments?
Answer with just: "Team A wins" or "Team B wins" or "Draw"`;

    const result = await hf.textGeneration({
      model: AI_MODELS.textGeneration,
      inputs: prompt,
      parameters: {
        max_new_tokens: 150,
        temperature: 0.3, // Lower for consistent judging
        return_full_text: false
      }
    });
    
    const response = result.generated_text.toLowerCase();
    
    // Parse winner
    let winner = 'draw';
    if (response.includes('team a wins') || response.includes('team a presented')) {
      winner = 'teamA';
    } else if (response.includes('team b wins') || response.includes('team b presented')) {
      winner = 'teamB';
    }
    
    // Calculate scores (winner gets 60-70, loser gets 30-40)
    let scoreA, scoreB;
    if (winner === 'teamA') {
      scoreA = 65;
      scoreB = 35;
    } else if (winner === 'teamB') {
      scoreA = 35;
      scoreB = 65;
    } else {
      scoreA = 50;
      scoreB = 50;
    }
    
    return {
      winner,
      reasoning: result.generated_text.trim(),
      scores: { teamA: scoreA, teamB: scoreB }
    };
    
  } catch (error) {
    console.error('Debate judging error:', error);
    
    // Fallback: Count arguments (simple heuristic)
    const scoreA = Math.min(100, teamAArgs.length * 15 + 25);
    const scoreB = Math.min(100, teamBArgs.length * 15 + 25);
    
    return {
      winner: scoreA > scoreB ? 'teamA' : scoreB > scoreA ? 'teamB' : 'draw',
      reasoning: 'Judged based on number of arguments presented',
      scores: { teamA: scoreA, teamB: scoreB }
    };
  }
}

// ============================================================
// FUNCTION 5: Voice-to-Text (Browser-based - 100% FREE!)
// ============================================================
// NOTE: This is done on the FRONTEND, not backend
// Use browser's built-in Web Speech API (no API key needed!)

/*
Frontend implementation (React/Vanilla JS):

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.continuous = false;
recognition.interimResults = false;

recognition.start();

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  console.log('Voice:', transcript);
  // Send transcript to backend
  socket.emit('game:askQuestion', { gameId, userId, question: transcript });
};

recognition.onerror = (error) => {
  console.error('Speech recognition error:', error);
};
*/
export default { translateToEnglish, computeAIAnswer, generateDiscussionQuestion, judgeDebate };