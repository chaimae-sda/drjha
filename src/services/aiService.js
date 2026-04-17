const HF_API_KEY = import.meta.env.VITE_HF_API_KEY;
const ATLASIA_MODEL = 'atlasia/Terjman-Ultra';
const HF_INFERENCE_URL = `https://api-inference.huggingface.co/models/${ATLASIA_MODEL}`;

const normalizeAtlasiaResponse = (data) => {
  if (Array.isArray(data) && data[0]?.translation_text) {
    return data[0].translation_text.trim();
  }
  if (typeof data === 'string') {
    return data.trim();
  }
  return null;
};

export const aiService = {
  translate: async (text) => {
    if (!text || text.trim().length === 0) return '';

    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (HF_API_KEY) {
        headers['Authorization'] = `Bearer ${HF_API_KEY}`;
      }

      // Chunk to stay within model input limits
      const maxChars = 400;
      const chunks = text.match(new RegExp(`.{1,${maxChars}}(\\s|$)`, 'g')) || [text];

      const translatedChunks = await Promise.all(
        chunks.map(async (chunk) => {
          const response = await fetch(HF_INFERENCE_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ inputs: chunk.trim() }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Atlasia API error ${response.status}: ${errText}`);
          }

          const data = await response.json();
          const translated = normalizeAtlasiaResponse(data);
          if (!translated) {
            throw new Error('Empty translation response from Atlasia');
          }

          return translated;
        })
      );

      return translatedChunks.join(' ');
    } catch (error) {
      console.error('Atlasia translation error:', error);
      return text;
    }
  },
};
