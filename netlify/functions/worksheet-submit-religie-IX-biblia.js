// netlify/functions/worksheet-submit-religie-IX-biblia.js

const { GoogleGenAI } = require('@google/genai');
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ==============================
// CONFIGURAȚII RĂSPUNSURI AȘTEPTATE (BIBLIA – CARTEA CĂRȚILOR)
// Structură și stil aliniate la fișa "adorarea-lui-dumnezeu"
// ==============================
const EXPECTED_ANSWERS = {
  1: {
    question_type: 'date_and_person',
    concepts: ['Moise', '1400 î.Hr.', '1400', 'Facerea', 'Geneza'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Cum a fost scrisă": "Prima carte a fost scrisă de Moise în jurul anului 1400 î.Hr. – Facerea (Geneza)."',
    points: 1,
    allow_partial: false, // Trebuie cel puțin Moise SAU data
  },
  2: {
    question_type: 'list',
    concepts: [
      'Moise',
      'începutul lumii',
      'începutul',
      'creația',
      'Adam',
      'Eva',
      'potopul',
      'Noe',
      'Avraam',
      'Abraham',
    ],
    minimum_required: 2, // ideal: Moise + cel puțin 1 eveniment
    reference_in_worksheet:
      'Secțiunea "Povestea Bibliei": "Moise a început să scrie primele texte. Prima carte se numește Facerea (Geneza) și povestește începutul lumii, viața lui Adam și Eva, potopul lui Noe și alegerea lui Avraam."',
    points: 1,
    allow_partial: true, // 0.5 dacă are cel puțin 1 concept dar sub prag
  },
  3: {
    question_type: 'proper_name_or_date',
    concepts: ['Ioan', 'Apostolul Ioan', 'apostolul Ioan', 'Apocalipsa', '95 d.Hr.', '95'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Povestea Bibliei" și "Cum a fost scrisă": "Ultima carte, Apocalipsa, scrisă de Ioan în jurul anului 95 d.Hr." și "Ultima carte a fost scrisă de apostolul Ioan în jurul anului 95 d.Hr. – Apocalipsa."',
    points: 1,
    allow_partial: false,
  },
  4: {
    question_type: 'proper_name',
    concepts: ['P52', 'Papirusul P52', 'papirus P52', '120 d.Hr.', '120'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Transmiterea": "Cel mai vechi fragment al Noului Testament este Papirusul P52, datat în jurul anului 120 d.Hr."',
    points: 1,
    allow_partial: false,
  },
  5: {
    question_type: 'list',
    concepts: [
      'papirus',
      'papirusul',
      'pergament',
      'pergamentul',
      'plantă',
      'Nil',
      'piele',
      'animal',
    ],
    minimum_required: 2, // Cel puțin 2 dintre: papirus/pergament/contextul lor
    reference_in_worksheet:
      'Secțiunea "Materialul": "s-a folosit papirusul, o „hârtie" obținută dintr-o plantă care creștea la Nil. Mai târziu s-a folosit și pergamentul (piele de animal)."',
    points: 1,
    allow_partial: true, // 0.5 dacă are doar 1 concept
  },
  6: {
    question_type: 'list',
    concepts: [
      'ebraică',
      'ebraica',
      'evreu',
      'aramaică',
      'aramaica',
      'greacă',
      'greaca',
      'koiné',
      'koine',
    ],
    minimum_required: 2, // Cel puțin 2 limbi
    reference_in_worksheet:
      'Secțiunea "Limbile originale": "Ebraica – limba poporului Israel, în care s-a scris majoritatea Vechiului Testament. Aramaica – limbă vorbită în Orientul Apropiat, prezentă în câteva fragmente. Greaca koiné – limba comună a secolului I, în care a fost scris Noul Testament."',
    points: 1,
    allow_partial: true, // 0.5 dacă are doar 1 limbă corectă
  },
  8: {
    question_type: 'proper_name_and_date',
    concepts: ['București', 'Bucuresti', '1688'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Traducerea": "Prima traducere completă în română a fost tipărită la București, în 1688."',
    points: 1,
    allow_partial: true, // 0.5 dacă are doar București SAU doar 1688
  },
  9: {
    question_type: 'open_creative',
    concepts: [], // Deschis: orice personaj/poveste biblică valid(ă)
    minimum_required: 0,
    reference_in_worksheet:
      'Întreaga fișă: personaje ca Moise, Adam și Eva, Noe, Avraam, David, Iisus Hristos, Ioan, apostolii, profeții etc.',
    points: 1,
    allow_partial: true, // 0.5 dacă există doar mențiunea personajului, dar descriere minimă
  },
};

// ==============================
// EVALUARE RĂSPUNSURI SCURTE (GEMINI, JSON STRICT)
// ==============================
async function evaluateShortAnswer(stepIndex, stepData, answer, student) {
  const config = EXPECTED_ANSWERS[stepIndex];
  if (!config) throw new Error(`Nu există configurație pentru pasul ${stepIndex}`);

  // Prompt unificat, ca în "adorarea-lui-dumnezeu"
  const isPartialScoring = config.allow_partial === true ? true : false;
  const maxScore = config.points;

  const prompt = `Ești profesor de religie și corectezi o fișă de lucru despre "Biblia – Cartea Cărților".

CONTEXT: Elevii au fișa cu tot conținutul. Aceasta este verificare de înțelegere.

ÎNTREBARE: "${stepData.question}"

UNDE SE GĂSEȘTE RĂSPUNSUL:
${config.reference_in_worksheet}

${
  config.concepts.length
    ? `CONCEPTE ACCEPTABILE (toleranță la diacritice, sinonime, mici erori de ortografie; pentru date ±50 ani, "Facerea" = "Geneza"):
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : 'CONCEPTE ACCEPTABILE: (întrebare deschisă – orice personaj/povestire biblică validă)'
}

ELEV: ${student.name} ${student.surname}
RĂSPUNS: "${answer}"

REGULI EVALUARE:
- Ignoră diacriticele (ă=a, î=i, â=a, ș=s, ț=t)
- Ignoră punctuația și spațiile suplimentare
- Acceptă echivalențe semantice (ex: "Facerea" = "Geneza"; "apostolul Ioan" = "Ioan")
- Pentru date: acceptă aproximativ (ex: 1400 î.Hr. ~ 1350–1450 î.Hr.)
- Identifică conceptele corecte din răspuns și listează-le în "concepts_found"
- Listează conceptele relevante lipsă în "concepts_missing" (dacă există)

SCORING:
${
  isPartialScoring
    ? `- Dacă găsești cel puțin ${config.minimum_required} concepte → "score": ${maxScore}, "decision": "correct", "is_correct": true
- Dacă găsești cel puțin 1 concept dar sub ${config.minimum_required} → "score": 0.5, "decision": "partially_correct", "is_correct": false
- Dacă nu găsești nimic relevant → "score": 0, "decision": "incorrect", "is_correct": false`
    : `- Dacă găsești cel puțin ${config.minimum_required} concept(e) → "score": ${maxScore}, "decision": "correct", "is_correct": true
- Altfel → "score": 0, "decision": "incorrect", "is_correct": false`
}

CAZ SPECIAL (ÎNTREBARE DESCHISĂ):
- Dacă nu poți determina clar validitatea (nu știi dacă e biblic) → "decision": "abstain", "score": 0

FEEDBACK:
- În română, scurt (max 600 caractere), cald și specific.
- Dacă INCORRECT: indică secțiunea din fișă unde se găsește răspunsul (după "UNDE SE GĂSEȘTE RĂSPUNSUL").

Răspunde DOAR cu JSON exact în formatul:
{
  "is_correct": true/false,
  "score": number,
  "decision": "correct"|"partially_correct"|"incorrect"|"abstain",
  "concepts_found": ["..."],
  "concepts_missing": ["..."],
  "feedback": "..."
}`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });

    const responseText = response.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}$/);
    if (!jsonMatch) throw new Error('Răspuns invalid de la AI');

    const result = JSON.parse(jsonMatch[0]);

    // Asigurăm coerența și tăiem la punctaj maxim
    if (typeof result.score !== 'number') result.score = 0;
    result.score = Math.min(result.score, maxScore);

    // Reparăm decizia pentru întrebările cu allow_partial, dacă AI nu a respectat exact regula
    if (isPartialScoring && result.decision !== 'abstain') {
      const found = Array.isArray(result.concepts_found) ? result.concepts_found.length : 0;
      if (found >= config.minimum_required) {
        result.score = maxScore;
        result.is_correct = true;
        result.decision = 'correct';
      } else if (found >= 1) {
        result.score = Math.max(result.score, 0.5);
        result.is_correct = false;
        result.decision = 'partially_correct';
      } else {
        result.score = 0;
        result.is_correct = false;
        result.decision = 'incorrect';
      }
    }

    return result;
  } catch (error) {
    console.error('[EROARE GEMINI]', error);
    throw error;
  }
}

// ==============================
// EVALUARE GRILĂ (GEMINI, feedback scurt RO)
// ==============================
async function evaluateGrila(stepData, answer, isCorrect, student) {
  const score = isCorrect ? stepData.points : 0;

  const prompt = `Ești profesor de religie. Elevii au fișa "Biblia – Cartea Cărților".

ÎNTREBARE: "${stepData.question}"

OPȚIUNI:
${stepData.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

CORECT: ${stepData.options[stepData.correct_answer]}
ELEVUL A ALES: ${stepData.options[answer]}

FEEDBACK (în română, 1–2 propoziții):
- Dacă CORECT: Confirmă clar răspunsul.
- Dacă GREȘIT: Indică secțiunea din fișă unde se găsește răspunsul (nume/descriere scurtă).`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });

    const feedback = (response.text || '').trim();

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

// ==============================
// ROUTARE PAS: GRILĂ vs RĂSPUNS SCURT (structură ca în "adorarea")
// ==============================
async function evaluateStep(stepIndex, stepData, answer, isCorrect, student) {
  if (stepData.type === 'grila') {
    console.log('[GRILĂ]', {
      step: stepIndex,
      student: `${student.name} ${student.surname}`,
      isCorrect,
    });
    return await evaluateGrila(stepData, answer, isCorrect, student);
  }

  console.log('[RĂSPUNS SCURT]', {
    step: stepIndex,
    student: `${student.name} ${student.surname}`,
    answer: (answer || '').substring(0, 50) + '...',
  });

  try {
    const aiResult = await evaluateShortAnswer(stepIndex, stepData, answer, student);

    if (aiResult.decision === 'abstain') {
      console.log('[ABSTAIN]');
      return {
        score: 0,
        is_correct: false,
        decision: 'abstain',
        feedback:
          'Nu am putut evalua cu certitudine. Verifică fișa și reformulează mai clar răspunsul.',
        concepts_found: [],
        concepts_missing: EXPECTED_ANSWERS[stepIndex]?.concepts || [],
      };
    }

    console.log('[EVALUAT]', {
      step: stepIndex,
      decision: aiResult.decision,
      score: aiResult.score,
      concepts: Array.isArray(aiResult.concepts_found) ? aiResult.concepts_found : [],
    });

    return aiResult;
  } catch (error) {
    console.error('[EROARE]', error);
    throw error;
  }
}

// ==============================
// RAPORT FINAL PERSONALIZAT (stil aliniat)
// ==============================
async function generateFinalReport(student, performanceData) {
  const { totalScore, maxScore, stepResults } = performanceData;
  const percentage = (totalScore / maxScore) * 100;

  const correctSteps = stepResults.filter((s) => s.score === s.maxPoints).length;
  const partialSteps = stepResults.filter((s) => s.score > 0 && s.score < s.maxPoints).length;
  const incorrectSteps = stepResults.filter((s) => s.score === 0).length;

  const prompt = `Creează un raport personalizat în română.

ELEV: ${student.name} ${student.surname}
PUNCTAJ: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)
Corecte: ${correctSteps} | Parțiale: ${partialSteps} | Greșite: ${incorrectSteps}

SUBIECT: "Biblia – Cartea Cărților" (autori, cronologie, materiale, limbi, traduceri, personaje)

Creează 3 secțiuni scurte (max 500 caractere total):

**Puncte forte:**
[Ce au înțeles bine – ex: cronologia (Moise/Ioan), materialele (papirus/pergament), limbile (ebraică/greacă), etc.]

**De îmbunătățit:**
[Ce secțiuni să reviziteze – indică precis zonele unde au avut răspunsuri parțiale/greșite]

**Încurajare:**
[Încurajare prietenoasă, legată de progresul lor, cu o trimitere biblică generală (fără citat lung)]

Fii specific pentru performanța lor. Ton cald și încurajator.`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return (response.text || '').trim();
  } catch (error) {
    console.error('[EROARE GEMINI]', error);
    throw error;
  }
}

// ==============================
// HANDLERS – aceleași endpoint-uri ca în fișa "adorarea"
// ==============================
async function handleStepFeedback(requestData) {
  const { stepIndex, stepData, answer, student, isCorrect } = requestData;

  if (stepIndex === undefined || !stepData || answer === undefined || !student) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Date incomplete' }),
    };
  }

  try {
    const result = await evaluateStep(stepIndex, stepData, answer, isCorrect, student);

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

// ==============================
// EXPORT
// ==============================
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
