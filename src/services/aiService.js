const MY_MEMORY_API = 'https://api.mymemory.translated.net/get';

/**
 * Darija Heuristic Layer
 * This converts classic Arabic (Fusha) to Moroccan Darija
 */
const darijaDictionary = {
  // Common Questions
  ماذا: 'شنو',
  لماذا: 'علاش',
  كيف: 'كيفاش',
  أين: 'فين',
  متى: 'فوكاش',
  من: 'شكون',

  // Common Nouns/Time
  الآن: 'دابا',
  اليوم: 'ليوم',
  غدا: 'غدا',
  أمس: 'البارح',
  جيد: 'مزيان',
  كثير: 'بزاف',
  قليل: 'شويا',
  نعم: 'آه',
  لا: 'لا',
  هذا: 'هادا',
  هذه: 'هادي',
  هؤلاء: 'هادو',
  جميل: 'زوين',
  صغير: 'صغير',
  كبير: 'كبير',
  بسرعة: 'دغيا',
  ببطء: 'بشوية',

  // Verbs (Simple mapping)
  أريد: 'بغيت',
  أعرف: 'عارف',
  أفعل: 'كانصاوب',
  أذهب: 'غادي',
  أكل: 'كاناكل',
  شرب: 'شرب',
  رأيت: 'شفت',
  قلت: 'قلت',
};

const refineToDarija = (text) => {
  let refined = text;

  // 1. Dictionary Mapping (Whole words)
  Object.keys(darijaDictionary).forEach((classic) => {
    const regex = new RegExp(`\\b${classic}\\b`, 'g');
    refined = refined.replace(regex, darijaDictionary[classic]);
  });

  // 2. Verb Prefixing Heuristic (Simplified)
  refined = refined.replace(/ي([أ-ي]{2,})/g, 'كي$1'); // yi- -> ki-
  refined = refined.replace(/أت([أ-ي]{2,})/g, 'كانت$1'); // at- -> kant-

  // 3. Phonetic Adjustments
  refined = refined.replace(/ة\b/g, 'ا'); // Ending ta-marbuta -> a
  refined = refined.replace(/لم /g, 'ما '); // lam -> ma (negation)

  return refined;
};

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

export const aiService = {
  translate: async (text) => {
    if (!text || text.trim().length === 0) return '';

    // If Gemini key is available, use it for genuine authentic Darija translation
    if (GOOGLE_API_KEY) {
      try {
        const response = await fetch(GEMINI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Traduisez le texte français suivant en dialecte marocain authentique (Darija) écrit en caractères arabes. Ne fournissez QUE la traduction, sans guillemets, sans commentaires et sans texte supplémentaire:\n\n${text}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Gemini API Error');
        }

        const data = await response.json();
        const translatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (translatedContent) {
          return translatedContent.trim();
        }
      } catch (error) {
        console.error('Gemini translation failed, falling back to MyMemory:', error);
      }
    }

    // Fallback to MyMemory heuristic if Gemini fails or is missing
    try {
      const maxChars = 400;
      const chunks = text.match(new RegExp(`.{1,${maxChars}}(\\s|$)`, 'g')) || [text];

      const translatedChunks = await Promise.all(
        chunks.map(async (chunk) => {
          const url = `${MY_MEMORY_API}?q=${encodeURIComponent(chunk)}&langpair=fr|ar`;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Translation request failed with status ${response.status}`);
          }
          const data = await response.json();
          const translatedText = data?.responseData?.translatedText?.trim();

          if (!translatedText) {
            throw new Error('Empty translation response');
          }

          return translatedText;
        })
      );

      const fullArabic = translatedChunks.join(' ');
      return refineToDarija(fullArabic);
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  },
};
