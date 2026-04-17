import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

const translateChunkWithGemini = async (model, chunk) => {
  const result = await model.generateContent(
    `Translate the following text to Moroccan Darija Arabic. Keep the meaning and be natural. Return ONLY the translated text, nothing else.\n\nText: ${chunk}`
  );
  return result.response.text().trim();
};

export const aiService = {
  translate: async (text) => {
    if (!text || text.trim().length === 0) return '';

    if (!GOOGLE_API_KEY) {
      console.error('Translation unavailable: VITE_GOOGLE_API_KEY is not configured.');
      return text;
    }

    try {
      const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Chunk to stay within model input limits
      const maxChars = 400;
      const chunks = text.match(new RegExp(`.{1,${maxChars}}(\\s|$)`, 'g')) || [text];

      const translatedChunks = await Promise.all(
        chunks.map((chunk) => translateChunkWithGemini(model, chunk.trim()))
      );

      return translatedChunks.join(' ');
    } catch (error) {
      console.error('Gemini translation error:', error);
      return text;
    }
  },
};
