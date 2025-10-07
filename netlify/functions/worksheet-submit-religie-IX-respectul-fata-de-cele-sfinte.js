// netlify/functions/worksheet-submit-religie-IX-respectul-fata-de-cele-sfinte.js

const { GoogleGenAI } = require('@google/genai');
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================
// CONFIGURAȚII
// ============================================

const EXPECTED_ANSWERS = {
  2: {
    question_type: 'proper_name',
    concepts: ['Horeb', 'Sinai'],
    minimum_required: 1,
    reference_in_worksheet:
      "Secțiunea 'Rugul aprins care nu se mistuia': 'Muntele Horeb / Sinai (în Peninsula Sinai, azi Egipt)'",
    points: 2,
  },
  5: {
    question_type: 'list',
    concepts: ['Paștele', 'Cincizecimea', 'Sărbătoarea Corturilor'],
    minimum_required: 2,
    reference_in_worksheet:
      "Secțiunea 'Sfințenia în viața de zi cu zi': 'cele trei mari sărbători de pelerinaj la Ierusalim – Paștele (Pesah), Cincizecimea (Shavuot) și Sărbătoarea Corturilor (Sucot)'",
    points: 2,
  },
  7: {
    question_type: 'proper_name',
    concepts: ['Ierusalim'],
    minimum_required: 1,
    reference_in_worksheet:
      "Secțiunea 'Sfințenia care nu suportă profanarea': 'Iisus la Ierusalim, în Templu, a alungat negustorii și schimbătorii de bani'",
    points: 2,
  },
  9: {
    question_type: 'definition',
    concepts: ['lipsă de respect', 'față de cele sfinte'],
    minimum_required: 2,
    reference_in_worksheet:
      "Dicționar de termeni: 'Blasfemie 🚫 – lipsă de respect gravă, prin vorbe sau fapte, față de ceea ce este sfânt.'",
    correct_definition: 'Lipsă de respect gravă, prin vorbe sau fapte, față de ceea ce este sfânt',
    points: 2,
  },
};

// ============================================
// EVALUARE RĂSPUNSURI SCURTE
// ============================================

async function evaluateShortAnswer(stepData, answer, student) {
  const config = EXPECTED_ANSWERS[stepData.step];

  if (!config) {
    throw new Error(`Nu există configurație pentru pasul ${stepData.step}`);
  }

  const prompt = `Ești profesor de religie și corectezi o fișă de lucru.

CONTEXT: Elevii au fișa cu toate răspunsurile. Aceasta este verificare de înțelegere.

ÎNTREBARE: "${stepData.question}"

UNDE SE GĂSEȘTE RĂSPUNSUL:
${config.reference_in_worksheet}

CONCEPTE NECESARE (trebuie să identifice ${config.minimum_required}):
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

ELEV: ${student.name} ${student.surname}
RĂSPUNS: "${answer}"

REGULI EVALUARE:

1. Verifică dacă ${config.minimum_required}+ concepte sunt prezente
   - Tolerează greșeli de ortografie (2-3 litere)
   - Ignoră toate diacriticele (ă=a, ș=s, ț=t, î=i)
   - Pentru definiții: verifică sensul corect

2. SCORING BINAR:
   ✓ Toate conceptele necesare + sens corect → 2 puncte
   ✗ Lipsesc concepte SAU sens greșit → 0 puncte

3. NU penaliza informații extra, explicații sau răspunsuri mai lungi

4. FEEDBACK (în română):

   Dacă CORECT (score = 2):
   Format:
   [Confirmare specifică - 1 propoziție]

   💡 **Știai că...?**
   [Un fapt interesant DIRECT RELEVANT la conceptul din întrebare - 1-2 propoziții]

   Ghid pentru "Știai că...":
   - Trebuie să fie DIRECT LEGAT de conceptul din întrebare
   - Educațional și fascinant
   - Bazat pe conținutul fișei sau cunoștințe religioase generale
   - Folosește emoji potrivit (💡🔥✨🕊️⛰️🏛️📖)
   - Scurt și captivant

   Dacă INCORECT (score = 0):
   - Ghidează către secțiunea specifică din fișă
   - Citează ce este scris acolo
   - Ajută-l să înțeleagă ce a ratat

5. Dacă ești nesigur → "abstain", score 0

Răspunde DOAR cu JSON în acest format exact:
{
  "is_correct": true sau false,
  "score": 0 sau 2,
  "decision": "correct" sau "incorrect" sau "abstain",
  "concepts_found": ["concept1", "concept2"],
  "concepts_missing": ["concept3"],
  "feedback": "feedback în română, max 600 caractere"
}`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const responseText = response.text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Răspuns invalid de la AI');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[EROARE GEMINI]', error);
    throw error;
  }
}

// ============================================
// EVALUARE GRILE
// ============================================

