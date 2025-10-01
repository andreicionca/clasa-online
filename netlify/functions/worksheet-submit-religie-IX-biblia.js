// netlify/functions/worksheet-submit-religie-IX-biblia.js

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
  1: {
    // An scriere Geneza
    acceptedAnswers: [
      {
        keywords: ['1400', '1500', '1300', 'secol XIV', 'secolul 14', 'Moise', 'moise'],
        name: '1400 î.Hr. sau epoca lui Moise',
      },
    ],
    minimumRequired: 1,
    context: 'Prima carte a fost scrisă de Moise în jurul anului 1400 î.Hr. – Facerea (Geneza).',
  },
  2: {
    // Autor + evenimente
    acceptedAnswers: [
      { keywords: ['Moise', 'moise'], name: 'Moise' },
      {
        keywords: [
          'inceputul lumii',
          'creatia',
          'facerea',
          'geneza',
          'adam',
          'eva',
          'potop',
          'noe',
          'avraam',
          'abraham',
          'turnul babel',
          'iosif',
          'sacrificiu',
        ],
        name: 'evenimente biblice din Geneza',
      },
    ],
    minimumRequired: 2, // Moise + min 1 eveniment
    context:
      'Moise a scris Geneza care povestește începutul lumii, Adam și Eva, potopul lui Noe și alegerea lui Avraam.',
  },
  3: {
    // Ultima carte
    acceptedAnswers: [
      { keywords: ['Ioan', 'ioan', 'apostol', 'Apostolul Ioan'], name: 'Ioan' },
      { keywords: ['95', '90', '100', 'secol I', 'primul secol'], name: '95 d.Hr.' },
    ],
    minimumRequired: 1,
    context: 'Ultima carte, Apocalipsa, scrisă de Ioan în jurul anului 95 d.Hr.',
  },
  4: {
    // Fragment vechi NT
    acceptedAnswers: [
      { keywords: ['P52', 'p52', 'papirus', 'Papirus P52'], name: 'Papirusul P52' },
      { keywords: ['120', '100', '150', 'secol II'], name: '120 d.Hr.' },
    ],
    minimumRequired: 1,
    context:
      'Cel mai vechi fragment al Noului Testament este Papirusul P52, datat în jurul anului 120 d.Hr.',
  },
  5: {
    // Materiale scriere
    acceptedAnswers: [
      { keywords: ['papirus', 'papirusul', 'planta', 'nil'], name: 'papirus din planta de la Nil' },
      {
        keywords: ['pergament', 'pergamentul', 'piele', 'animal'],
        name: 'pergament din piele de animal',
      },
    ],
    minimumRequired: 2,
    context: 'S-a folosit papirusul (din plantă de la Nil) și pergamentul (piele de animal).',
  },
  6: {
    // Limbi Biblie
    acceptedAnswers: [
      {
        keywords: ['ebraica', 'ebraică', 'ebraic', 'evreu', 'vechiul testament', 'VT'],
        name: 'ebraica pentru Vechiul Testament',
      },
      {
        keywords: ['aramaica', 'aramaică', 'aramaic'],
        name: 'aramaica',
      },
      {
        keywords: ['greaca', 'greacă', 'grec', 'koine', 'koiné', 'noul testament', 'NT'],
        name: 'greaca pentru Noul Testament',
      },
    ],
    minimumRequired: 2,
    context: 'Ebraica (VT), aramaica (fragmente), greaca koiné (NT) - limba comună a secolului I.',
  },
  8: {
    // Prima traducere română
    acceptedAnswers: [
      { keywords: ['Bucuresti', 'București', 'bucuresti'], name: 'București' },
      { keywords: ['1688', '1687', '1689'], name: '1688' },
    ],
    minimumRequired: 1,
    context: 'Prima traducere completă în română a fost tipărită la București, în 1688.',
  },
  9: {
    // Personaj biblic - orice personaj valid
    acceptedAnswers: null, // Se evaluează manual de AI
    minimumRequired: 0,
    context: 'Orice personaj sau povestire biblică validă.',
  },
};

// ============================================
// SECȚIUNEA 3: PROMPT-URI PENTRU GRILE
// ============================================

