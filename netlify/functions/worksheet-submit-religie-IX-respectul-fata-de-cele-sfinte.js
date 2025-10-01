// netlify/functions/worksheet-submit-religie-IX-respectul-fata-de-cele-sfinte.js

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================
// SECȚIUNEA 1: UTILITARE
// ============================================

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();
}

function preValidateAnswer(studentAnswer, acceptedAnswers, minimumRequired) {
  if (!acceptedAnswers || !Array.isArray(acceptedAnswers)) {
    return { matchedCount: 0, matchedAnswers: [], meetsMinimum: false };
  }

  const normalized = normalizeText(studentAnswer);

  const foundMatches = acceptedAnswers.filter((answer) => {
    return answer.keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
  });

  return {
    matchedCount: foundMatches.length,
    matchedAnswers: foundMatches.map((m) => m.name),
    meetsMinimum: foundMatches.length >= minimumRequired,
  };
}

// ============================================
// SECȚIUNEA 2: CONFIGURAȚII RĂSPUNSURI AȘTEPTATE
// ============================================

const EXPECTED_ANSWERS = {
  2: {
    // Muntele rugului aprins
    acceptedAnswers: [
      { keywords: ['Horeb', 'horeb'], name: 'Horeb' },
      { keywords: ['Sinai', 'sinai'], name: 'Sinai' },
    ],
    minimumRequired: 1,
    funFact:
      'Muntele Sinai se află în Peninsula Sinai - o zonă pustie unde Moise păștea oile. Azi e o destinație turistică cu mănăstiri vechi de secole. Tu te plângi când mergi cu autobuzul 30 de minute la școală!',
  },
  5: {
    // Sărbători de pelerinaj
    acceptedAnswers: [
      { keywords: ['Paste', 'Pesah', 'Pasti', 'paste', 'pesah'], name: 'Paștele' },
      {
        keywords: [
          'Cincizecimea',
          'Shavuot',
          'Savuot',
          'Șavuot',
          'Saptaman',
          'Rusalii',
          'cincizecimea',
          'shavuot',
        ],
        name: 'Cincizecimea',
      },
      {
        keywords: ['Corturilor', 'Sucot', 'Sukkot', 'Cort', 'corturilor', 'sucot'],
        name: 'Sărbătoarea Corturilor',
      },
    ],
    minimumRequired: 2,
    funFact:
      'La aceste trei sărbători, TOȚI evreii din întreaga țară veneau la Ierusalim - era ca un mega-festival religios de câteva ori pe an. Imaginează-ți orașul plin cu zeci de mii de pelerini!',
  },
  7: {
    // Orașul Templului
    acceptedAnswers: [
      { keywords: ['Ierusalim', 'Ierusalem', 'Jerusalem', 'ierusalim'], name: 'Ierusalim' },
    ],
    minimumRequired: 1,
    funFact:
      'Ierusalimul era și rămâne oraș sfânt pentru TREI religii: iudaism, creștinism și islam. E singurul oraș de pe pământ cu trei capitale spirituale în unul singur!',
  },
  9: {
    // Blasfemie
    acceptedAnswers: [
      {
        keywords: ['lipsa de respect', 'lipsă', 'jignire', 'ofensa', 'ofensă'],
        name: 'lipsă de respect',
      },
      { keywords: ['sfinte', 'sfânt', 'Dumnezeu', 'religie'], name: 'față de cele sfinte' },
    ],
    minimumRequired: 2,
    funFact:
      'În România, art. 29 din Constituție garantează libertatea religioasă și respectul între culte. Blasfemia nu e doar o chestiune religioasă, e și despre respectul civic față de credința altora!',
  },
};

// ============================================
// SECȚIUNEA 3: PROMPT-URI AI1 (EVALUATOR)
// ============================================

