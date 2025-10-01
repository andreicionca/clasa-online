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
  },
  5: {
    // Sărbători de pelerinaj
    acceptedAnswers: [
      { keywords: ['Paste', 'Pesah', 'Pasti', 'paste', 'pesah', 'pasti'], name: 'Paștele' },
      {
        keywords: [
          'Cincizecimea',
          'cincizecimea',
          'Shavuot',
          'shavuot',
          'Savuot',
          'savuot',
          'Șavuot',
          'Saptaman',
          'saptaman',
          'Saptamanilor',
          'Rusalii',
          'rusalii',
        ],
        name: 'Cincizecimea',
      },
      {
        keywords: [
          'Corturilor',
          'corturilor',
          'Sucot',
          'sucot',
          'Sukkot',
          'sukkot',
          'Cort',
          'cort',
        ],
        name: 'Sărbătoarea Corturilor',
      },
    ],
    minimumRequired: 2,
  },
  7: {
    // Orașul Templului
    acceptedAnswers: [
      {
        keywords: ['Ierusalim', 'ierusalim', 'Ierusalem', 'ierusalem', 'Jerusalem', 'jerusalem'],
        name: 'Ierusalim',
      },
    ],
    minimumRequired: 1,
  },
  9: {
    // Blasfemie
    acceptedAnswers: [
      {
        keywords: ['lipsa de respect', 'lipsă', 'jignire', 'jignirea', 'ofensa', 'ofensă'],
        name: 'lipsă de respect',
      },
      {
        keywords: ['sfinte', 'sfânt', 'sfant', 'Dumnezeu', 'dumnezeu', 'religie'],
        name: 'față de cele sfinte',
      },
    ],
    minimumRequired: 2,
  },
};

// ============================================
// SECȚIUNEA 3: PROMPT-URI PENTRU GRILE
// ============================================

function buildGrilaPrompt(stepData, answer, isCorrect) {
  return `Tu ești profesor de religie care corectează o fișă de lucru.

ÎNTREBAREA: "${stepData.question}"

VARIANTE:
${stepData.options.map((opt, i) => `${i}. ${opt}`).join('\n')}

RĂSPUNS CORECT: ${stepData.options[stepData.correct_answer]}
RĂSPUNS ELEV: ${stepData.options[answer]}
REZULTAT: ${isCorrect ? 'CORECT' : 'GREȘIT'}

${
  isCorrect
    ? 'Confirmă scurt că răspunsul este corect și oferă un detaliu interesant.'
    : 'Explică scurt de ce răspunsul corect este cel adevărat.'
}

La al treilea bullet point, oferă o curiozitate interesantă legată de subiect. Fiecare elev merită un feedback personalizat.

Format:
FEEDBACK:
- [confirmare/corectare]
- [explicație]
- [curiozitate interesantă]`;
}

// ============================================
// SECȚIUNEA 4: PRIMUL EVALUATOR (răspunsuri scurte)
// ============================================

function buildEvaluator1Prompt(stepData, answer) {
  const config = EXPECTED_ANSWERS[stepData.step];

  if (!config) {
    return `Evaluează răspunsul elevului la: "${stepData.question}"
Răspuns: "${answer}"
Acordă punctaj între 0-${stepData.points} și oferă feedback.`;
  }

  return `Tu ești profesor de religie care corectează o fișă de lucru.

ÎNTREBARE: "${stepData.question}"
RĂSPUNS ELEV: "${answer}"

RĂSPUNSURI CORECTE:
${config.acceptedAnswers.map((a) => `- ${a.name}`).join('\n')}

CRITERII:
- ${config.minimumRequired} sau mai multe răspunsuri corecte = ${stepData.points} puncte
- Mai puțin = 0 puncte

Elevii scriu de pe telefon și pot avea greșeli de scriere. Evaluează esența răspunsului.

Format:
PUNCTAJ: [0 sau ${stepData.points}]
FEEDBACK:
- [confirmare/corectare - referă-te specific la ce a scris elevul]
- [detaliu despre conceptele menționate]
- [curiozitate interesantă legată de răspuns]`;
}

// ============================================
// SECȚIUNEA 5: AL DOILEA EVALUATOR (control)
// ============================================

function buildEvaluator2Prompt(stepData, answer, evaluator1Result) {
  const config = EXPECTED_ANSWERS[stepData.step];

  return `Tu ești al doilea evaluator, care verifică independent o corectare făcută de un coleg.

ÎNTREBARE: "${stepData.question}"
RĂSPUNS ELEV: "${answer}"

RĂSPUNSURI CORECTE:
${config.acceptedAnswers.map((a) => `- ${a.name}`).join('\n')}

EVALUAREA COLEGULUI:
Punctaj acordat: ${evaluator1Result.score}/${stepData.points} puncte
Argumentație: "${evaluator1Result.feedback}"

SARCINA TA:
Analizează independent răspunsul elevului. Nu te ghida după evaluarea colegului - gândește singur:

1. Câte răspunsuri corecte a menționat elevul? (fii tolerant cu greșeli de scriere)
2. Evaluarea colegului a fost corectă sau a greșit?
3. Ce punctaj ar trebui acordat corect?

Dacă elevul a menționat ${config.minimumRequired} răspunsuri corecte = ${
    stepData.points
  } puncte, chiar dacă au greșeli de scriere.

Format:
DECIZIE: [MENTIN/CORECTEZ]
PUNCTAJ_FINAL: [0 sau ${stepData.points}]
ARGUMENTARE: [de ce menții sau corectezi evaluarea - explică clar]`;
}