function buildGrilaPrompt(stepData, answer, isCorrect) {
  return `Tu ești profesor de religie care corectează o fișă de lucru despre Biblie.

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

Oferă o curiozitate interesantă legată de subiect. Fiecare elev merită un feedback personalizat.

Format:
FEEDBACK:
- [confirmare/corectare]
- [explicație]
- [curiozitate interesantă + emoji]`;
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

  // Pentru întrebarea 9 (personaje biblice) - orice personaj e valid
  if (stepData.step === 9) {
    return `Tu ești profesor de religie care corectează o fișă de lucru.

ÎNTREBARE: "${stepData.question}"
RĂSPUNS ELEV: "${answer}"

CONTEXT: ${config.context}

CRITERII:
- ${stepData.points} punct(e): Orice personaj sau povestire biblică validă + descriere scurtă
- 0.5 puncte: Personaj biblic corect dar descriere foarte vagă
- 0 puncte: Personaj/povestire non-biblică sau informații complet greșite

IMPORTANT: Apreciază creativitatea și conexiunea personală cu textele biblice. Acceptă cunoștințe din text DAR și cunoștințe proprii ale elevului.

Format:
PUNCTAJ: [0, 0.5, sau ${stepData.points}]
FEEDBACK:
- [confirmare personaj/povestire]
- [detaliu despre ce a menționat elevul]
- [curiozitate interesantă + emoji]`;
  }

  // Pentru celelalte întrebări cu răspunsuri specifice
  return `Tu ești profesor de religie care corectează o fișă de lucru.

ÎNTREBARE: "${stepData.question}"
RĂSPUNS ELEV: "${answer}"

CONTEXT DIN TEXT: ${config.context}

RĂSPUNSURI CORECTE:
${config.acceptedAnswers.map((a) => `- ${a.name}`).join('\n')}

CRITERII:
- ${config.minimumRequired} sau mai multe răspunsuri corecte = ${stepData.points} punct(e)
- Parțial corect = 0.5 puncte
- Lipsă informații = 0 puncte

IMPORTANT: Elevii scriu de pe telefon și pot avea greșeli de scriere. Dacă un cuvânt seamănă evident cu un răspuns corect (diferență de 1-3 litere, litere lipsă sau schimbate, fără diacritice), consideră-l corect. Gândește semantic: "La ce răspuns s-a referit elevul când a scris acest cuvânt?"

Apreciază atât cunoștințele din textul dat CÂT și cunoștințele proprii ale elevului despre Biblie.

Format:
PUNCTAJ: [0, 0.5, sau ${stepData.points}]
FEEDBACK:
- [confirmare/corectare - referă-te specific la ce a scris elevul]
- [detaliu despre conceptele menționate]
- [curiozitate interesantă + emoji]`;
}

// ============================================
// SECȚIUNEA 5: AL DOILEA EVALUATOR (control)
// ============================================

function buildEvaluator2Prompt(stepData, answer, evaluator1Result) {
  const config = EXPECTED_ANSWERS[stepData.step];

  if (!config || stepData.step === 9) {
    return `Tu ești al doilea evaluator. Verifică dacă punctajul ${evaluator1Result.score}/${stepData.points} este corect pentru răspunsul: "${answer}"

Menține sau corectează punctajul.

Format:
DECIZIE: [MENTIN/CORECTEZ]
PUNCTAJ_FINAL: [0, 0.5, sau ${stepData.points}]
ARGUMENTARE: [explică decizia]`;
  }

  return `Tu ești al doilea evaluator independent care verifică o corectare.

ÎNTREBARE: "${stepData.question}"
RĂSPUNS ELEV: "${answer}"

CONTEXT: ${config.context}

RĂSPUNSURI CORECTE:
${config.acceptedAnswers.map((a) => `- ${a.name}`).join('\n')}

EVALUAREA ANTERIOARĂ:
Punctaj acordat: ${evaluator1Result.score}/${stepData.points} puncte
Feedback: "${evaluator1Result.feedback}"

SARCINA TA:
Analizează INDEPENDENT răspunsul elevului. Ignoră evaluarea colegului și judecă singur:

1. Identifică fiecare cuvânt din răspunsul elevului
2. Pentru fiecare cuvânt: "Seamănă cu vreun răspuns corect?" (tolerează greșeli de scriere)
3. Numără câte răspunsuri corecte ai identificat
4. Acordă punctaj conform criteriilor

Dacă identifici ${config.minimumRequired}+ răspunsuri corecte = ${stepData.points} punct(e).
Dacă colegul a dat punctaj greșit → CORECTEAZĂ fără ezitare.

Format:
DECIZIE: [MENTIN/CORECTEZ]
PUNCTAJ_FINAL: [0, 0.5, sau ${stepData.points}]
ARGUMENTARE: [explică ce răspunsuri ai identificat și de ce menții sau corectezi]`;
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
      'Tu ești profesor de religie. Fii tolerant cu greșelile de scriere - elevii scriu de pe telefon. Apreciază atât cunoștințele din text cât și cunoștințele proprii.';
  }

  const aiText = await callAI(prompt, systemMsg, 0.7, 350);

  if (stepData.type === 'grila') {
    return {
      score: isCorrect ? 1 : 0,
      feedback: aiText.replace(/^FEEDBACK:\s*/i, '').trim(),
    };
  } else {
    const punctajMatch = aiText.match(/PUNCTAJ:\s*([0-9.]+)/i);
    const feedbackMatch = aiText.match(/FEEDBACK:\s*(.+)/is);

    let score = 0;
    if (punctajMatch) {
      score = parseFloat(punctajMatch[1]);
      score = Math.max(0, Math.min(score, stepData.points));
      score = Math.round(score * 2) / 2; // Rotunjire la 0, 0.5, 1
    }

    return {
      score: score,
      feedback: feedbackMatch ? feedbackMatch[1].trim() : aiText,
    };
  }
}

