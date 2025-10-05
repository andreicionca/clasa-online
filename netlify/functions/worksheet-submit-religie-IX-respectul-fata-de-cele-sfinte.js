// netlify/functions/worksheet-submit-religie-IX-respectul-fata-de-cele-sfinte.js

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================
// JSON SCHEMA - BINARY SCORING (0 sau 2)
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
        enum: [0, 2], // DOAR 0 sau 2 (binary)
      },
      decision: {
        type: 'string',
        enum: ['correct', 'incorrect', 'abstain'], // fără "partial"
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

CONTEXT: Students have the worksheet IN FRONT OF THEM with all answers. This is a reading comprehension exercise.

QUESTION: "${stepData.question}"

WHERE TO FIND THE ANSWER IN WORKSHEET:
${config.reference_in_worksheet}

REQUIRED CONCEPTS (student must identify ${config.minimum_required} of these):
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

${
  config.question_type === 'definition'
    ? `
CORRECT DEFINITION FROM WORKSHEET:
"${config.correct_definition}"

CRITICAL FOR DEFINITIONS:
- Check if student understood the ACTUAL meaning
- Watch for NEGATIONS ("nu este", "nu înseamnă") that REVERSE the meaning
- If they wrote the OPPOSITE → score = 0
`
    : ''
}

STUDENT: ${student.name} ${student.surname}

STUDENT'S ANSWER:
"${answer}"

GRADING RULES:

1. CONCEPT IDENTIFICATION (focus ONLY on required concepts):
   - Check if ${config.minimum_required}+ required concepts are present
   - Tolerate spelling errors (2-3 letter differences)
   - For definitions: verify they understood the CORRECT meaning (not opposite)

2. BINARY SCORING:
   ✓ ALL ${config.minimum_required}+ required concepts present + correct meaning → score = 2
   ✗ Missing concepts OR wrong meaning → score = 0

   NO partial credit. It's all-or-nothing.

3. EXTRA INFORMATION POLICY:
   DO NOT penalize:
   - Extra explanations or context
   - Additional correct information
   - Personal reflections
   - Longer, more developed answers

   Examples:
   ✓ Short answer with all concepts → 2 points
   ✓ Long answer with all concepts + extra info → ALSO 2 points
   ✗ Any answer missing required concepts → 0 points

4. EDUCATIONAL FEEDBACK (in Romanian):

   If CORRECT (score = 2):
   - Acknowledge they found all required concepts in the worksheet
   - Be specific about what they identified correctly
   - Brief and encouraging

   If INCORRECT (score = 0):
   - GUIDE them back to the specific worksheet section
   - Quote what's written there or give exact location
   - Help them see what they missed or misunderstood


   Focus on LEARNING, not just right/wrong.
   NO random trivia or unrelated information.

5. If uncertain → decision = "abstain", score = 0`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    messages: [
      {
        role: 'system',
        content:
          'You are an educational religion teacher. Guide students back to the source material to help them learn.',
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
// EVALUARE GRILE (feedback consistent cu răspunsuri scurte)
// ============================================

async function evaluateGrila(stepData, answer, isCorrect, student) {
  const score = isCorrect ? 2 : 0;

  const prompt = `You are a religion teacher. Students have the worksheet IN FRONT OF THEM.

QUESTION: "${stepData.question}"

OPTIONS:
${stepData.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

CORRECT ANSWER: ${stepData.options[stepData.correct_answer]}
STUDENT SELECTED: ${stepData.options[answer]}
RESULT: ${isCorrect ? 'CORRECT' : 'INCORRECT'}

STUDENT: ${student.name} ${student.surname}

Provide EDUCATIONAL feedback in Romanian (2-3 sentences):

If CORRECT:
- Acknowledge they found the right answer from the worksheet
- Be specific about what concept they recognized
- Brief and encouraging

If INCORRECT:
- GUIDE them back to the worksheet (don't just give the answer)
- Tell them which section to review
- Example: "Verifică din nou secțiunea despre [topic] din fișă"
- Help them learn WHERE to find information

Focus on guiding their learning, not just stating right/wrong.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: 'You are an educational teacher guiding students back to source material.',
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
    console.log('[EVALUARE GRILĂ]', {
      step: stepData.step,
      student: `${student.name} ${student.surname}`,
      isCorrect,
    });
    return await evaluateGrila(stepData, answer, isCorrect, student);
  }

  console.log('[EVALUARE RĂSPUNS SCURT]', {
    step: stepData.step,
    student: `${student.name} ${student.surname}`,
    answer: answer.substring(0, 50) + '...',
  });

  try {
    const aiResult = await evaluateShortAnswer(stepData, answer, student);

    if (aiResult.decision === 'abstain') {
      console.log('[AI ABSTAIN]');
      return {
        score: 0,
        is_correct: false,
        decision: 'abstain',
        feedback:
          'Nu am putut evalua cu certitudine răspunsul. Verifică din nou fișa și reformulează mai clar.',
        concepts_found: [],
        concepts_missing: EXPECTED_ANSWERS[stepData.step].concepts,
      };
    }

    console.log('[EVALUAT]', {
      decision: aiResult.decision,
      score: aiResult.score,
      concepts_found: aiResult.concepts_found,
    });

    return aiResult;
  } catch (error) {
    console.error('[EROARE AI]', error);
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

  const prompt = `You are a religion teacher writing a personalized final report.

STUDENT: ${student.name} ${student.surname}
PERFORMANCE: ${totalScore}/${maxScore} points (${percentage.toFixed(1)}%)
Correct: ${correctSteps} | Incorrect: ${incorrectSteps}

WORKSHEET: "Respectul față de cele sfinte" (Moses, burning bush, Jewish festivals, Temple, blasphemy)

Create a report in Romanian with 3 sections:

**Puncte forte:**
[What did they understand well from the worksheet?]

**De îmbunătățit:**
[Which worksheet sections need review? Be specific.]

**Încurajare:**
[Personal encouragement about their learning]

Be SPECIFIC to their performance. Reference actual worksheet concepts.
Maximum 450 characters.`;

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
        error: 'Sistemul de evaluare AI este temporar indisponibil.',
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
    console.error('Eroare raport final:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: 'Raportul final nu poate fi generat momentan.',
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