// ============================================
// SECȚIUNEA 6: APELURI CĂTRE AI
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

async function evaluateWithFirstEvaluator(stepData, answer, isCorrect) {
  let prompt, systemMsg;

  if (stepData.type === 'grila') {
    prompt = buildGrilaPrompt(stepData, answer, isCorrect);
    systemMsg = 'Tu ești profesor de religie pentru elevi de liceu.';
  } else {
    prompt = buildEvaluator1Prompt(stepData, answer);
    systemMsg =
      'Tu ești profesor de religie. Fii rezonabil cu elevii care scriu de pe telefon și pot avea greșeli de tipar.';
  }

  const aiText = await callAI(prompt, systemMsg, 0.7, 350);

  // Parse răspuns
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

async function evaluateWithSecondEvaluator(stepData, answer, evaluator1Result) {
  const prompt = buildEvaluator2Prompt(stepData, answer, evaluator1Result);
  const systemMsg =
    'Tu ești al doilea evaluator independent. Corectezi doar când colegul tău a greșit clar.';

  const aiText = await callAI(prompt, systemMsg, 0.4, 300);

  const decizieMatch = aiText.match(/DECIZIE:\s*(MENTIN|CORECTEZ)/i);
  const punctajMatch = aiText.match(/PUNCTAJ_FINAL:\s*([0-9]+)/i);
  const argumentareMatch = aiText.match(/ARGUMENTARE:\s*(.+)/is);

  return {
    decizie: decizieMatch ? decizieMatch[1].toUpperCase() : 'MENTIN',
    punctajFinal: punctajMatch ? parseInt(punctajMatch[1]) : evaluator1Result.score,
    argumentare: argumentareMatch ? argumentareMatch[1].trim() : aiText,
  };
}

// ============================================
// SECȚIUNEA 7: FLOW PRINCIPAL EVALUARE
// ============================================

async function evaluateStep(stepData, answer, isCorrect) {
  // PASUL 1: Primul evaluator corectează
  const evaluator1Result = await evaluateWithFirstEvaluator(stepData, answer, isCorrect);

  // PASUL 2: Pentru răspunsuri scurte, al doilea evaluator verifică când nu e punctaj maxim
  if (stepData.type === 'short' && evaluator1Result.score < stepData.points) {
    console.log('[EVALUATOR 2] Punctaj sub maxim - trimit la al doilea evaluator:', {
      step: stepData.step,
      answer: answer,
      punctajEvaluator1: evaluator1Result.score,
      punctajMaxim: stepData.points,
    });

    const evaluator2Result = await evaluateWithSecondEvaluator(stepData, answer, evaluator1Result);

    if (evaluator2Result.decizie === 'CORECTEZ') {
      console.log('[CORECTAT] Al doilea evaluator a ajustat punctajul:', {
        punctajVechi: evaluator1Result.score,
        punctajNou: evaluator2Result.punctajFinal,
        argumentare: evaluator2Result.argumentare,
      });

      return {
        score: evaluator2Result.punctajFinal,
        feedback: evaluator1Result.feedback + '\n\n[Punctaj ajustat după reevaluare]',
        corrected: true,
      };
    } else {
      console.log('[MENȚINUT] Al doilea evaluator a confirmat punctajul inițial');
    }
  }

  return {
    score: evaluator1Result.score,
    feedback: evaluator1Result.feedback,
    corrected: false,
  };
}

// ============================================
// SECȚIUNEA 8: RAPORT FINAL
// ============================================

function buildFinalReportPrompt(student, performanceData) {
  const { totalScore, maxScore } = performanceData;
  const percentage = (totalScore / maxScore) * 100;

  return `Tu ești profesor de religie care cunoaște elevii personalizat.

Elevul: ${student.name} ${student.surname}
Performanță: ${totalScore}/${maxScore} puncte (${percentage.toFixed(1)}%)

Creează un raport personalizat în 3 puncte:

- **Ce ți-a ieșit cel mai bine:** [punctele forte ale elevului]
- **Merită să aprofundezi:** [sugestii concrete și pozitive]
- **Știai că…?:** [fapt interesant legat de subiect]

Maxim 2-3 propoziții per punct. Fii direct și specific, evită clișeele.`;
}

async function generateFinalReport(student, performanceData) {
  const prompt = buildFinalReportPrompt(student, performanceData);
  return await callAI(
    prompt,
    'Tu ești profesor de religie care oferă feedback personalizat fiecărui elev.',
    0.7,
    400
  );
}

// ============================================
// SECȚIUNEA 9: HANDLERS PENTRU REQUESTS
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
// SECȚIUNEA 10: EXPORT HANDLER PRINCIPAL
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
