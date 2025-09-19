// netlify/functions/worksheets/submit-test-TEST-securitate.js
// Funcția AI specializată pentru feedback-ul activității de securitate digitală

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Prompturi specifice pentru fiecare tip de pas
const GRILA_PROMPT = (stepData, answer, student, isCorrect) => `
Ești un profesor de TIC specializat în securitate digitală, care predă la clasa XII.
Elevul ${student.name} ${student.surname} a răspuns la o întrebare cu alegere multiplă.

ÎNTREBAREA: "${stepData.question}"
OPȚIUNILE:
${stepData.options.map((opt, i) => `${i}. ${opt}`).join('\n')}

RĂSPUNS CORECT: ${stepData.correct_answer} (${stepData.options[stepData.correct_answer]})
RĂSPUNS ELEV: ${answer} (${stepData.options[answer]})
REZULTAT: ${isCorrect ? 'CORECT' : 'GREȘIT'}

Oferă feedback EDUCATIV și MOTIVANT:
- Dacă e corect: confirmă și adaugă informații suplimentare utile
- Dacă e greșit: explică de ce răspunsul corect este corect și de ce cel ales este greșit
- Folosește un ton prietenos și încurajator
- Adaugă informații practice despre securitate digitală
- Păstrează explicația scurtă (2-3 propoziții)

RĂSPUNDE DOAR CU TEXTUL FEEDBACK-ULUI, FĂRĂ JSON SAU ALTE FORMATĂRI.
`;

const SHORT_PROMPT = (stepData, answer, student) => `
Ești un profesor de TIC specializat în securitate digitală, care predă la clasa XII.
Elevul ${student.name} ${student.surname} a răspuns la o întrebare cu răspuns scurt.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"
PUNCTAJ MAXIM: ${stepData.points} puncte

Evaluează răspunsul și oferă feedback EDUCATIV:

CRITERII DE EVALUARE:
- Corectitudinea informațiilor tehnice
- Completitudinea răspunsului
- Claritatea explicațiilor
- Relevanța pentru securitatea digitală

INSTRUCȚIUNI:
- Acordă punctaj între 0 și ${stepData.points} (poți folosi și 0.5, 1.5, 2.5)
- Pentru răspunsuri parțial corecte, acordă punctaj parțial generos
- Explică ce e bun în răspuns și ce ar putea fi îmbunătățit
- Oferă informații suplimentare relevante
- Ton încurajator și educativ
- Feedback de 3-4 propoziții

RĂSPUNDE ÎN FORMATUL:
PUNCTAJ: [numărul de puncte]
FEEDBACK: [textul feedback-ului]
`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { stepData, answer, student, isCorrect, requestType } = JSON.parse(event.body || '{}');

    // Verifică că este o cerere pentru AI feedback
    if (requestType !== 'ai_feedback') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request type' }),
      };
    }

    let feedback = '';
    let score = 0;

    if (stepData.type === 'grila') {
      // Procesează răspunsurile cu grile
      score = isCorrect ? stepData.points : 0;

      const prompt = GRILA_PROMPT(stepData, answer, student, isCorrect);

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              'Ești un profesor de TIC prietenos și competent. Oferă feedback educativ scurt și util pentru elevii de clasa XII.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      feedback = aiResponse.choices?.[0]?.message?.content?.trim() || 'Feedback indisponibil.';
    } else if (stepData.type === 'short') {
      // Procesează răspunsurile scurte
      const prompt = SHORT_PROMPT(stepData, answer, student);

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content:
              'Ești un profesor de TIC care evaluează răspunsuri despre securitate digitală. Fii generos cu punctajele pentru răspunsuri parțial corecte și oferă feedback constructiv.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const aiText =
        aiResponse.choices?.[0]?.message?.content?.trim() ||
        'PUNCTAJ: 0\nFEEDBACK: Feedback indisponibil.';

      // Extrage punctajul și feedback-ul din răspunsul AI
      const punctajMatch = aiText.match(/PUNCTAJ:\s*([0-9.]+)/i);
      const feedbackMatch = aiText.match(/FEEDBACK:\s*(.+)/is);

      if (punctajMatch) {
        score = Math.min(parseFloat(punctajMatch[1]), stepData.points);
      }

      if (feedbackMatch) {
        feedback = feedbackMatch[1].trim();
      } else {
        feedback = aiText; // Fallback la tot textul dacă nu găsește pattern-ul
      }
    }

    // Asigură-te că scorul este în limitele corecte
    score = Math.max(0, Math.min(score, stepData.points));
    score = Math.round(score * 2) / 2; // Rotunjește la 0.5

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        feedback: feedback,
        score: score,
        maxPoints: stepData.points,
      }),
    };
  } catch (error) {
    console.error('Eroare AI feedback securitate:', error);

    // Fallback în caz de eroare
    let fallbackScore = 0;
    let fallbackFeedback = 'Feedback indisponibil momentan.';

    try {
      const { stepData, isCorrect } = JSON.parse(event.body || '{}');

      if (stepData?.type === 'grila') {
        fallbackScore = isCorrect ? stepData.points : 0;
        fallbackFeedback = isCorrect
          ? 'Răspuns corect! Continuă să studiezi conceptele de securitate.'
          : 'Răspuns incorect. Revizuiește conceptele despre securitatea digitală.';
      } else if (stepData?.type === 'short') {
        fallbackScore = Math.round(stepData.points * 0.5); // 50% din punctaj
        fallbackFeedback =
          'Răspunsul tău a fost înregistrat. Feedback-ul detaliat va fi disponibil curând.';
      }
    } catch (parseError) {
      // Ignore parse errors în fallback
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        feedback: fallbackFeedback,
        score: fallbackScore,
        maxPoints: stepData?.points || 1,
      }),
    };
  }
};