function buildGrilaPrompt(stepData, answer, isCorrect) {
  return `Tu ești profesor de religie care corectează o fișă de lucru.

ÎNTREBAREA: "${stepData.question}"

VARIANTE:
${stepData.options.map((opt, i) => `${i}. ${opt}`).join('\n')}

RĂSPUNS CORECT: ${stepData.options[stepData.correct_answer]}
RĂSPUNS ELEV: ${stepData.options[answer]}
REZULTAT: ${isCorrect ? 'CORECT ✓' : 'GREȘIT ✗'}

${
  isCorrect
    ? 'Confirmă scurt că răspunsul este corect și oferă un detaliu interesant.'
    : 'Explică scurt de ce răspunsul corect este cel adevărat.'
}

Format:
FEEDBACK:
- [confirmare/corectare]
- [explicație]
- [fun fact cu emoji]`;
}

function buildShortPrompt(stepData, answer, preValidation) {
  const config = EXPECTED_ANSWERS[stepData.step];

  if (!config) {
    return `Evaluează răspunsul elevului la: "${stepData.question}"
Răspuns: "${answer}"
Acordă punctaj între 0-2 și oferă feedback constructiv.`;
  }

  return `Tu ești profesor de religie care corectează o fișă de lucru.

ÎNTREBARE: "${stepData.question}"
RĂSPUNS ELEV: "${answer}"

PRE-ANALIZĂ: Identificat ${preValidation.matchedCount}/${
    config.minimumRequired
  } răspunsuri corecte: ${preValidation.matchedAnswers.join(', ') || 'niciunul'}

RĂSPUNSURI ACCEPTATE:
${config.acceptedAnswers.map((a) => `- ${a.name}`).join('\n')}

CRITERII:
- ${config.minimumRequired}+ răspunsuri corecte = 2 puncte
- Mai puțin = 0 puncte

IMPORTANT: Fii generos cu variații ortografice (elevul scrie de pe telefon).

Format:
PUNCTAJ: [0 sau 2]
FEEDBACK:
- [confirmare/corectare]
- [detaliu]
- [${config.funFact}]`;
}

// ============================================
// SECȚIUNEA 4: PROMPT AI2 (VERIFICATOR)
// ============================================

function buildVerificationPrompt(stepData, answer, ai1Result, preValidation) {
  const config = EXPECTED_ANSWERS[stepData.step];

  return `Verificator AI. Detectează DOAR erori flagrante.

RĂSPUNS ELEV: "${answer}"
EVALUARE AI1: ${ai1Result.score}/${stepData.points} puncte
PRE-VALIDARE: ${preValidation.matchedCount}/${config?.minimumRequired || 0} răspunsuri găsite

VERIFICĂ:
${
  preValidation.meetsMinimum && ai1Result.score === 0
    ? '⚠️ SUSPECT: Pre-validarea găsește răspunsuri corecte dar AI1 a dat 0 puncte'
    : '✓ Pare OK'
}

ACȚIUNE: [MENTINE/CORECTEAZA]
PUNCTAJ_FINAL: [0-${stepData.points}]
MOTIV: [doar dacă corectezi]`;
}

// ============================================
// SECȚIUNEA 5: APELURI AI
// ============================================

async function callAI(prompt, systemMessage, temperature = 0.6, maxTokens = 300) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices[0].message.content.trim();
}

async function evaluateWithAI1(stepData, answer, isCorrect, preValidation) {
  let prompt, systemMsg;

  if (stepData.type === 'grila') {
    prompt = buildGrilaPrompt(stepData, answer, isCorrect);
    systemMsg = 'Tu ești profesor de religie pentru elevi de liceu.';
  } else {
    prompt = buildShortPrompt(stepData, answer, preValidation);
    systemMsg =
      'Tu ești profesor de religie. Fii generos cu elevii care scriu de pe telefon și pot avea greșeli de tipar. Ai in vedere ca unii scriu cu diacritice iar alții nu.';
  }

  const aiText = await callAI(prompt, systemMsg, 0.7);

  // Parse
  if (stepData.type === 'grila') {
    return {
      score: isCorrect ? 2 : 0,
      feedback: aiText.replace(/^FEEDBACK:\s*/i, '').trim(),
    };
  } else {
    const punctajMatch = aiText.match(/PUNCTAJ:\s*([0-9]+)/i);
    const feedbackMatch = aiText.match(/FEEDBACK:\s*(.+)/is);

    return {
      score: punctajMatch ? parseInt(punctajMatch[1]) : 0,
      feedback: feedbackMatch ? feedbackMatch[1].trim() : aiText,
    };
  }
}

