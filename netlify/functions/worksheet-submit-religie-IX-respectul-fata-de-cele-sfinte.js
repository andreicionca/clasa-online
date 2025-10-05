// netlify/functions/worksheet-submit-religie-IX-respectul-fata-de-cele-sfinte.js

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================
// JSON SCHEMA - BINARY SCORING
// ============================================

const GRADING_SCHEMA = {
  name: 'GradeShortAnswer',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_correct: { type: 'boolean' },
      score: {
        type: 'number',
        enum: [0, 2],
      },
      decision: {
        type: 'string',
        enum: ['correct', 'incorrect', 'abstain'],
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

  const prompt = `You are a religion teacher grading a worksheet exercise.

CONTEXT: Students have the worksheet with all answers. This is reading comprehension.

QUESTION: "${stepData.question}"

WHERE TO FIND ANSWER:
${config.reference_in_worksheet}

REQUIRED CONCEPTS (must identify ${config.minimum_required}):
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

STUDENT: ${student.name} ${student.surname}
ANSWER: "${answer}"

GRADING:

1. Check if ${config.minimum_required}+ concepts are present
   - Tolerate spelling errors (2-3 letters)
   - For definitions: verify correct meaning

2. BINARY SCORING:
   ✓ All required concepts + correct meaning → 2 points
   ✗ Missing concepts OR wrong meaning → 0 points

3. DO NOT penalize extra information, explanations, or longer answers

4. FEEDBACK (Romanian):

   If CORRECT (score = 2):
   Format:
   [Confirmare specifică - 1 propoziție]

   💡 **Știai că...?**
   [Un fapt interesant DIRECT RELEVANT la conceptul din întrebare - 1-2 propoziții]

   Guidelines for "Știai că...":
   - Must be DIRECTLY RELATED to the question's concept
   - Educational and fascinating
   - Based on worksheet content or general religious knowledge
   - Use appropriate emoji (💡🔥✨🕊️⛰️🏛️📖)
   - Short and engaging

   If INCORRECT (score = 0):
   - GUIDE to specific worksheet section
   - Quote what's written there
   - Help them understand what they missed

5. If uncertain → "abstain", score 0`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    messages: [
      {
        role: 'system',
        content: 'You are an educational teacher who makes learning engaging.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: GRADING_SCHEMA,
    },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ============================================
// EVALUARE GRILE
// ============================================

async function evaluateGrila(stepData, answer, isCorrect, student) {
  const score = isCorrect ? 2 : 0;

  const prompt = `You are a religion teacher. Students have the worksheet.

QUESTION: "${stepData.question}"

OPTIONS:
${stepData.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

CORRECT: ${stepData.options[stepData.correct_answer]}
STUDENT SELECTED: ${stepData.options[answer]}

STUDENT: ${student.name} ${student.surname}

FEEDBACK (Romanian):

If CORRECT:
Format:
[Confirmare specifică - 1 propoziție]

💡 **Știai că...?**
[Un fapt interesant DIRECT RELEVANT - 1-2 propoziții]

Guidelines:
- Directly related to question topic
- Educational and engaging
- Use appropriate emoji (💡🔥✨🕊️⛰️🏛️📖)
- Short (1-2 sentences)

If INCORRECT:
- Guide to worksheet section (2-3 sentences)
- Help them find where the answer is in the worksheet`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    max_tokens: 250,
    messages: [
      {
        role: 'system',
        content: 'You are an educational teacher who makes learning engaging.',
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

  const prompt = `Create a personalized report in Romanian.

STUDENT: ${student.name} ${student.surname}
SCORE: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)
Correct: ${correctSteps} | Incorrect: ${incorrectSteps}

TOPIC: "Respectul față de cele sfinte"

3 sections (max 450 chars total):

**Puncte forte:**
[What they understood well]

**De îmbunătățit:**
[Which sections to review]

**Încurajare:**
[Personal encouragement]

Be specific to their performance.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    top_p: 1,
    max_tokens: 250,
    messages: [
      {
        role: 'system',
        content: 'You are a caring teacher providing personalized feedback in Romanian.',
      },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices[0].message.content.trim();
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
