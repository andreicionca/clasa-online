// netlify/functions/worksheet-submit-religie-IX-respectul-fata-de-cele-sfinte.js

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================
// JSON SCHEMA STRICT (Structured Outputs)
// ============================================

const GRADING_SCHEMA = {
  name: 'GradeShortAnswer',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_correct: { type: 'boolean' },
      score: { type: 'number', minimum: 0, maximum: 2 },
      decision: {
        type: 'string',
        enum: ['correct', 'partial', 'incorrect', 'abstain'],
      },
      evidence: { type: 'string', maxLength: 200 },
      feedback: { type: 'string', maxLength: 240 },
    },
    required: ['is_correct', 'score', 'decision', 'evidence', 'feedback'],
  },
  strict: true,
};

// ============================================
// NORMALIZARE (deterministă)
// ============================================

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // elimină diacritice
    .replace(/[^\w\s]/g, ' ')
    .trim();
}

// ============================================
// CONFIGURAȚII RĂSPUNSURI AȘTEPTATE
// ============================================

const EXPECTED_ANSWERS = {
  2: {
    concepts: ['Horeb', 'Sinai'],
    keywords: {
      Horeb: ['horeb'],
      Sinai: ['sinai'],
    },
    minimumRequired: 1,
    points: 2,
  },
  5: {
    concepts: ['Paștele', 'Cincizecimea', 'Sărbătoarea Corturilor'],
    keywords: {
      Paștele: ['paste', 'pesah', 'pasti'],
      Cincizecimea: ['cincizecimea', 'shavuot', 'savuot', 'rusalii', 'saptaman', 'saptamanilor'],
      'Sărbătoarea Corturilor': ['corturilor', 'sucot', 'sukkot', 'cort'],
    },
    minimumRequired: 2,
    points: 2,
  },
  7: {
    concepts: ['Ierusalim'],
    keywords: {
      Ierusalim: ['ierusalim', 'ierusalem', 'jerusalem'],
    },
    minimumRequired: 1,
    points: 2,
  },
  9: {
    concepts: ['lipsă de respect', 'față de cele sfinte'],
    keywords: {
      'lipsă de respect': [
        'lipsa',
        'lipsă',
        'lipsa de respect',
        'lipsă de respect',
        'jignire',
        'jignirea',
        'ofensa',
        'ofensă',
      ],
      'față de cele sfinte': [
        'sfinte',
        'sfânt',
        'sfant',
        'dumnezeu',
        'religie',
        'sacru',
        'religios',
      ],
    },
    minimumRequired: 2,
    points: 2,
  },
};

// ============================================
// PRE-VALIDARE (înainte de AI)
// ============================================

function preValidateAnswer(studentAnswer, stepNumber) {
  const config = EXPECTED_ANSWERS[stepNumber];
  if (!config) return null;

  const normalized = normalizeText(studentAnswer);
  const foundConcepts = [];

  // Verifică fiecare concept cerut
  for (const concept of config.concepts) {
    const keywords = config.keywords[concept];
    const found = keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
    if (found) {
      foundConcepts.push(concept);
    }
  }

  // Dacă toate conceptele necesare sunt prezente → AUTOMAT CORECT
  if (foundConcepts.length >= config.minimumRequired) {
    return {
      autoValidated: true,
      score: config.points,
      is_correct: true,
      decision: 'correct',
      evidence: `Concepte identificate automat: ${foundConcepts.join(', ')}`,
      feedback: 'Corect! Ai menționat toate conceptele necesare.',
    };
  }

  // Dacă lipsesc concepte → trimite la AI pentru analiză detaliată
  return null;
}

// ============================================
// EVALUARE CU AI (Structured Outputs)
// ============================================

