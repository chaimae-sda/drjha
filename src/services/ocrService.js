import { aiService } from './aiService';

const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'pixtral-large-latest';

const normalizeText = (text) =>
  text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const buildTitle = (text) => {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return 'Document Scanne';
  }

  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
};

let pdfModulePromise;

const loadPdfJs = async () => {
  if (!pdfModulePromise) {
    pdfModulePromise = import('pdfjs-dist').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      return pdfjsLib;
    });
  }

  return pdfModulePromise;
};

const recognizeImageWithMistral = async (base64Image, mimeType = 'image/jpeg') => {
  if (!MISTRAL_API_KEY) {
    throw new Error('Clé API Mistral manquante (VITE_MISTRAL_API_KEY not configured).');
  }

  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            {
              type: 'text',
              text: 'Extrais tout le texte présent dans cette image. Retourne uniquement le texte extrait, sans aucun commentaire ni formatage supplémentaire.',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Mistral API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return normalizeText(data.choices?.[0]?.message?.content || '');
};

const recognizeImage = async (imageSource, mimeType = 'image/jpeg') => {
  // imageSource may be a data-URL (from PDF canvas rendering) or a plain base64 string
  if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
    const [header, b64] = imageSource.split(',');
    return recognizeImageWithMistral(b64, header.split(':')[1].split(';')[0]);
  }

  return recognizeImageWithMistral(imageSource, mimeType);
};

const translateToDarija = async (text) => {
  if (!text) {
    return '';
  }

  try {
    return await aiService.translate(text);
  } catch (error) {
    console.error('Translation fallback error:', error);
    return text;
  }
};

const scanTextContent = async (originalText) => {
  const safeOriginal = normalizeText(originalText);
  const darijaText = await translateToDarija(safeOriginal);

  return {
    title: buildTitle(safeOriginal),
    originalText: safeOriginal,
    darijaText: normalizeText(darijaText),
  };
};

const renderPdfPageToImage = async (page) => {
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.9);
};

export const ocrService = {
  scanImage: async (base64Image, mimeType = 'image/jpeg') => {
    try {
      const originalText = await recognizeImage(base64Image, mimeType);

      if (!originalText) {
        throw new Error('Aucun texte detecte dans cette image.');
      }

      return await scanTextContent(originalText);
    } catch (error) {
      console.error('OCR Service Error:', error);
      throw error;
    }
  },

  scanPDF: async (file) => {
    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageTexts = [];

      for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const extractedText = normalizeText(
          textContent.items.map((item) => item.str || '').join(' ')
        );

        if (extractedText) {
          pageTexts.push(extractedText);
          continue;
        }

        const pageImage = await renderPdfPageToImage(page);
        const ocrText = await recognizeImage(pageImage);
        if (ocrText) {
          pageTexts.push(ocrText);
        }
      }

      const originalText = normalizeText(pageTexts.join('\n\n'));

      if (!originalText) {
        throw new Error('Aucun texte detecte dans ce PDF.');
      }

      return await scanTextContent(originalText);
    } catch (error) {
      console.error('PDF Scan Error:', error);
      throw error;
    }
  },
};
