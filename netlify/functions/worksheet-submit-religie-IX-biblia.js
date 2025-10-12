// netlify/functions/worksheet-submit-religie-IX-biblia.js

const { GoogleGenAI } = require('@google/genai');
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================
// CONFIGURAȚII - EXACT CA ÎN "adorarea", DAR PENTRU "BIBLIA – CARTEA CĂRȚILOR"
// ============================================

const EXPECTED_ANSWERS = {
  1: {
    question_type: 'date_and_person',
    concepts: ['Moise', '1400 î.Hr.', '1400', 'Facerea', 'Geneza'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Cum a fost scrisă": "Prima carte a fost scrisă de Moise în jurul anului 1400 î.Hr. – Facerea (Geneza)."',
    points: 1,
  },
  2: {
    question_type: 'list_partial',
    concepts: [
      'Moise',
      'începutul lumii',
      'creația',
      'Adam',
      'Eva',
      'potopul',
      'Noe',
      'Avraam',
      'Abraham',
    ],
    minimum_required: 2,
    reference_in_worksheet:
      'Secțiunea "Povestea Bibliei": "Moise a început să scrie primele texte... Geneza povestește începutul lumii, Adam și Eva, potopul lui Noe, alegerea lui Avraam."',
    points: 1,
    partial_scoring: true,
    points_per_concept: 0.5,
    max_concepts_needed: 2, // dacă atinge 2, ia punctul maxim
  },
  3: {
    question_type: 'proper_name',
    concepts: ['Ioan', 'Apostolul Ioan', 'Apocalipsa', '95 d.Hr.', '95'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Povestea Bibliei"/"Cum a fost scrisă": "Ultima carte, Apocalipsa, scrisă de Ioan în jurul anului 95 d.Hr."',
    points: 1,
  },
  4: {
    question_type: 'proper_name',
    concepts: ['P52', 'Papirusul P52', 'papirus P52', '120 d.Hr.', '120'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Transmiterea": "Cel mai vechi fragment al Noului Testament este Papirusul P52 (~120 d.Hr.)"',
    points: 1,
  },
  5: {
    question_type: 'list_partial',
    concepts: ['papirus', 'pergament', 'plantă', 'Nil', 'piele', 'animal'],
    minimum_required: 2,
    reference_in_worksheet:
      'Secțiunea "Materialul": "papirus (plantă de pe Nil); pergament (piele de animal)"',
    points: 1,
    partial_scoring: true,
    points_per_concept: 0.5,
    max_concepts_needed: 2,
  },
  6: {
    question_type: 'list_partial',
    concepts: ['ebraică', 'ebraica', 'aramaică', 'aramaica', 'greacă', 'greaca', 'koiné', 'koine'],
    minimum_required: 2,
    reference_in_worksheet:
      'Secțiunea "Limbile originale": "Ebraica (Vechiul Testament, majoritar), Aramaica (fragmente), Greaca koiné (Noul Testament)"',
    points: 1,
    partial_scoring: true,
    points_per_concept: 0.5,
    max_concepts_needed: 2,
  },
  8: {
    question_type: 'proper_name',
    concepts: ['București', 'Bucuresti', '1688'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Traducerea": "Prima traducere completă în română: București, 1688"',
    points: 1,
  },
  9: {
    question_type: 'open_creative',
    concepts: [],
    minimum_required: 0,
    reference_in_worksheet:
      'Întreaga fișă: personaje/episoade biblice (Moise, Noe, Avraam, David, Iisus, apostolii, profeții etc.)',
    points: 1,
    partial_scoring: true,
    points_per_concept: 0.5, // mențiune validă dar descriere minimă = 0.5
    max_concepts_needed: 1,
  },
};

// ============================================
// EVALUARE RĂSPUNSURI SCURTE – IDENTIC CU "adorarea"
// ============================================

async function evaluateShortAnswer(stepIndex, stepData, answer, student) {
  const config = EXPECTED_ANSWERS[stepIndex];
  if (!config) throw new Error(`Nu există configurație pentru pasul ${stepIndex}`);

  const isPartialScoring = config.partial_scoring === true;
  const maxScore = config.points;
  const maxConceptsNeeded = config.max_concepts_needed || config.concepts?.length || 0;

  const prompt = `Ești profesor de religie și corectezi o fișă de lucru.

CONTEXT: Elevii au fișa cu tot conținutul. Aceasta este verificare de înțelegere.

ÎNTREBARE: "${stepData.question}"

UNDE SE GĂSEȘTE RĂSPUNSUL:
${config.reference_in_worksheet}

${
  config.concepts?.length
    ? `${
        isPartialScoring
          ? `CONCEPTE (elevul trebuie să atingă pragul de ${maxConceptsNeeded} pentru punctaj maxim):`
          : `CONCEPTE ACCEPTABILE (trebuie să apară MĂCAR ${config.minimum_required}):`
      }
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : 'CONCEPTE ACCEPTABILE: (întrebare deschisă; acceptă orice personaj/povestire biblică validă)'
}

ELEV: ${student.name} ${student.surname}
RĂSPUNS: "${answer}"

REGULI EVALUARE:
${
  isPartialScoring
    ? `- Ignoră diacriticele (ă=a, î=i, ș=s, ț=t), punctuația și spațiile extra
- Acceptă sinonime și echivalențe ("Facerea" = "Geneza"; "apostolul Ioan" = "Ioan"; pentru date ±50 ani)
- Numără conceptele distincte găsite
- Pune conceptele găsite în "concepts_found"
- Scor: 1 punct dacă atinge pragul (${maxConceptsNeeded}); altfel 0.5 pentru cel puțin 1 concept; altfel 0`
    : `- Ignoră diacriticele (ă=a, î=i, ș=s, ț=t), punctuația și spațiile extra
- Acceptă sinonime și echivalențe (ex. "Facerea"="Geneza"; date ±50 ani)
- Verifică dacă există MĂCAR ${config.minimum_required} concept(e)
- Dacă DA → ${maxScore} p, decizie "correct"; dacă NU → 0 p, "incorrect"`
}

IMPORTANT: NU inventa critici care nu există! Dacă elevul a scris ideea corectă cu alte cuvinte, acceptă răspunsul.

Răspunde DOAR cu JSON în acest format exact:
{
  "is_correct": true/false,
  "score": număr,
  "decision": "correct"|"partially_correct"|"incorrect"|"abstain",
  "concepts_found": ["concept1","concept2"],
  "concepts_missing": ["concept3"],
  "feedback": "feedback în română, max 600 caractere"
}`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });

    const responseText = response.text; // EXACT ca în fișierul "adorarea"
    const jsonMatch = responseText && responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Răspuns invalid de la AI');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Logica de scoring parțial – IDENTICĂ
    if (isPartialScoring) {
      const found = Array.isArray(result.concepts_found) ? result.concepts_found.length : 0;
      if (maxConceptsNeeded > 0) {
        if (found >= maxConceptsNeeded) {
          result.score = maxScore;
          result.decision = 'correct';
          result.is_correct = true;
        } else if (found >= 1) {
          result.score = Math.max(result.score || 0, config.points_per_concept || 0.5);
          result.decision = 'partially_correct';
          result.is_correct = false;
        } else {
          result.score = 0;
          result.decision = 'incorrect';
          result.is_correct = false;
        }
      } else {
        // întrebări deschise (ex. 9)
        if (result.decision === 'abstain') {
          result.score = 0;
          result.is_correct = false;
        } else if ((result.score || 0) >= maxScore) {
          result.score = maxScore;
          result.decision = 'correct';
          result.is_correct = true;
        } else if ((result.score || 0) > 0) {
          result.score = Math.min(result.score, maxScore);
          result.decision = 'partially_correct';
          result.is_correct = false;
        }
      }
    }

    result.score = Math.min(result.score, maxScore);
    return result;
  } catch (error) {
    console.error('[EROARE GEMINI]', error);
    throw error;
  }
}

// ============================================
// EVALUARE GRILĂ – IDENTICĂ LA STRUCTURĂ CU "adorarea"
// ============================================

async function evaluateGrila(stepData, answer, isCorrect, student) {
  const score = isCorrect ? stepData.points : 0;

  const prompt = `Ești profesor de religie. Elevii au fișa "Biblia – Cartea Cărților".

ÎNTREBARE: "${stepData.question}"

OPȚIUNI:
${stepData.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

CORECT: ${stepData.options[stepData.correct_answer]}
ELEVUL A ALES: ${stepData.options[answer]}

FEEDBACK (în română, 1-2 propoziții):
- Dacă CORECT: Confirmă răspunsul pe scurt
- Dacă GREȘIT: Indică secțiunea din fișă unde se găsește răspunsul`;

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

// ============================================
// ROUTARE PAS – IDENTICĂ CU "adorarea"
// ============================================

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
        feedback: 'Nu am putut evalua cu certitudine. Verifică fișa și reformulează mai clar.',
        concepts_found: [],
        concepts_missing: EXPECTED_ANSWERS[stepIndex]?.concepts || [],
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
// RAPORT FINAL – IDENTIC LA FORMAT CU "adorarea"
// ============================================

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
[Ce au înțeles bine – cronologie (Moise/Ioan), materiale (papirus/pergament), limbile (ebraică/greacă), etc.]

**De îmbunătățit:**
[Ce secțiuni să revizuiască – unde au avut parțiale/greșite]

**Încurajare:**
[Încurajare personalizată legată de progresul lor, ton cald]

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

// ============================================
// HANDLERS – ACELEAȘI ENDPOINT-URI CA ÎN "adorarea"
// ============================================

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

// ============================================
// EXPORT – IDENTIC
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