async function evaluateWithAI(stepData, answer) {
  const config = EXPECTED_ANSWERS[stepData.step];

  if (!config) {
    throw new Error(`Nu există configurație pentru pasul ${stepData.step}`);
  }

  // Construiește referința clară pentru AI
  const referenceSolution = config.concepts.join(' + ');
  const gradingRules = `The answer must contain AT LEAST ${
    config.minimumRequired
  } of these concepts: ${config.concepts.join(
    ', '
  )}. Tolerate spelling errors (2-3 letter differences).`;

  const prompt = `You are a meticulous short-answer grader for Romanian religion class.

Rules:
- Judge ONLY using the reference solution and grading rubric below
- If the student mentions ${config.minimumRequired}+ required concepts → score = ${
    config.points
  }, decision = "correct"
- If fewer concepts → score = 0, decision = "incorrect"
- Tolerate spelling errors (2-3 letter differences)
- If you cannot find clear evidence in the student's answer, respond decision = "abstain" and score = 0
- Provide feedback in Romanian - be specific, educational, and constructive
- In "evidence" field, list which concepts you found or didn't find

Reference solution (required concepts):
${referenceSolution}

Grading rubric:
${gradingRules}

Accepted keywords for each concept:
${config.concepts.map((c) => `- ${c}: ${config.keywords[c].join(', ')}`).join('\n')}

Question asked:
"${stepData.question}"

Student's answer:
"${answer}"`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    messages: [
      {
        role: 'system',
        content: 'You are a precise grader. Provide only the JSON response. Do not add extra text.',
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
// EVALUARE GRILE (simplu, fără AI)
// ============================================

async function evaluateGrila(stepData, answer, isCorrect) {
  const score = isCorrect ? 2 : 0;

  const feedback = isCorrect
    ? 'Corect!'
    : `Răspunsul corect este: ${stepData.options[stepData.correct_answer]}`;

  return {
    score,
    is_correct: isCorrect,
    decision: isCorrect ? 'correct' : 'incorrect',
    feedback,
    evidence: `Răspuns ales: ${stepData.options[answer]}, Răspuns corect: ${
      stepData.options[stepData.correct_answer]
    }`,
  };
}

// ============================================
// FLOW PRINCIPAL EVALUARE
// ============================================

async function evaluateStep(stepData, answer, isCorrect) {
  // GRILĂ - evaluare simplă, fără AI
  if (stepData.type === 'grila') {
    return await evaluateGrila(stepData, answer, isCorrect);
  }

  // RĂSPUNS SCURT
  // Pas 1: Pre-validare deterministă
  const preValidation = preValidateAnswer(answer, stepData.step);

  if (preValidation && preValidation.autoValidated) {
    console.log('[AUTO-VALIDAT]', {
      step: stepData.step,
      answer: answer.substring(0, 50),
      evidence: preValidation.evidence,
    });
    return preValidation;
  }

  // Pas 2: Trimite la AI cu Structured Outputs
  console.log('[TRIMIT LA AI]', {
    step: stepData.step,
    answer: answer.substring(0, 50),
  });

  try {
    const aiResult = await evaluateWithAI(stepData, answer);

    // Verifică dacă AI-ul a răspuns "abstain"
    if (aiResult.decision === 'abstain') {
      console.log('[AI ABSTAIN] - AI nu a putut decide cu certitudine');
      return {
        score: 0,
        is_correct: false,
        decision: 'abstain',
        feedback: 'Nu am putut evalua răspunsul cu certitudine. Te rog reformulează mai clar.',
        evidence: 'Insufficient evidence in student answer',
      };
    }

    console.log('[AI EVALUAT]', {
      step: stepData.step,
      decision: aiResult.decision,
      score: aiResult.score,
    });

    return aiResult;
  } catch (error) {
    console.error('[EROARE AI]', error);
    throw error;
  }
}

// ============================================
// RAPORT FINAL (simplificat)
// ============================================

async function generateFinalReport(student, performanceData) {
  const { totalScore, maxScore } = performanceData;
  const percentage = (totalScore / maxScore) * 100;

  const prompt = `Create a brief final report in Romanian for a religion class student.

Student: ${student.name} ${student.surname}
Performance: ${totalScore}/${maxScore} points (${percentage.toFixed(1)}%)

Format (3 short sections):
**Puncte forte:** [What the student did well]
**De îmbunătățit:** [Constructive suggestions]
**Știai că...:** [One interesting fact related to the topic]

Be specific, constructive, and avoid clichés. Maximum 200 characters total.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content:
          'You are a concise religion teacher providing brief, specific feedback in Romanian.',
      },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices[0].message.content.trim();
}

// ============================================
// HANDLERS PENTRU REQUESTS
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
    const result = await evaluateStep(stepData, answer, isCorrect);

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
        evidence: result.evidence,
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
// EXPORT HANDLER PRINCIPAL
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
