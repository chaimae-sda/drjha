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

const generateMockQuiz = (title) => {
  return [
    {
      questionTextFr: `De quoi parle principalement "${title}" ?`,
      questionTextDarija: `علاش كيهضر هاد النص "${title}" بشكل أساسي؟`,
      optionsFr: ["D'une histoire importante", "D'un sujet technique", "D'une information générale"],
      optionsDarija: ["على قصة مهمة", "على موضوع تقني", "على معلومة عامة"],
      correctIndex: 0,
      xpReward: 20
    },
    {
      questionTextFr: `Quel est le ton de "${title}" ?`,
      questionTextDarija: `كيفاش دايرة اللهجة ديال "${title}"؟`,
      optionsFr: ["Informatif", "Amusant", "Sérieux"],
      optionsDarija: ["إخباري", "ممتع", "جدي"],
      correctIndex: 0,
      xpReward: 20
    },
    {
      questionTextFr: `Est-ce que "${title}" est facile à comprendre ?`,
      questionTextDarija: `واش "${title}" ساهل يتفهم؟`,
      optionsFr: ["Oui, très clair", "C'est un peu difficile", "C'est complexe"],
      optionsDarija: ["آه، واضح بزاف", "شوية صعيب", "معقد"],
      correctIndex: 0,
      xpReward: 20
    }
  ];
};

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';

export const aiService = {
  translate: async (text, targetLang = 'darija') => {
    if (!text || text.trim().length === 0) return '';
    if (targetLang === 'fr') return text;

    const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
    const MISTRAL_KEY = import.meta.env.VITE_MISTRAL_API_KEY;

    if (GOOGLE_API_KEY) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const langName = targetLang === 'darija' ? 'Moroccan Darija (Arabic script)' : (targetLang === 'en' ? 'English' : 'French');
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Translate the following text to ${langName}. Provide ONLY the translation:\n\n${text}` }] }],
            generationConfig: { temperature: 0.2 }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (translated) return translated.trim();
        }
      } catch (e) { console.warn('Gemini translation failed'); }
    }

    if (targetLang === 'darija' && MISTRAL_KEY) {
      try {
        const response = await fetch(MISTRAL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MISTRAL_KEY}`,
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [{ role: 'user', content: `Traduisez le texte français suivant en Darija authentique (caractères arabes). Uniquement la traduction:\n\n${text}` }],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.choices?.[0]?.message?.content?.trim();
        }
      } catch (e) {}
    }

    try {
      const targetCode = targetLang === 'en' ? 'en' : 'ar';
      const url = `${MY_MEMORY_API}?q=${encodeURIComponent(text.slice(0, 500))}&langpair=fr|${targetCode}`;
      const response = await fetch(url);
      const data = await response.json();
      let result = data?.responseData?.translatedText?.trim() || text;
      return targetLang === 'darija' ? refineToDarija(result) : result;
    } catch (e) { return text; }
  },

  summarize: async (text, targetLang = 'fr') => {
    const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
    const MISTRAL_KEY = import.meta.env.VITE_MISTRAL_API_KEY;
    
    const prompt = `Résumez le texte suivant de manière simple et pédagogique. 
IMPORTANT: Ne commencez PAS par "Résumé pour un enfant..." ou toute phrase similaire. Commencez directement par le résumé.
Fournissez le résumé en deux parties:
- D'abord en Français.
- Ensuite en Darija Marocain (caractères arabes).
Texte: ${text.slice(0, 5000)}`;

    if (GOOGLE_API_KEY) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4 }
          })
        });

        if (response.ok) {
          const data = await response.json();
          return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        }
      } catch (e) {}
    }

    if (MISTRAL_KEY) {
      try {
        const response = await fetch(MISTRAL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MISTRAL_KEY}`
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          })
        });

        if (response.ok) {
          const data = await response.json();
          return data.choices?.[0]?.message?.content?.trim();
        }
      } catch (e) {}
    }

    return "Désolé, je n'ai pas pu générer de résumé pour le moment.";
  },

  generateQuiz: async (textTitle, fullText) => {
    const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
    const MISTRAL_KEY = import.meta.env.VITE_MISTRAL_API_KEY;
    
    const prompt = `Créez 5 questions de compréhension sur "${textTitle}".
Texte: ${fullText.slice(0, 4000)}

Renvoyez uniquement un tableau JSON:
[{
  "questionTextFr": "...",
  "questionTextDarija": "...",
  "optionsFr": ["...", "...", "..."],
  "optionsDarija": ["...", "...", "..."],
  "correctIndex": 0,
  "xpReward": 30
}]`;

    if (GOOGLE_API_KEY) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt + "\nFormat: JSON pur uniquement." }] }],
            generationConfig: { temperature: 0.4, responseMimeType: "application/json" }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            const parsed = JSON.parse(responseText.replace(/```json|```/gi, '').trim());
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        }
      } catch (e) {}
    }

    if (MISTRAL_KEY) {
      try {
        const response = await fetch(MISTRAL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MISTRAL_KEY}`
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [{ role: 'user', content: prompt + "\nIMPORTANT: Répondez UNIQUEMENT avec le JSON." }],
            response_format: { type: 'json_object' }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          const parsed = JSON.parse(content);
          const questions = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.quiz);
          if (Array.isArray(questions)) return questions;
        }
      } catch (e) {}
    }

    return generateMockQuiz(textTitle);
  },
};
