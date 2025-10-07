// netlify/functions/worksheet-submit-tic-XII-hardware.js

const { GoogleGenAI } = require('@google/genai');
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================
// CONFIGURAȚII - MAPARE ÎNTREBĂRI
// ============================================

const EXPECTED_ANSWERS = {
  // Întrebarea 2 - Componente CPU (0-4 puncte)
  1: {
    question_type: 'components',
    concepts: [
      'UC',
      'Unitatea de Control',
      'UAL',
      'Unitatea Aritmetică și Logică',
      'coordonează execuția instrucțiunilor',
      'efectuează calculele',
    ],
    scoring_rubric: {
      0: 'Răspuns greșit sau lipsă completă de informații relevante',
      1: 'O singură componentă menționată fără rol',
      2: 'Ambele componente menționate dar fără roluri SAU o componentă cu rol corect',
      3: 'Ambele componente + un singur rol SAU distribuție parțială (ex: UC cu rol + UAL fără)',
      4: 'Ambele componente (UC și UAL) cu ambele roluri specificate corect',
    },
    reference_in_worksheet:
      "Secțiunea '1️⃣ Procesorul (CPU)': 'UC (Unitatea de Control) – coordonează execuția instrucțiunilor. UAL (Unitatea Aritmetică și Logică) – efectuează calculele.'",
    points: 4,
    requires_both_components: true,
  },

  // Întrebarea 4 - RAM (0-2 puncte)
  3: {
    question_type: 'definition',
    concepts: [
      'memorie temporară',
      'spațiu de lucru',
      'volatilă',
      'se golește la oprire',
      'pierde conținutul',
    ],
    scoring_rubric: {
      0: 'Răspuns greșit sau lipsă completă',
      1: 'Un singur concept menționat corect (ex: doar "temporară" sau doar "volatilă")',
      2: 'Minimum 2 concepte corecte menționate (ex: temporară + volatilă SAU spațiu lucru + se golește)',
    },
    reference_in_worksheet:
      "Secțiunea '2️⃣ Memoria RAM': 'Memoria RAM este acel spațiu temporar de lucru. Când oprești calculatorul, RAM-ul se golește (este volatilă).'",
    points: 2,
  },

  // Întrebarea 6 - HDD vs SSD (0-2 puncte)
  5: {
    question_type: 'comparison',
    concepts: [
      'HDD',
      'discuri metalice',
      'rotație',
      'părți mobile',
      'ac magnetic',
      'SSD',
      'cipuri electronice',
      'fără părți mobile',
      'memorie electronică',
    ],
    scoring_rubric: {
      0: 'Răspuns greșit sau lipsă completă',
      1: 'Menționează doar un tip de stocare SAU o singură diferență vagă',
      2: 'Menționează ambele tehnologii cu minimum o diferență tehnică clară pentru fiecare',
    },
    reference_in_worksheet:
      "Secțiunea '3️⃣ Stocarea (HDD / SSD)': 'HDD are discuri metalice care se învârt și un ac magnetic. SSD nu are părți care se mișcă; păstrează datele în cipuri electronice.'",
    points: 2,
  },

  // Întrebarea 7 - Nuclee procesor (0-2 puncte)
  6: {
    question_type: 'influence',
    concepts: [
      'nuclee',
      'sarcini simultane',
      'multitasking',
      'executare paralelă',
      'mai multe aplicații',
    ],
    scoring_rubric: {
      0: 'Răspuns greșit sau lipsă completă',
      1: 'Menționează nucleele dar fără legătură clară cu performanța',
      2: 'Explică corect legătura: mai multe nuclee = sarcini simultane/multitasking',
    },
    reference_in_worksheet:
      "Secțiunea '1️⃣ Procesorul (CPU)': 'Numărul de nuclee (cores) – arată câte sarcini pot fi executate simultan. Mai multe nuclee = multitasking mai bun.'",
    points: 2,
  },

  // Întrebarea 9 - Placă video (0-2 puncte)
  8: {
    question_type: 'comparison',
    concepts: [
      'integrată',
      'în procesor',
      'folosește RAM',
      'dedicată',
      'componentă separată',
      'VRAM propriu',
      'memorie proprie',
    ],
    scoring_rubric: {
      0: 'Răspuns greșit sau lipsă completă',
      1: 'Menționează doar un tip de placă video SAU o diferență incompletă',
      2: 'Menționează ambele tipuri (integrată vs dedicată) cu minimum o caracteristică pentru fiecare',
    },
    reference_in_worksheet:
      "Secțiunea '4️⃣ Placa video (GPU)': 'Placa integrată este inclusă în procesor, folosește RAM-ul sistemului. Placa dedicată este separată, cu memorie proprie (VRAM).'",
    points: 2,
  },

  // Întrebarea 11 - Comparație sisteme pentru jocuri (0-4 puncte)
  10: {
    question_type: 'system_comparison',
    concepts: [
      'S1',
      'Ryzen 7',
      'procesor superior',
      'placă video dedicată',
      'RTX 3060',
      '8GB VRAM',
      'SSD NVMe',
      'încărcare rapidă',
    ],
    scoring_rubric: {
      0: 'Răspuns greșit sau alege sistemul incorect',
      1: 'Alege S1 corect dar fără niciun argument tehnic valid',
      2: 'Alege S1 cu un singur argument tehnic valid (ex: doar procesor)',
      3: 'Alege S1 cu două argumente tehnice valide (ex: procesor + GPU)',
      4: 'Alege S1 cu trei argumente tehnice clare și complete (procesor + GPU + stocare)',
    },
    reference_in_worksheet:
      'Secțiunile despre toate componentele: procesor Ryzen 7 > i3, placă video dedicată pentru jocuri, SSD NVMe pentru viteză.',
    points: 4,
    requires_three_arguments: true,
  },
};