async function evaluateWithSecondEvaluator(stepData, answer, evaluator1Result) {
  const prompt = buildEvaluator2Prompt(stepData, answer, evaluator1Result);
  const systemMsg =
    'Tu ești al doilea evaluator independent. Analizează răspunsul cu atenție și corectează doar când e necesar.';

  const aiText = await callAI(prompt, systemMsg, 0.4, 350);

  const decizieMatch = aiText.match(/DECIZIE:\s*(MENTIN|CORECTEZ)/i);
  const punctajMatch = aiText.match(/PUNCTAJ_FINAL:\s*([0-9.]+)/i);
  const argumentareMatch = aiText.match(/ARGUMENTARE:\s*(.+)/is);

  let punctajFinal = evaluator1Result.score;
  if (punctajMatch) {
    punctajFinal = parseFloat(punctajMatch[1]);
    punctajFinal = Math.max(0, Math.min(punctajFinal, stepData.points));
    punctajFinal = Math.round(punctajFinal * 2) / 2;
  }

  return {
    decizie: decizieMatch ? decizieMatch[1].toUpperCase() : 'MENTIN',
    punctajFinal: punctajFinal,
    argumentare: argumentareMatch ? argumentareMatch[1].trim() : aiText,
  };
}

// ============================================
// SECȚIUNEA 7: FLOW PRINCIPAL EVALUARE
// ============================================

async function evaluateStep(stepData, answer, isCorrect) {
  // Pre-validare pentru debugging
  const config = EXPECTED_ANSWERS[stepData.step];

  if (config && config.acceptedAnswers) {
    const preCheck = preValidateAnswer(answer, config.acceptedAnswers, config.minimumRequired);
    console.log('[PRE-VALIDARE]', {
      step: stepData.step,
      question: stepData.question.substring(0, 50) + '...',
      answer: answer,
      matchedCount: preCheck.matchedCount,
      matchedAnswers: preCheck.matchedAnswers,
      meetsMinimum: preCheck.meetsMinimum,
    });
  }

  // PASUL 1: Primul evaluator corectează
  const evaluator1Result = await evaluateWithFirstEvaluator(stepData, answer, isCorrect);

  console.log('[EVALUATOR 1]', {
    step: stepData.step,
    punctaj: evaluator1Result.score,
    maxPoints: stepData.points,
  });

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
        evaluatedBy: 'evaluator2',
        correctionReason: evaluator2Result.argumentare,
      };
    } else {
      console.log('[MENȚINUT] Al doilea evaluator a confirmat punctajul inițial');

      return {
        score: evaluator1Result.score,
        feedback: evaluator1Result.feedback,
        evaluatedBy: 'evaluator1_confirmed',
      };
    }
  }

  // Grilele sau punctaj maxim la short
  return {
    score: evaluator1Result.score,
    feedback: evaluator1Result.feedback,
    evaluatedBy: 'evaluator1',
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

Activitate: "Biblia – Cartea Cărților"

Creează un raport personalizat în 4 puncte:

- **Ce ți-a ieșit cel mai bine:** [punctele forte ale elevului despre cunoștințele biblice]
- **Merită să aprofundezi:** [sugestii concrete și pozitive]
- **Știai că…?:** [fapt interesant legat de Biblie + emoji]
- **Pasul următor:** [sugestie practică pentru continuare]

Maxim 2-3 propoziții per punct. Fii direct, cald și specific, evită clișeele.`;
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
        evaluatedBy: result.evaluatedBy,
        correctionReason: result.correctionReason,
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
