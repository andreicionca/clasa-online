// netlify/functions/worksheet-submit-religie-IX-adorarea-lui-dumnezeu.js

const { GoogleGenAI } = require('@google/genai');
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const EXPECTED_ANSWERS = {
  1: {
    question_type: 'biblical_verse',
    concepts: [
      'Domnului Dumnezeului tău să te închini',
      'numai Lui să-I slujești',
      'Matei 4,10',
      'Luca 4,8',
    ],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Semnificație": "Domnului Dumnezeului tău să te închini și numai Lui să-I slujești." (Matei 4,10; cf. Luca 4,8)',
    points: 1,
  },
  2: {
    question_type: 'list_partial',
    concepts: ['prin gând', 'prin cuvânt', 'prin faptă'],
    minimum_required: 3,
    reference_in_worksheet:
      'Secțiunea "Forme ale adorării": "Prin gând", "Prin cuvânt", "Prin faptă"',
    points: 3,
    partial_scoring: true,
    points_per_concept: 1,
    max_concepts_needed: 3,
  },
  3: {
    question_type: 'list_partial',
    concepts: [
      'ajuți',
      'ierți',
      'ești drept',
      'îți respecți promisiunile',
      'îți împlinești datoria cu seriozitate',
      'faci bine',
    ],
    minimum_required: 3,
    reference_in_worksheet:
      'Secțiunea "Forme ale adorării - Prin faptă": "ajuți, ierți, ești drept, îți respecți promisiunile și îți împlinești datoria cu seriozitate"',
    points: 3,
    partial_scoring: true,
    points_per_concept: 1,
    max_concepts_needed: 3,
  },
  6: {
    question_type: 'proper_name',
    concepts: ['Tolle, lege', 'Ia și citește'],
    minimum_required: 1,
    reference_in_worksheet:
      'Povestirea despre Sf. Augustin: "a auzit, de dincolo de zid, un glas de copil care spunea: „Tolle, lege!" adică: Ia și citește!"',
    points: 1,
  },
  8: {
    question_type: 'proper_name',
    concepts: ['Epistola către Romani', 'Romani', 'Romani 13'],
    minimum_required: 1,
    reference_in_worksheet: 'Povestirea despre Sf. Augustin: citat din Romani 13, 12–14',
    points: 1,
  },
  9: {
    question_type: 'completion',
    concepts: [
      'până ce se va odihni în Tine',
      'până când se va odihni în Tine',
      'până nu se va odihni în Tine',
    ],
    minimum_required: 1,
    reference_in_worksheet:
      'Citatul Sf. Augustin: "Ne-ai făcut pentru Tine, Doamne, și neliniștit este sufletul nostru până ce se va odihni în Tine."',
    points: 1,
  },
  11: {
    question_type: 'proper_name',
    concepts: [
      'a vândut tot ce avea și a întemeiat o mănăstire',
      'întemeiat o mănăstire',
      's-a dedicat vieții monastice',
      'a întemeiat o mănăstire la Tagaste',
    ],
    minimum_required: 1,
    reference_in_worksheet:
      'Povestirea: "Augustin s-a întors în Africa, a vândut tot ce avea și a întemeiat o mănăstire la Tagaste, dedicându-și viața slujirii."',
    points: 1,
  },
  12: {
    question_type: 'year',
    concepts: ['430'],
    minimum_required: 1,
    reference_in_worksheet: 'Povestirea: "Sfântul Augustin a trecut la Domnul în anul 430"',
    points: 1,
  },
};

async function evaluateShortAnswer(stepIndex, stepData, answer, student) {
  const config = EXPECTED_ANSWERS[stepIndex];

  if (!config) {
    throw new Error(`Nu există configurație pentru pasul ${stepIndex}`);
  }

  const isPartialScoring = config.partial_scoring === true;
  const maxScore = config.points;
  const maxConceptsNeeded = config.max_concepts_needed || config.concepts.length;

  const prompt = `Ești profesor de religie și corectezi o fișă de lucru.

CONTEXT: Elevii au fișa cu tot conținutul. Aceasta este verificare de înțelegere.

ÎNTREBARE: "${stepData.question}"

UNDE SE GĂSEȘTE RĂSPUNSUL:
${config.reference_in_worksheet}

${
  isPartialScoring
    ? `CONCEPTE (elevul trebuie să menționeze ${maxConceptsNeeded}):`
    : `CONCEPTE ACCEPTABILE (elevul trebuie să menționeze ORICARE ${config.minimum_required}):`
}
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

ELEV: ${student.name} ${student.surname}
RĂSPUNS: "${answer}"

REGULI EVALUARE:
${
  isPartialScoring
    ? `- Ignoră toate diacriticele (ă=a, ț=t, ș=s, î=i)
- Ignoră punctuația și spațiile extra
- Acceptă sinonime clare (gândire=gând, vorbire=cuvânt, acțiune=faptă)
- Numără concepte distincte găsite
- Pune conceptele găsite în concepts_found
- 1 punct pentru fiecare concept găsit (max ${maxConceptsNeeded})`
    : `- Ignoră toate diacriticele (ă=a, ț=t, ș=s, î=i)
- Ignoră punctuația (Tolle lege = Tolle, lege)
- Acceptă sinonime clare și echivalente
- Verifică dacă MĂCAR ${config.minimum_required} concept este prezent
- Dacă DA → punctaj ${maxScore}, decizie "correct"
- Dacă NU → punctaj 0, decizie "incorrect"`
}

IMPORTANT: NU inventa critici care nu există! Dacă elevul a scris ideea corectă cu alte cuvinte, acceptă răspunsul.

Răspunde DOAR cu JSON în acest format exact:
{
  "is_correct": true sau false,
  "score": număr,
  "decision": "correct" sau "partially_correct" sau "incorrect" sau "abstain",
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

    const result = JSON.parse(jsonMatch[0]);

    // Logica de scoring parțial
    if (isPartialScoring && result.concepts_found && result.concepts_found.length > 0) {
      const conceptsCount = result.concepts_found.length;

      if (conceptsCount >= maxConceptsNeeded) {
        result.score = maxScore;
        result.decision = 'correct';
        result.is_correct = true;
      } else {
        result.score = conceptsCount * config.points_per_concept;
        result.decision = 'partially_correct';
        result.is_correct = false;
      }
    }

    result.score = Math.min(result.score, maxScore);
    return result;
  } catch (error) {
    console.error('[EROARE GEMINI]', error);
    throw error;
  }
}

async function evaluateGrila(stepData, answer, isCorrect, student) {
  const score = isCorrect ? stepData.points : 0;

  const prompt = `Ești profesor de religie. Elevii au fișa de lucru.

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
    answer: answer.substring(0, 50) + '...',
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
        concepts_missing: EXPECTED_ANSWERS[stepIndex].concepts,
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

SUBIECT: "Adorarea lui Dumnezeu" și viața Sfântului Augustin

Creează 3 secțiuni scurte (max 500 caractere total):

**Puncte forte:**
[Ce au înțeles bine - despre adorare sau Sf. Augustin]

**De îmbunătățit:**
[Care secțiuni să le revizuiască]

**Încurajare:**
[Încurajare personalizată - poate include referință la Sf. Augustin]

Fii specific pentru performanța lor. Ton cald și încurajator.`;

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
