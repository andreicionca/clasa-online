// netlify/functions/worksheet-submit-tic-XII-hardware.js

const { GoogleGenAI } = require('@google/genai');
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================
// CONFIGURAȚII - MAPARE ÎNTREBĂRI
// ============================================

const EXPECTED_ANSWERS = {
  // Întrebarea 2 - Componente CPU
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
    minimum_required: 2,
    reference_in_worksheet:
      "Secțiunea '1️⃣ Procesorul (CPU)': 'UC (Unitatea de Control) – coordonează execuția instrucțiunilor. UAL (Unitatea Aritmetică și Logică) – efectuează calculele.'",
    points: 4,
    requires_both_components: true,
  },

  // Întrebarea 4 - RAM
  3: {
    question_type: 'definition',
    concepts: [
      'memorie temporară',
      'spațiu de lucru',
      'volatilă',
      'se golește la oprire',
      'pierde conținutul',
    ],
    minimum_required: 2,
    reference_in_worksheet:
      "Secțiunea '2️⃣ Memoria RAM': 'Memoria RAM este acel spațiu temporar de lucru. Când oprești calculatorul, RAM-ul se golește (este volatilă).'",
    points: 2,
  },

  // Întrebarea 6 - HDD vs SSD
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
    minimum_required: 3,
    reference_in_worksheet:
      "Secțiunea '3️⃣ Stocarea (HDD / SSD)': 'HDD are discuri metalice care se învârt și un ac magnetic. SSD nu are părți care se mișcă; păstrează datele în cipuri electronice.'",
    points: 2,
  },

  // Întrebarea 7 - Nuclee procesor
  6: {
    question_type: 'influence',
    concepts: [
      'nuclee',
      'sarcini simultane',
      'multitasking',
      'executare paralelă',
      'mai multe aplicații',
    ],
    minimum_required: 2,
    reference_in_worksheet:
      "Secțiunea '1️⃣ Procesorul (CPU)': 'Numărul de nuclee (cores) – arată câte sarcini pot fi executate simultan. Mai multe nuclee = multitasking mai bun.'",
    points: 2,
  },

  // Întrebarea 9 - Placă video
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
    minimum_required: 3,
    reference_in_worksheet:
      "Secțiunea '4️⃣ Placa video (GPU)': 'Placa integrată este inclusă în procesor, folosește RAM-ul sistemului. Placa dedicată este separată, cu memorie proprie (VRAM).'",
    points: 2,
  },

  // Întrebarea 11 - Comparație sisteme pentru jocuri
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
    minimum_required: 3,
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

  const prompt = `Ești profesor de TIC (Competențe digitale) și corectezi un test despre hardware și performanță.

CONTEXT: Elevii au lecția completă cu toate răspunsurile. Aceasta este verificare de înțelegere pentru pregătirea BAC-ului.

ÎNTREBARE: "${stepData.question}"

UNDE SE GĂSEȘTE RĂSPUNSUL ÎN LECȚIE:
${config.reference_in_worksheet}

CONCEPTE NECESARE (trebuie să identifice ${config.minimum_required}):
${config.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

${
  config.requires_both_components
    ? '⚠️ ATENȚIE: Trebuie să menționeze AMBELE componente și rolurile lor!'
    : ''
}
${config.requires_three_arguments ? '⚠️ ATENȚIE: Trebuie să enumere TREI argumente clare!' : ''}

ELEV: ${student.name} ${student.surname} (Clasa XII)
RĂSPUNS: "${answer}"

REGULI EVALUARE STRICTE (stil BAC):

1. Verifică dacă ${config.minimum_required}+ concepte tehnice sunt prezente și corecte
   - Tolerează greșeli minore de ortografie (max 2 litere)
   - Ignoră diacriticele (ă=a, ș=s, ț=t, î=i)
   - Pentru comparații: ambele aspecte trebuie menționate
   - Pentru componente: nume + rol pentru fiecare

2. SCORING BINAR (ca la BAC):
   ✓ Toate conceptele necesare + explicații clare → ${config.points} puncte
   ✗ Lipsesc concepte SAU explicații incomplete → 0 puncte

   Nu există punctaj parțial!

3. Nu penaliza:
   - Informații tehnice suplimentare corecte
   - Exemple concrete (ex: nume de procesoare)
   - Răspunsuri mai detaliate decât cerința minimă

4. FEEDBACK TEHNIC (în română, pentru elevi de liceu):

   Dacă CORECT (score = ${config.points}):
   Format:
   ✅ [Confirmare specifică tehnică - 1 propoziție]

   💡 **Extra info:**
   [Un detaliu tehnic util pentru BAC, legat direct de întrebare - 1-2 propoziții]

   Exemple de extra info:
   - Pentru CPU: "La BAC apar des comparații între i3/i5/i7 sau Ryzen 3/5/7"
   - Pentru RAM: "DDR5 este mai nouă decât DDR4, deci mai performantă"
   - Pentru stocare: "SSD NVMe este mai rapid decât SSD SATA"
   - Pentru GPU: "Plăcile dedicate se măsoară în GB VRAM"

   Dacă INCORECT (score = 0):
   Format:
   ❌ [Ce lipsește sau este greșit - specific]

   📖 **Unde găsești:**
   [Secțiunea exactă din lecție + ce trebuie să conțină răspunsul]

   💭 **Sfat:**
   [Un indiciu concret pentru a răspunde corect]

5. Dacă ești nesigur sau răspunsul este ambiguu → "abstain", score 0

Răspunde DOAR cu JSON în acest format exact:
{
  "is_correct": true sau false,
  "score": 0 sau ${config.points},
  "decision": "correct" sau "incorrect" sau "abstain",
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

    return JSON.parse(jsonMatch[0]);
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
✅ [Confirmare scurtă]

💡 **Extra info:**
[Un detaliu tehnic util pentru BAC - 1 propoziție]

Exemple:
- "La BAC poți compara procesoare după număr de nuclee și frecvență"
- "SSD NVMe este cel mai rapid tip de stocare disponibil"
- "Plăcile video dedicate au VRAM propriu și nu consumă din RAM"

Dacă INCORECT:
Format:
❌ [Ce a greșit]
✅ Corect: [răspunsul corect]
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
      step: stepIndex, // acum avem indexul
      student: `${student.name} ${student.surname}`,
      isCorrect,
    });
    return await evaluateGrila(stepData, answer, isCorrect, student);
  }

  console.log('[RĂSPUNS SCURT]', {
    step: stepIndex, // și aici
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
        concepts_missing: EXPECTED_ANSWERS[stepData.step]?.concepts || [],
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

  const prompt = `Creează un raport personalizat de evaluare pentru BAC TIC.

ELEV: ${student.name} ${student.surname} (Clasa XII)
PUNCTAJ FINAL: ${totalScore}/${maxScore} puncte (${percentage.toFixed(1)}%)
Răspunsuri corecte: ${correctSteps} | Răspunsuri incorecte: ${incorrectSteps}

TEMA: "Hardware & Performanță – CPU, RAM, Stocare, GPU"

Creează 3 secțiuni concise și utile (max 500 caractere total):

**✅ Puncte forte:**
[Ce componente hardware a înțeles bine - specific și tehnic]

**📚 De revizuit:**
[Care secțiuni din lecție trebuie recitite - specific: CPU/RAM/Stocare/GPU]

**🎯 Sfat pentru BAC:**
[Un sfat concret și motivant pentru pregătirea examenului]

Ton: profesional, specific tehnic, motivant.
Fii direct și util - e pentru pregătire BAC, nu pentru note generale.`;

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
