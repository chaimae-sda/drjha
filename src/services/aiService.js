const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const MISTRAL_KEY = import.meta.env.VITE_MISTRAL_API_KEY || '';
const MY_MEMORY_API = 'https://api.mymemory.translated.net/get';
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';

const parseQuizResponse = (value = '') => {
  const cleaned = String(value || '').replace(/```json|```/gi, '').trim();
  const candidates = [
    cleaned,
    cleaned.match(/\{[\s\S]*\}/)?.[0],
    cleaned.match(/\[[\s\S]*\]/)?.[0],
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (Array.isArray(parsed?.questions)) {
        return parsed.questions;
      }
    } catch {
      // Try the next candidate shape.
    }
  }

  return [];
};

const callMistral = async (prompt, temperature = 0.35) => {
  if (!MISTRAL_KEY) {
    return '';
  }

  const response = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MISTRAL_KEY}` },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature,
    }),
  });

  if (!response.ok) {
    return '';
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
};

const cleanModelText = (value = '') =>
  String(value || '')
    .replace(/^```[\s\S]*?\n/, '')
    .replace(/```$/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();

const hasArabicScript = (value = '') => /[\u0600-\u06FF]/u.test(value);

const isUsableDarijaTranslation = (value = '') => {
  const cleaned = cleanModelText(value);
  if (!cleaned || !hasArabicScript(cleaned)) {
    return false;
  }

  const latinMatches = cleaned.match(/[A-Za-zÀ-ÿ]{3,}/g) || [];
  const latinWordCount = latinMatches.filter((word) => !['drjha', 'darija'].includes(word.toLowerCase())).length;
  return latinWordCount <= 2;
};

const buildDarijaPrompt = (text) => `ترجم النص التالي للدارجة المغربية المكتوبة بالحروف العربية.

القواعد:
- استعمل الدارجة المغربية الطبيعية اللي كيهضرو بها المغاربة، ماشي العربية الفصحى.
- ممنوع الإنجليزية والفرنسية إلا إذا كان الاسم علم أو علامة تجارية.
- ممنوع Markdown والعناوين والشرح. رجع غير الترجمة.
- حافظ على المعنى وتسلسل القصة، وخلي الأسلوب بسيط وواضح.
- استعمل كلمات بحال: شنو، فين، علاش، دابا، بزاف، شوية، بغا، مشى، شاف، قال، كان.

النص:
${text}`;

/**
 * Darija Heuristic Layer
 */
const darijaDictionary = {
  ماذا: 'شنو', علاش: 'علاش', كيف: 'كيفاش', فين: 'فين', فوكاش: 'فوكاش', شكون: 'شكون',
  الآن: 'دابا', اليوم: 'ليوم', غدا: 'غدا', أمس: 'البارح', جيد: 'مزيان', كثير: 'بزاف', قليل: 'شويا', نعم: 'آه', لا: 'لا',
  أريد: 'بغيت', أعرف: 'عارف', أفعل: 'كانصاوب', أذهب: 'غادي', أكل: 'كاناكل', شرب: 'شرب', رأيت: 'شفت', قلت: 'قلت',
};

const refineToDarija = (text) => {
  let refined = text;
  Object.keys(darijaDictionary).forEach((classic) => {
    const regex = new RegExp(`\\b${classic}\\b`, 'g');
    refined = refined.replace(regex, darijaDictionary[classic]);
  });
  refined = refined.replace(/ي([أ-ي]{2,})/g, 'كي$1');
  refined = refined.replace(/أت([أ-ي]{2,})/g, 'كانت$1');
  refined = refined.replace(/ة\b/g, 'ا');
  refined = refined.replace(/لم /g, 'ما ');
  return refined;
};

export const aiService = {
  translate: async (text, targetLang = 'darija') => {
    if (!text || text.trim().length === 0) return '';
    if (targetLang === 'fr') return text;

    if (targetLang === 'darija' && MISTRAL_KEY) {
      try {
        const translated = await callMistral(buildDarijaPrompt(text.slice(0, 12000)), 0.25);
        if (isUsableDarijaTranslation(translated)) {
          return cleanModelText(translated);
        }
      } catch {
        console.warn('Mistral Darija translation failed');
      }
    }

    if (GOOGLE_API_KEY) {
      const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
      for (const modelName of models) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`;
          const langName = targetLang === 'darija' ? 'Moroccan Darija (Arabic script)' : (targetLang === 'en' ? 'English' : 'French');
          const prompt =
            targetLang === 'darija'
              ? buildDarijaPrompt(text.slice(0, 12000))
              : `Translate the following text to ${langName}. Provide ONLY the translation:\n\n${text}`;
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2 }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (targetLang === 'darija') {
              if (isUsableDarijaTranslation(translated)) {
                return cleanModelText(translated);
              }
            } else if (translated) {
              return cleanModelText(translated);
            }
          }
        } catch (e) { console.warn(`Gemini translation failed`, e); }
      }
    }

    if (targetLang === 'darija') {
      return text;
    }

    try {
      const targetCode = targetLang === 'en' ? 'en' : 'ar';
      const url = `${MY_MEMORY_API}?q=${encodeURIComponent(text.slice(0, 500))}&langpair=fr|${targetCode}`;
      const response = await fetch(url);
      const data = await response.json();
      let result = data?.responseData?.translatedText?.trim() || text;
      return targetLang === 'darija' ? refineToDarija(result) : result;
    } catch {
      return text;
    }
  },

  summarize: async (text, targetLang = 'fr') => {
    const prompt =
      targetLang === 'darija'
        ? `لخص النص التالي بالدارجة المغربية المكتوبة بالحروف العربية.

القواعد:
- رجع ملخص قصير وواضح فـ 2 حتى 3 فقرات.
- استعمل دارجة مغربية طبيعية، ماشي العربية الفصحى.
- ممنوع الإنجليزية والفرنسية إلا إذا كان الاسم علم أو علامة تجارية.
- ممنوع Markdown والعناوين والشرح. رجع غير الملخص.

النص:
${text.slice(0, 5000)}`
        : `Résumez le texte suivant de manière simple et pédagogique en 2-3 paragraphes. Utilisez un langage accessible pour les apprenants. Texte: ${text.slice(0, 5000)}`;

    if (targetLang === 'darija') {
      try {
        const mistralSummary = await callMistral(prompt, 0.3);
        if (isUsableDarijaTranslation(mistralSummary)) {
          return cleanModelText(mistralSummary);
        }
      } catch (e) {
        console.error('Mistral Darija summarize error:', e);
      }
    }

    if (GOOGLE_API_KEY) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4 } })
        });
        if (response.ok) {
          const data = await response.json();
          const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (targetLang === 'darija') {
            if (isUsableDarijaTranslation(summary)) {
              return cleanModelText(summary);
            }
          } else if (summary) {
            return cleanModelText(summary);
          }
        }
      } catch (e) {
        console.error('Summarize error:', e);
      }
    }

    try {
      const mistralSummary = await callMistral(prompt, 0.35);
      if (targetLang === 'darija') {
        if (isUsableDarijaTranslation(mistralSummary)) {
          return cleanModelText(mistralSummary);
        }
      } else if (mistralSummary) {
        return cleanModelText(mistralSummary);
      }
    } catch (e) {
      console.error('Mistral summarize error:', e);
    }

    return "Désolé, je n'ai pas pu générer de résumé.";
  },

  generateQuiz: async (textTitle, fullText) => {
    const prompt = `Créez 5 questions de compréhension sur "${textTitle}". Retournez UNIQUEMENT un JSON valide avec cette structure:
{
  "questions": [
    {
      "question": "Question texte",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0
    }
  ]
}
Texte: ${fullText.slice(0, 3000)}`;

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
          const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            const parsed = parseQuizResponse(responseText);
            if (parsed.length > 0) {
              return parsed;
            }
          }
        }
      } catch (e) {
        console.error('Quiz generation error:', e);
      }
    }

    try {
      const mistralResponse = await callMistral(`${prompt}\n\nRépondez seulement avec le JSON demandé, sans markdown.`, 0.35);
      return parseQuizResponse(mistralResponse);
    } catch (e) {
      console.error('Mistral quiz generation error:', e);
    }

    return [];
  },
};