async function verifyWithAI2(stepData, answer, ai1Result, preValidation) {
  const prompt = buildVerificationPrompt(stepData, answer, ai1Result, preValidation);
  const aiText = await callAI(prompt, 'Tu ești verificator strict.', 0.3, 200);

  const actionMatch = aiText.match(/ACTIUNE:\s*(MENTINE|CORECTEAZA)/i);
  const punctajMatch = aiText.match(/PUNCTAJ_FINAL:\s*([0-9]+)/i);

  return {
    action: actionMatch ? actionMatch[1].toUpperCase() : 'MENTINE',
    correctedScore: punctajMatch ? parseInt(punctajMatch[1]) : ai1Result.score,
  };
}

// ============================================
// SECȚIUNEA 6: FLOW PRINCIPAL EVALUARE
// ============================================

async function evaluateStep(stepData, answer, isCorrect) {
  let preValidation = { matchedCount: 0, matchedAnswers: [], meetsMinimum: false };

  // Pre-validare doar pentru short answers
  if (stepData.type === 'short' && EXPECTED_ANSWERS[stepData.step]) {
    const config = EXPECTED_ANSWERS[stepData.step];
    preValidation = preValidateAnswer(answer, config.acceptedAnswers, config.minimumRequired);
  }

  // AI1 evaluează
  const ai1Result = await evaluateWithAI1(stepData, answer, isCorrect, preValidation);

  // Verifică dacă e suspect (doar pentru short)
  if (stepData.type === 'short') {
    const isSuspicious =
      (ai1Result.score === 0 && preValidation.meetsMinimum) ||
      (ai1Result.score === stepData.points && !preValidation.meetsMinimum);

    if (isSuspicious) {
      const verification = await verifyWithAI2(stepData, answer, ai1Result, preValidation);

      if (verification.action === 'CORECTEAZA') {
        return {
          score: verification.correctedScore,
          feedback: ai1Result.feedback + '\n\n✓ Punctaj verificat și ajustat',
          corrected: true,
        };
      }
    }
  }

  return {
    score: ai1Result.score,
    feedback: ai1Result.feedback,
    corrected: false,
  };
}

// ============================================
// SECȚIUNEA 7: RAPORT FINAL
// ============================================

function buildFinalReportPrompt(student, performanceData) {
  const { totalScore, maxScore } = performanceData;
  const percentage = (totalScore / maxScore) * 100;

  return `Tu ești profesor de religie prietenos. ${student.name} ${
    student.surname
  } a terminat activitatea.

PERFORMANȚĂ: ${totalScore}/${maxScore} puncte (${percentage.toFixed(1)}%)

Raport în 3 puncte:
- **Ce ți-a ieșit cel mai bine:** [puncte forte]
- **Merită să aprofundezi:** [sugestii pozitive]
- **Știai că…?:** [fapt interesant + emoji]


Maxim 2-3 propoziții per punct.`;
}

async function generateFinalReport(student, performanceData) {
  const prompt = buildFinalReportPrompt(student, performanceData);
  return await callAI(prompt, 'Tu ești profesor de religie inspirant.', 0.6, 400);
}

// ============================================
// SECȚIUNEA 8: HANDLERS
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
        corrected: result.corrected,
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
        error: 'Sistemul de feedback AI este temporar indisponibil.',
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
// SECȚIUNEA 9: EXPORT HANDLER
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
