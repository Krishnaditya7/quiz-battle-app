import { HfInference } from '@huggingface/inference';

// Initialize Hugging Face client
export const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Free models we'll use
export const AI_MODELS = {
 
  
  // Question ke liye question generation
  textGeneration: 'mistralai/Mistral-7B-Instruct-v0.2',
};