async function evaluateGrila(stepData, answer, isCorrect, student) {
  const score = isCorrect ? 2 : 0;

  const prompt = `Ești profesor de religie. Elevii au fișa de lucru.

ÎNTREBARE: "${stepData.question}"

OPȚIUNI:
${stepData.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

CORECT: ${stepData.options[stepData.correct_answer]}
ELEVUL A ALES: ${stepData.options[answer]}

ELEV: ${student.name} ${student.surname}

FEEDBACK (în română):

Dacă CORECT:
Format:
[Confirmare specifică - 1 propoziție]

💡 **Știai că...?**
[Un fapt interesant DIRECT RELEVANT - 1-2 propoziții]

Ghid:
- Direct legat de subiectul întrebării
- Educațional și captivant
- Folosește emoji potrivit (💡🔥✨🕊️⛰️🏛️📖)
- Scurt (1-2 propoziții)

Dacă INCORECT:
- Ghidează către secțiunea din fișă (2-3 propoziții)
- Ajută-l să găsească unde este răspunsul în fișă`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const feedback = response.text.trim();

    return {
      score,
      is_correct: isCorrect,
      decision: isCorrect ? 'correct' : 'incorrect',
      feedback,
      concepts_found: isCorrect ? [stepData.options[stepData.correct_answer]] : [],
      concepts_missing: isCorrect ? [] : [stepData.options[stepData.correct_answer]],
    };
  } catch (error) {
    console.error('[EROARE GEMINI]', error);
    throw error;
  }
}

// ============================================
// FLOW PRINCIPAL
// ============================================

async function evaluateStep(stepData, answer, isCorrect, student) {
  if (stepData.type === 'grila') {
    console.log('[GRILĂ]', {
      step: stepData.step,
      student: `${student.name} ${student.surname}`,
      isCorrect,
    });
    return await evaluateGrila(stepData, answer, isCorrect, student);
  }

  console.log('[RĂSPUNS SCURT]', {
    step: stepData.step,
    student: `${student.name} ${student.surname}`,
    answer: answer.substring(0, 50) + '...',
  });

  try {
    const aiResult = await evaluateShortAnswer(stepData, answer, student);

    if (aiResult.decision === 'abstain') {
      console.log('[ABSTAIN]');
      return {
        score: 0,
        is_correct: false,
        decision: 'abstain',
        feedback: 'Nu am putut evalua cu certitudine. Verifică fișa și reformulează mai clar.',
        concepts_found: [],
        concepts_missing: EXPECTED_ANSWERS[stepData.step].concepts,
      };
    }

    console.log('[EVALUAT]', {
      decision: aiResult.decision,
      score: aiResult.score,
      concepts: aiResult.concepts_found,
    });

    return aiResult;
  } catch (error) {
    console.error('[EROARE]', error);
    throw error;
  }
}

// ============================================
// RAPORT FINAL
// ============================================

async function generateFinalReport(student, performanceData) {
  const { totalScore, maxScore, stepResults } = performanceData;
  const percentage = (totalScore / maxScore) * 100;

  const correctSteps = stepResults.filter((s) => s.score > 0).length;
  const incorrectSteps = stepResults.filter((s) => s.score === 0).length;

  const prompt = `Creează un raport personalizat în română.

ELEV: ${student.name} ${student.surname}
PUNCTAJ: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)
Corecte: ${correctSteps} | Greșite: ${incorrectSteps}

SUBIECT: "Respectul față de cele sfinte"

Creează 3 secțiuni scurte (max 450 caractere total):

**Puncte forte:**
[Ce au înțeles bine]

**De îmbunătățit:**
[Care secțiuni să le revizuiască]

**Încurajare:**
[Încurajare personalizată]

Fii specific pentru performanța lor.`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error('[EROARE GEMINI]', error);
    throw error;
  }
}

// ============================================
// HANDLERS
// ============================================

async function handleStepFeedback(requestData) {
  const { stepData, answer, student, isCorrect } = requestData;

  if (!stepData || answer === undefined || !student) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Date incomplete' }),
    };
  }

  try {
    const result = await evaluateStep(stepData, answer, isCorrect, student);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        score: result.score,
        feedback: result.feedback,
        maxPoints: stepData.points,
        isCorrect: result.is_correct,
        decision: result.decision,
        conceptsFound: result.concepts_found,
        conceptsMissing: result.concepts_missing,
        aiGenerated: true,
      }),
    };
  } catch (error) {
    console.error('Eroare evaluare:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: 'Sistemul de evaluare este temporar indisponibil.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}

async function handleFinalReport(requestData) {
  const { student, performanceData } = requestData;

  if (!student || !performanceData) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Date incomplete' }),
    };
  }

  try {
    const finalReport = await generateFinalReport(student, performanceData);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        finalReport,
        aiGenerated: true,
      }),
    };
  } catch (error) {
    console.error('Eroare raport:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: 'Raportul nu poate fi generat momentan.',
      }),
    };
  }
}

// ============================================
// EXPORT
// ============================================

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  let requestData;
  try {
    requestData = JSON.parse(event.body || '{}');
  } catch (parseError) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Date JSON invalide' }),
    };
  }

  const { requestType } = requestData;

  if (requestType === 'ai_feedback') {
    return await handleStepFeedback(requestData);
  } else if (requestType === 'final_report') {
    return await handleFinalReport(requestData);
  } else {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Tip de cerere invalid' }),
    };
  }
};
