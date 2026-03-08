import { HfInference } from '@huggingface/inference';

// Initialize Hugging Face client
export const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Free models we'll use
export const AI_MODELS = {
  // Translation (FREE, fast)
  translation: 'facebook/mbart-large-50-many-to-many-mmt',
  
  // Text generation (FREE, good quality)
  textGeneration: 'mistralai/Mistral-7B-Instruct-v0.2',
  
  // Alternative: 'google/flan-t5-large' (faster but lower quality)
  
  // Question answering (FREE, accurate)
  questionAnswering: 'deepset/roberta-base-squad2',
  
  // Text-to-speech alternative (if needed)
  // Use browser's built-in Web Speech API instead
};