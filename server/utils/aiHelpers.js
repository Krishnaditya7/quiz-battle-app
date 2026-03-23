import { hf, AI_MODELS } from '../config/aiConfig.js';



// ============================================================
// FUNCTION 3: Generate Discussion Question
// ============================================================
export async function generateDiscussionQuestion(topic, questionNumber) {
  try {
    const prompt = `Generate an engaging discussion question #${questionNumber} about "${topic}". The question should be open-ended and thought-provoking. Question:`;
    
    const result = await hf.chatCompletion({
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
    console.error('Question generation error:', error.message);
    
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
