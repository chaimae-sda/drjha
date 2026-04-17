const HF_API_KEY = import.meta.env.VITE_HF_API_KEY;
const ATLASIA_MODEL = 'atlasia/Terjman-Ultra-v2.0';
const HF_INFERENCE_URL = `https://api-inference.huggingface.co/models/${ATLASIA_MODEL}`;

const DEFAULT_MODEL_WAIT_SECONDS = 20;
const MAX_MODEL_WAIT_MS = 30000;

const translateChunk = async (chunk, headers, retries = 2) => {
  const response = await fetch(HF_INFERENCE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputs: chunk.trim(),
    }),
  });

  // HuggingFace returns 503 while the model is loading (cold start).
  // Wait for the estimated time then retry.
  if (response.status === 503 && retries > 0) {
    const payload = await response.json().catch(() => ({}));
    const waitMs = Math.min((payload.estimated_time || DEFAULT_MODEL_WAIT_SECONDS) * 1000, MAX_MODEL_WAIT_MS);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return translateChunk(chunk, headers, retries - 1);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Atlasia API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Translation pipeline models return an array with translation_text
  if (Array.isArray(data) && data[0]?.translation_text) {
    return data[0].translation_text.trim();
  }
  if (typeof data === 'string') {
    return data.trim();
  }

  throw new Error('Empty or unexpected translation response from Atlasia');
};

export const aiService = {
  translate: async (text) => {
    if (!text || text.trim().length === 0) return '';

    if (!HF_API_KEY) {
      console.error('Translation unavailable: VITE_HF_API_KEY is not configured.');
      return text;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HF_API_KEY}`,
      };

      // Chunk to stay within model input limits
      const maxChars = 400;
      const chunks = text.match(new RegExp(`.{1,${maxChars}}(\\s|$)`, 'g')) || [text];

      const translatedChunks = await Promise.all(
        chunks.map((chunk) => translateChunk(chunk, headers))
      );

      return translatedChunks.join(' ');
    } catch (error) {
      console.error('Atlasia translation error:', error);
      return text;
    }
  },
};
