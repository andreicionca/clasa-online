// netlify/functions/worksheet-submit-religie-IX-biblia.js

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================
// JSON SCHEMA - FLEXIBLE SCORING
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
        enum: [0, 0.5, 1],
      },
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

// ============================================
// CONFIGURAȚII - EXACT DIN MATERIAL
// ============================================

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
    minimum_required: 2, // Moise + cel puțin 1 eveniment
    reference_in_worksheet:
      'Secțiunea "Povestea Bibliei": "Moise a început să scrie primele texte. Prima carte se numește Facerea (Geneza) și povestește începutul lumii, viața lui Adam și Eva, potopul lui Noe și alegerea lui Avraam."',
    points: 1,
    allow_partial: true, // Poate primi 0.5 dacă are doar Moise SAU doar 1 eveniment
  },
  3: {
    question_type: 'proper_name_or_date',
    concepts: ['Ioan', 'Apostolul Ioan', 'apostolul Ioan', 'Apocalipsa', '95 d.Hr.', '95'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Povestea Bibliei" și "Cum a fost scrisă": "Ultima carte, Apocalipsa, scrisă de Ioan în jurul anului 95 d.Hr." și "Ultima carte a fost scrisă de apostolul Ioan în jurul anului 95 d.Hr. – Apocalipsa."',
    points: 1,
    allow_partial: false, // Trebuie Ioan SAU Apocalipsa SAU data
  },
  4: {
    question_type: 'proper_name',
    concepts: ['P52', 'Papirusul P52', 'papirus P52', '120 d.Hr.', '120'],
    minimum_required: 1,
    reference_in_worksheet:
      'Secțiunea "Transmiterea": "Cel mai vechi fragment al Noului Testament este Papirusul P52, datat în jurul anului 120 d.Hr."',
    points: 1,
    allow_partial: false, // Trebuie P52 SAU data aproximativă
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
    minimum_required: 2, // Cel puțin 2 dintre: papirus, pergament
    reference_in_worksheet:
      'Secțiunea "Materialul": "s-a folosit papirusul, o „hârtie" obținută dintr-o plantă care creștea la Nil. Mai târziu s-a folosit și pergamentul (piele de animal)."',
    points: 1,
    allow_partial: true, // 0.5 dacă are doar papirus SAU pergament (nu ambele)
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
    concepts: [], // Nu există concepte fixe
    minimum_required: 0,
    reference_in_worksheet:
      'Întreaga fișă conține personaje biblice: Moise, Adam, Eva, Noe, Avraam, David, Iisus Hristos, Ioan, apostolii, profeții etc. Elevul poate menționa ORICE personaj biblic valid cu o descriere a unei povestiri.',
    points: 1,
    allow_partial: true, // 0.5 dacă menționează personaj dar descriere minimală
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

  // Special handling pentru întrebarea 9 (personaje biblice)
  if (stepData.step === 9) {
    const prompt = `You are a religion teacher grading a creative question about Biblical characters.

QUESTION: "${stepData.question}"

CONTEXT FROM WORKSHEET: Students learned about these Biblical characters:
${config.reference_in_worksheet}

STUDENT: ${student.name} ${student.surname}
ANSWER: "${answer}"

GRADING:

1. Is this a valid biblical character or story? (Check against known Biblical figures)
2. Did they provide a description or story details?

SCORING:
✓ Valid Biblical character/story + good description → 1 point
✓ Valid Biblical character/story + minimal description → 0.5 points
✗ Non-Biblical or completely wrong → 0 points

ACCEPT: Any character from Old or New Testament with at least some story context.

3. FEEDBACK (Romanian):

   If CORRECT (score = 1):
   Format:
   [Confirmare entuziastă specifică despre personajul/povestirea menționată - 1 propoziție]

   💡 **Știai că...?**
   [Un fapt interesant DIRECT RELEVANT despre personajul/povestirea menționată de elev - 1-2 propoziții cu detalii fascinante]

   If PARTIALLY CORRECT (score = 0.5):
   [Confirmare că personajul e valid + încurajare caldă să adauge mai multe detalii despre ce a făcut personajul sau despre povestire]

   If INCORRECT (score = 0):
   [Explicație blândă și prietenoasă că trebuie să fie personaj din Biblie + 2-3 exemple concrete: "De exemplu, ai putea scrie despre Moise și plecarea din Egipt, sau despre Iosif și visele sale."]

4. If uncertain about whether it's Biblical → "abstain", score 0`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      top_p: 1,
      messages: [
        {
          role: 'system',
          content:
            'You are an encouraging religion teacher who appreciates creative Biblical knowledge and helps students connect with sacred stories.',
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

  // Pentru toate celelalte întrebări
  const prompt = `You are a religion teacher grading a worksheet exercise about the Bible.

CONTEXT: Students have read the worksheet. They must find answers from the text.

QUESTION: "${stepData.question}"

WHERE TO FIND ANSWER IN WORKSHEET:
${config.reference_in_worksheet}

REQUIRED CONCEPTS (must identify ${config.minimum_required}):
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

STUDENT: ${student.name} ${student.surname}
ANSWER: "${answer}"

GRADING RULES:

1. IDENTIFY concepts in student's answer:
   - Tolerate spelling errors (2-3 letters difference)
   - Accept semantic equivalents:
     * "Moise" = "Profetul Moise"
     * "Facerea" = "Geneza"
     * "ebraică" = "limba ebraică" = "ebraica"
   - For dates: accept ±50 years (ex: 1400 = 1350-1450)
   - For names: ignore diacritics and case

2. COUNT how many required concepts found

3. APPLY SCORING:
   ${
     config.allow_partial
       ? `✓ ${config.minimum_required}+ concepts found → 1 point
   ✓ At least 1 concept found (but less than ${config.minimum_required}) → 0.5 points
   ✗ No correct concepts found → 0 points`
       : `✓ ${config.minimum_required}+ concepts found → 1 point
   ✗ Less than ${config.minimum_required} concepts → 0 points`
   }

4. DO NOT PENALIZE:
   - Extra correct information beyond required
   - Longer explanations or context
   - Additional Biblical details not asked

5. FEEDBACK (Romanian):

   If CORRECT (score = 1):
   Format:
   [Confirmare specifică entuziastă - 1 propoziție scurtă]

   💡 **Știai că...?**
   [Un fapt FASCINANT și DIRECT RELEVANT la conceptul din întrebare - 1-2 propoziții]

   Guidelines for "Știai că...?":
   - MUST be directly about the concept in the question
   - Educational and surprising
   - Based on Biblical/historical knowledge
   - Use emoji: 💡📖✨🕊️📜⛪🌟🔥
   - Keep it short and engaging

   If PARTIALLY CORRECT (score = 0.5):
   [Recunoaște specific ce au scris corect (menționează conceptul) + ghidare blândă către ce mai lipsește din materialul lor: "Verifică și..."]

   If INCORRECT (score = 0):
   - GUIDE specifically to the worksheet section where answer is found
   - Quote a relevant part from the reference text
   - Help them understand what to look for
   - Be warm and encouraging: "Găsești răspunsul în secțiunea..."

6. If uncertain → "abstain", score 0`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    top_p: 1,
    messages: [
      {
        role: 'system',
        content:
          'You are a fair and encouraging teacher who grades based on worksheet content and makes learning about the Bible engaging.',
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
  const score = isCorrect ? 1 : 0;

  const prompt = `You are a religion teacher. Students have the worksheet "Biblia – Cartea Cărților".

QUESTION: "${stepData.question}"

OPTIONS:
${stepData.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

CORRECT ANSWER: ${stepData.options[stepData.correct_answer]}
STUDENT SELECTED: ${stepData.options[answer]}

STUDENT: ${student.name} ${student.surname}

FEEDBACK (Romanian):

If CORRECT:
Format:
[Confirmare entuziastă și specifică - 1 propoziție scurtă]

💡 **Știai că...?**
[Un fapt FASCINANT și DIRECT RELEVANT despre conceptul din întrebare - 1-2 propoziții]

Guidelines:
- MUST relate directly to the question's specific topic
- Educational and surprising about the Bible
- Use appropriate emoji: 💡📖✨🕊️📜⛪🌟🔥
- Short (1-2 sentences max)

If INCORRECT:
- Guide warmly to the specific worksheet section (name it)
- Help them understand where to find the correct answer
- Quote relevant part if helpful
- Be encouraging and specific: "Verifică secțiunea despre..."`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    top_p: 1,
    max_tokens: 250,
    messages: [
      {
        role: 'system',
        content:
          'You are an encouraging teacher who makes learning about the Bible engaging and helps students find answers in their worksheet.',
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
      console.log('[ABSTAIN]', { step: stepData.step });
      return {
        score: 0,
        is_correct: false,
        decision: 'abstain',
        feedback:
          'Nu am putut evalua cu certitudine. Te rog verifică fișa de lucru și reformulează mai clar răspunsul.',
        concepts_found: [],
        concepts_missing: EXPECTED_ANSWERS[stepData.step]?.concepts || [],
      };
    }

    console.log('[EVALUAT]', {
      step: stepData.step,
      decision: aiResult.decision,
      score: aiResult.score,
      concepts_found: aiResult.concepts_found.length,
    });

    return aiResult;
  } catch (error) {
    console.error('[EROARE EVALUARE]', { step: stepData.step, error: error.message });
    throw error;
  }
}

// ============================================
// RAPORT FINAL
// ============================================

async function generateFinalReport(student, performanceData) {
  const { totalScore, maxScore, stepResults } = performanceData;
  const percentage = (totalScore / maxScore) * 100;

  const fullCorrect = stepResults.filter((s) => s.score === s.maxPoints).length;
  const partial = stepResults.filter((s) => s.score > 0 && s.score < s.maxPoints).length;
  const incorrect = stepResults.filter((s) => s.score === 0).length;

  const prompt = `Create a personalized final report in Romanian for a student who completed a worksheet about the Bible.

STUDENT: ${student.name} ${student.surname}
PERFORMANCE: ${totalScore}/${maxScore} points (${percentage.toFixed(1)}%)

BREAKDOWN:
- Full correct: ${fullCorrect} questions
- Partially correct: ${partial} questions
- Incorrect: ${incorrect} questions

WORKSHEET TOPIC: "Biblia – Cartea Cărților"
Topics covered: Bible's history, authors (Moise, prophets, apostles), languages (Hebrew, Aramaic, Greek), materials (papyrus, parchment), translations, and Biblical characters.

CREATE 4 SECTIONS (max 500 characters total):

**✨ Ce ți-a ieșit cel mai bine:**
[2-3 sentences about their specific strengths in Biblical knowledge - mention which areas they understood well]

**📖 Merită să aprofundezi:**
[2-3 sentences with concrete, positive suggestions about which specific topics to review from the worksheet - be specific to their weak areas]

**💡 Știai că...?:**
[1-2 sentences with a fascinating fact about the Bible + relevant emoji 📖✨🕊️]

**🎯 Pasul următor:**
[1-2 sentences with a practical, encouraging suggestion for continuing their Biblical learning]

GUIDELINES:
- Be warm, specific, and direct
- Avoid generic phrases
- Mention specific Biblical concepts they worked with
- Make it personal to their performance
- Keep encouraging tone throughout`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    top_p: 1,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'You are a caring religion teacher providing personalized, encouraging feedback about Biblical knowledge in Romanian.',
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