// ============================================
// EVALUARE RĂSPUNSURI SCURTE
// ============================================

async function evaluateShortAnswer(stepData, answer, student, stepIndex) {
  const config = EXPECTED_ANSWERS[stepIndex];

  if (!config) {
    throw new Error(`Nu există configurație pentru pasul ${stepIndex}`);
  }

  const prompt = `Ești profesor de TIC (Competențe digitale) și corectezi un test despre hardware și performanță cu SCORING PARȚIAL.

CONTEXT: Elevii au lecția completă cu toate răspunsurile. Aceasta este verificare de înțelegere pentru pregătirea BAC-ului.

ÎNTREBARE: "${stepData.question}"

UNDE SE GĂSEȘTE RĂSPUNSUL ÎN LECȚIE:
${config.reference_in_worksheet}

CONCEPTE NECESARE:
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

⭐ SISTEM DE PUNCTAJ PARȚIAL (0-${config.points} puncte):
${Object.entries(config.scoring_rubric)
  .map(([score, desc]) => `${score} puncte: ${desc}`)
  .join('\n')}

ELEV: ${student.name} ${student.surname} (Clasa XII)
RĂSPUNS: "${answer}"

REGULI EVALUARE:

1. ACORDĂ PUNCTAJ GRADUAL bazat pe rubrica de mai sus
   - Tolerează greșeli minore de ortografie (max 2 litere)
   - Ignoră diacriticele (ă=a, ș=s, ț=t, î=i)
   - Evaluează ce este prezent, nu ce lipsește
   - Creditează concepte tehnice corecte chiar dacă incomplete

2. EXEMPLE CONCRETE pentru acest tip de întrebare:

${
  config.question_type === 'components'
    ? `
   EXEMPLU 1: "UC și UAL"
   → 2 puncte (ambele componente, dar fără roluri)

   EXEMPLU 2: "UC coordonează și UAL face calcule"
   → 4 puncte (ambele componente + ambele roluri)

   EXEMPLU 3: "UC coordonează instrucțiunile"
   → 2 puncte (o componentă cu rol complet)

   EXEMPLU 4: "UC și UAL coordonează"
   → 2 puncte (ambele componente dar un singur rol parțial)`
    : ''
}

${
  config.question_type === 'comparison'
    ? `
   EXEMPLU 1: "HDD are discuri"
   → 1 punct (un singur tip menționat)

   EXEMPLU 2: "HDD are discuri, SSD are cipuri"
   → 2 puncte (ambele tipuri cu caracteristici)`
    : ''
}

${
  config.question_type === 'system_comparison'
    ? `
   EXEMPLU 1: "S1"
   → 1 punct (alegere corectă, fără argumente)

   EXEMPLU 2: "S1 are procesor mai bun"
   → 2 puncte (un argument)

   EXEMPLU 3: "S1 are Ryzen 7 și placă video RTX"
   → 3 puncte (două argumente)

   EXEMPLU 4: "S1 are Ryzen 7, RTX 3060, și SSD NVMe"
   → 4 puncte (trei argumente complete)`
    : ''
}

3. Nu penaliza:
   - Răspunsuri mai detaliate decât cerința minimă
   - Informații tehnice suplimentare corecte
   - Exemple concrete (ex: nume de procesoare)

4. FEEDBACK CONSTRUCTIV (în română, pentru elevi de liceu):

   Pentru orice punctaj:
   Format:

   [Emoji status] **Punctaj: X/${config.points} puncte**
   [Evaluare specifică - ce este corect]

   ${
     config.points > 2
       ? `
   💡 **Pentru punctaj maxim:**
   [Ce trebuie adăugat pentru a ajunge la ${config.points} puncte - specific și clar]
   `
       : ''
   }

   📖 **Revizuiește:**
   [Secțiunea exactă din lecție + ce concept lipsește]

   Emoji-uri pentru status:
   - 0 puncte: ❌
   - 1 punct (din 2): ⚠️
   - 1-2 puncte (din 4): ⚠️
   - 2 puncte (din 2): ✅
   - 3 puncte (din 4): 🔸
   - 4 puncte (din 4): ✅

5. Dacă ești nesigur → "abstain", score 0

Răspunde DOAR cu JSON în acest format exact:
{
  "is_correct": true (dacă score = max) sau false,
  "score": număr între 0 și ${config.points},
  "decision": "correct" sau "partial" sau "incorrect" sau "abstain",
  "concepts_found": ["concept1", "concept2"],
  "concepts_missing": ["concept3"],
  "feedback": "feedback tehnic în română, max 600 caractere"
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

    // Validare score în intervalul corect
    if (result.score < 0 || result.score > config.points) {
      console.warn(`Score invalid: ${result.score}, setat la 0`);
      result.score = 0;
    }

    // Ajustare decision bazat pe score
    if (result.score === config.points) {
      result.is_correct = true;
      result.decision = 'correct';
    } else if (result.score > 0) {
      result.is_correct = false;
      result.decision = 'partial';
    } else {
      result.is_correct = false;
      result.decision = 'incorrect';
    }

    return result;
  } catch (error) {
    console.error('[EROARE GEMINI]', error);
    throw error;
  }
}

// ============================================
// EVALUARE GRILE
// ============================================

async function evaluateGrila(stepData, answer, isCorrect, student) {
  const score = isCorrect ? stepData.points : 0;

  const prompt = `Ești profesor de TIC. Elevii au lecția despre hardware și performanță.

ÎNTREBARE GRILĂ: "${stepData.question}"

OPȚIUNI:
${stepData.options.map((opt, i) => `${i}. ${opt}`).join('\n')}

✅ RĂSPUNS CORECT: ${stepData.options[stepData.correct_answer]}
👤 ELEVUL A ALES: ${stepData.options[answer]}

ELEV: ${student.name} ${student.surname} (Clasa XII)

FEEDBACK TEHNIC (în română):

Dacă CORECT:
Format:
✅ **Corect!**

💡 **Extra info:**
[Un detaliu tehnic util pentru BAC - 1 propoziție]

Exemple:
- "La BAC poți compara procesoare după număr de nuclee și frecvență"
- "SSD NVMe este cel mai rapid tip de stocare disponibil"
- "Plăcile video dedicate au VRAM propriu și nu consumă din RAM"

Dacă INCORECT:
Format:
❌ **Incorect**
✅ **Corect era:** [răspunsul corect]
📖 [În ce secțiune din lecție se găsește - 1 propoziție]

Ton: profesional dar prietenos, specific pentru elevi de liceu care se pregătesc pentru BAC.
Max 400 caractere.`;

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

// ============================================
// FLOW PRINCIPAL
// ============================================

async function evaluateStep(stepData, answer, isCorrect, student, stepIndex) {
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
    const aiResult = await evaluateShortAnswer(stepData, answer, student, stepIndex);

    if (aiResult.decision === 'abstain') {
      console.log('[ABSTAIN]');
      return {
        score: 0,
        is_correct: false,
        decision: 'abstain',
        feedback:
          '⚠️ Răspunsul nu este suficient de clar. Revizuiește lecția și reformulează folosind termenii tehnici corecți.',
        concepts_found: [],
        concepts_missing: EXPECTED_ANSWERS[stepIndex]?.concepts || [],
      };
    }

    console.log('[EVALUAT]', {
      decision: aiResult.decision,
      score: aiResult.score,
      maxScore: stepData.points,
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

  const correctSteps = stepResults.filter((s) => s.score === s.maxPoints).length;
  const partialSteps = stepResults.filter((s) => s.score > 0 && s.score < s.maxPoints).length;
  const incorrectSteps = stepResults.filter((s) => s.score === 0).length;

  const prompt = `Creează un raport personalizat de evaluare pentru BAC TIC.

ELEV: ${student.name} ${student.surname} (Clasa XII)
PUNCTAJ FINAL: ${totalScore}/${maxScore} puncte (${percentage.toFixed(1)}%)

DISTRIBUȚIE:
- Răspunsuri complete: ${correctSteps}
- Răspunsuri parțiale: ${partialSteps}
- Răspunsuri incorecte: ${incorrectSteps}

TEMA: "Hardware & Performanță – CPU, RAM, Stocare, GPU"

Creează 3 secțiuni concise și utile (max 600 caractere total):

**✅ Puncte forte:**
[Ce componente hardware a înțeles bine - specific și tehnic]

**📚 De îmbunătățit:**
[Ce concepte trebuie completate pentru punctaj maxim - specific: unde să fie mai detaliat]

**🎯 Sfat pentru BAC:**
[Un sfat concret și motivant pentru pregătirea examenului - specific pentru hardware]

Ton: profesional, specific tehnic, motivant.
Menționează că răspunsurile parțiale arată înțelegere, dar trebuie completate cu detalii tehnice.`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return response.text.trim();
  } catch (error) {
    console.error('[EROARE GEMINI]', error);
    throw error;
  }
}

// ============================================
// HANDLERS
// ============================================

async function handleStepFeedback(requestData) {
  const { stepData, answer, student, isCorrect, stepIndex } = requestData;

  if (!stepData || answer === undefined || !student || stepIndex === undefined) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Date incomplete' }),
    };
  }

  try {
    const result = await evaluateStep(stepData, answer, isCorrect, student, stepIndex);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        score: result.score,
        feedback: result.feedback,
        maxPoints: stepData.points,
        isCorrect: result.is_correct,
        decision: result.decision, // poate fi: correct, partial, incorrect, abstain
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
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

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
