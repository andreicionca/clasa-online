// netlify/functions/worksheet-submit-religie-IX-adorarea-lui-dumnezeu.js

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const GRADING_SCHEMA = {
  name: 'GradeShortAnswer',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_correct: { type: 'boolean' },
      score: { type: 'number' },
      decision: {
        type: 'string',
        enum: ['correct', 'partially_correct', 'incorrect', 'abstain'],
      },
      concepts_found: {
        type: 'array',
        items: { type: 'string' },
      },
      concepts_missing: {
        type: 'array',
        items: { type: 'string' },
      },
      feedback: { type: 'string', maxLength: 600 },
    },
    required: ['is_correct', 'score', 'decision', 'concepts_found', 'concepts_missing', 'feedback'],
  },
  strict: true,
};

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

  const prompt = `You are a religion teacher grading a worksheet exercise.

CONTEXT: Students have the worksheet with all content. This is reading comprehension.

QUESTION: "${stepData.question}"

WHERE TO FIND ANSWER:
${config.reference_in_worksheet}

${
  isPartialScoring
    ? `CONCEPTS (student needs ${maxConceptsNeeded}):`
    : `REQUIRED CONCEPTS (must identify ${config.minimum_required}):`
}
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

STUDENT: ${student.name} ${student.surname}
ANSWER: "${answer}"

GRADING:
${
  isPartialScoring
    ? `- Ignore all diacritics
- Count distinct concepts found
- Put found concepts in concepts_found array`
    : `- Ignore all diacritics
- Check if required concepts present
- Binary: all or nothing`
}

FEEDBACK (Romanian, 1-2 sentences):
- If CORRECT: Confirm specifically what they wrote correctly
- If PARTIALLY_CORRECT: State "Ai identificat X din ${maxConceptsNeeded}. Caută în secțiunea [name] din fișă."
- If INCORRECT: Guide to worksheet section where answer is found

Write ACTUAL feedback text, not placeholders like "[confirmare]".`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    messages: [
      {
        role: 'system',
        content: 'You are an educational teacher who provides clear, concise feedback.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: GRADING_SCHEMA,
    },
  });

  const result = JSON.parse(response.choices[0].message.content);

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
}

async function evaluateGrila(stepData, answer, isCorrect, student) {
  const score = isCorrect ? stepData.points : 0;

  const prompt = `You are a religion teacher. Students have the worksheet.

QUESTION: "${stepData.question}"

OPTIONS:
${stepData.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

CORRECT: ${stepData.options[stepData.correct_answer]}
STUDENT SELECTED: ${stepData.options[answer]}

FEEDBACK (Romanian, 1-2 sentences):
- If CORRECT: Confirm answer briefly
- If INCORRECT: Guide to worksheet section where answer can be found`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content: 'You are an educational teacher who provides clear, brief feedback.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const feedback = response.choices[0].message.content.trim();

  return {
    score,
    is_correct: isCorrect,
    decision: isCorrect ? 'correct' : 'incorrect',
    feedback,
    concepts_found: isCorrect ? [stepData.options[stepData.correct_answer]] : [],
    concepts_missing: isCorrect ? [] : [stepData.options[stepData.correct_answer]],
  };
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

  const prompt = `Create a personalized report in Romanian.

STUDENT: ${student.name} ${student.surname}
SCORE: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)
Correct: ${correctSteps} | Partial: ${partialSteps} | Incorrect: ${incorrectSteps}

TOPIC: "Adorarea lui Dumnezeu" și viața Sfântului Augustin

3 sections (max 500 chars total):

**Puncte forte:**
[What they understood well - despre adorare sau Sf. Augustin]

**De îmbunătățit:**
[Which sections to review]

**Încurajare:**
[Personal encouragement - poate include referință la Sf. Augustin]

Be specific to their performance. Warm and encouraging tone.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    top_p: 1,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: 'You are a caring religion teacher providing personalized feedback in Romanian.',
      },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices[0].message.content.trim();
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
