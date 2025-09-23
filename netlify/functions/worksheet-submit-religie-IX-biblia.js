// netlify/functions/worksheet-submit-religie-IX-biblia.js
// Funcția AI specializată pentru feedback-ul activității "Biblia – Cartea Cărților"
// Sistem nou cu prompt-uri specifice pentru fiecare întrebare

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Construiește prompt specific pentru întrebări cu grile
function buildGrilaPrompt(stepData, student, answer, isCorrect, exerciseConfig) {
  return `Tu ești profesor de religie. Evaluezi răspunsul unui elev la o întrebare cu variante multiple despre Biblie.

ÎNTREBAREA: "${stepData.question}"

TOATE VARIANTELE:
${stepData.options.map((opt, i) => `${i}. ${opt}`).join('\n')}

RĂSPUNS CORECT: ${stepData.options[stepData.correct_answer]}
RĂSPUNS ELEV: ${stepData.options[answer]}
REZULTAT: ${isCorrect ? 'CORECT' : 'GREȘIT'}

${
  isCorrect
    ? 'Confirmă că răspunsul este corect și explică importanța acestei informații pentru înțelegerea Bibliei.'
    : 'Explică cu răbdare de ce răspunsul corect este cel adevărat și oferă informații care să-l ajute pe elev să înțeleagă.'
}

FORMATARE:
- [ce a făcut bine elevul]
- [ce ar putea îmbunătăți, dacă e cazul]
- [încurajare/sfat/întrebare reflexivă]

RĂSPUNDE DOAR CU TEXTUL FEEDBACK-ULUI.`;
}

// Construiește prompt-uri specifice pentru răspunsuri scurte
function buildShortPrompt(stepData, student, answer, exerciseConfig) {
  const stepNumber = extractStepNumber(stepData.question);

  switch (stepNumber) {
    case 1: // An scriere Geneza
      return `Tu ești profesor de religie. Evaluezi răspunsul despre când a fost scrisă prima carte a Bibliei.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

CRITERII DE PUNCTARE:
- 1 PUNCT: Menționează "1400 î.Hr." sau "secolul XIV î.Hr." (cu variații acceptabile)
- 0.5 PUNCTE: Perioada aproximativ corectă (1500-1300 î.Hr. sau "Epoca lui Moise")
- 0 PUNCTE: Perioada complet greșită

FII GENEROS în interpretare - dacă elevul înțelege ideea principală, nu penaliza pentru formulări.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [ce a făcut bine elevul]
- [ce ar putea îmbunătăți, dacă e cazul]
- [încurajare/sfat/întrebare reflexivă]`;

    case 2: // Autor + evenimente
      return `Tu ești profesor de religie. Evaluezi răspunsul despre prima carte a Bibliei.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

CRITERII DE PUNCTARE:
- 1 PUNCT: Moise + minimum 2 evenimente din Geneza
- 0.5 PUNCTE: Moise + 1 eveniment SAU doar 2+ evenimente corecte fără autor
- 0 PUNCTE: Lipsesc majoritatea elementelor sau sunt greșite

EVENIMENTE VALIDE DIN GENEZA (acceptă orice formulare):
- Crearea lumii/începutul lumii/facerea/creația
- Viața lui Adam și Eva/crearea omului/primul om
- Potopul lui Noe/potopul/arca lui Noe
- Alegerea lui Avraam/chemarea lui Avraam
- Turnul Babel, Căderea în păcat, Povestea lui Iosif

FII GENEROS în interpretare - dacă elevul înțelege ideea principală, nu penaliza pentru formulări.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [ce a făcut bine elevul]
- [ce ar putea îmbunătăți, dacă e cazul]
- [încurajare/sfat/întrebare reflexivă]`;

    case 3: // Ultima carte
      return `Tu ești profesor de religie. Evaluezi răspunsul despre ultima carte a Bibliei.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

CRITERII DE PUNCTARE:
- 1 PUNCT: Ioan/Apostolul Ioan + perioada corectă (90-100 d.Hr.)
- 0.5 PUNCTE: Ioan SAU perioada aproximativ corectă (80-110 d.Hr.)
- 0 PUNCTE: Ambele informații greșite

FII GENEROS în interpretare - dacă elevul înțelege ideea principală, nu penaliza pentru formulări.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [ce a făcut bine elevul]
- [ce ar putea îmbunătăți, dacă e cazul]
- [încurajare/sfat/întrebare reflexivă]`;

    case 4: // Fragment vechi NT
      return `Tu ești profesor de religie. Evaluezi răspunsul despre cel mai vechi fragment al Noului Testament.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

CRITERII DE PUNCTARE:
- 1 PUNCT: P52/Papirusul P52 + perioada corectă (120 d.Hr.)
- 0.5 PUNCTE: P52 SAU perioada aproximativ corectă (100-150 d.Hr.)
- 0 PUNCTE: Informații în mare parte greșite

FII GENEROS în interpretare - dacă elevul înțelege ideea principală, nu penaliza pentru formulări.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [ce a făcut bine elevul]
- [ce ar putea îmbunătăți, dacă e cazul]
- [încurajare/sfat/întrebare reflexivă]`;

    case 5: // Materiale scriere
      return `Tu ești profesor de religie. Evaluezi răspunsul despre materialele pe care se scriau textele biblice.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

CRITERII DE PUNCTARE:
- 1 PUNCT: 2 materiale corecte + modurile de obținere (Papirus din planta de la Nil, Pergament din piele)
- 0.5 PUNCTE: 1-2 materiale corecte, dar fără toate detaliile despre obținere
- 0 PUNCTE: Informații în mare parte greșite

FII GENEROS în interpretare - dacă elevul înțelege ideea principală, nu penaliza pentru formulări.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [ce a făcut bine elevul]
- [ce ar putea îmbunătăți, dacă e cazul]
- [încurajare/sfat/întrebare reflexivă]`;

    case 6: // Limbi Biblie
      return `Tu ești profesor de religie. Evaluezi răspunsul despre limbile în care a fost scrisă Biblia.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

CRITERII DE PUNCTARE:
- 1 PUNCT: 2 limbi corecte + secțiunile corespunzătoare (Ebraica-VT, Greaca koiné-NT)
- 0.5 PUNCTE: 1-2 limbi corecte, dar fără toate asocierile cu secțiunile
- 0 PUNCTE: Informații în mare parte greșite

LIMBI ACCEPTABILE: Ebraica (VT), Greaca/Greaca koiné (NT), Aramaica (părți din VT)

FII GENEROS în interpretare - dacă elevul înțelege ideea principală, nu penaliza pentru formulări.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [ce a făcut bine elevul]
- [ce ar putea îmbunătăți, dacă e cazul]
- [încurajare/sfat/întrebare reflexivă]`;

    case 7: // Număr cărți
      return `Tu ești profesor de religie. Evaluezi răspunsul despre numărul cărților din Biblie.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

CRITERII DE PUNCTARE:
- 1 PUNCT: 66 cărți + împărțirea corectă (39 VT + 27 NT)
- 0.5 PUNCTE: Numărul total corect SAU împărțirea corectă
- 0 PUNCTE: Informații în mare parte greșite

FII GENEROS în interpretare - dacă elevul înțelege ideea principală, nu penaliza pentru formulări.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [ce a făcut bine elevul]
- [ce ar putea îmbunătăți, dacă e cazul]
- [încurajare/sfat/întrebare reflexivă]`;

    case 8: // Prima traducere română
      return `Tu ești profesor de religie. Evaluezi răspunsul despre prima traducere completă a Bibliei în română.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

CRITERII DE PUNCTARE:
- 1 PUNCT: București + 1688 (ambele informații corecte)
- 0.5 PUNCTE: București SAU 1688 (una dintre informații corectă)
- 0 PUNCTE: Ambele informații greșite

FII GENEROS în interpretare - dacă elevul înțelege ideea principală, nu penaliza pentru formulări.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [ce a făcut bine elevul]
- [ce ar putea îmbunătăți, dacă e cazul]
- [încurajare/sfat/întrebare reflexivă]`;

    case 9: // Personaj biblic
      return `Tu ești profesor de religie. Evaluezi răspunsul despre un personaj sau povestire biblică.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

CRITERII GENEROASE DE PUNCTARE:
- 1 PUNCT: Orice personaj sau povestire biblică validă + scurtă descriere relevantă
- 0.5 PUNCTE: Personaj biblic corect dar descrierea foarte vagă sau incompletă
- 0 PUNCTE: Personaj/povestire non-biblică sau informații complet greșite

PERSONAJE/POVESTIRI BIBLICE VALIDE: Isus, Moise, David, Avraam, Noe, Maria, apostolii, profeții, Facerea, Exodul, pildele, minunile, etc.

FII FOARTE GENEROS - scopul este să-și amintească ceva din Biblie și să demonstreze conexiunea spirituală!

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [ce a făcut bine elevul - apreciază personajul ales]
- [adaugă ceva interesant despre personaj dacă e cazul]
- [încurajare spirituală/întrebare reflexivă]`;

    default:
      return `Tu ești profesor de religie. Evaluezi răspunsul: "${answer}"

Acordă punctaj echitabil între 0, 0.5 și 1.
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază efortul]
- [oferă ghidaj]
- [încurajare]`;
  }
}

// Funcție helper pentru identificarea întrebării
function extractStepNumber(question) {
  if (question.includes('În jurul cărui an')) return 1;
  if (question.includes('autorul primei cărți')) return 2;
  if (question.includes('ultima carte a Bibliei')) return 3;
  if (question.includes('cel mai vechi fragment')) return 4;
  if (question.includes('materialele pe care erau scrise')) return 5;
  if (question.includes('două limbi în care')) return 6;
  if (question.includes('Câte cărți are Biblia')) return 7;
  if (question.includes('prima traducere completă')) return 8;
  if (question.includes('povestire sau un personaj')) return 9;
  return 1; // fallback
}

// Prompt pentru raportul final
function buildFinalReportPrompt(student, performanceData, allStepsData, exerciseConfig) {
  const finalScore = performanceData.totalScore;
  const maxScore = 9;
  const percentage = (finalScore / maxScore) * 100;

  return `Tu ești profesor de religie. Elevul ${student.name} ${
    student.surname
  } a terminat activitatea "Biblia – Cartea Cărților".

PERFORMANȚA ELEVULUI:
${performanceData.stepResults
  .map((step, index) => `Întrebarea ${index + 1}: ${step.score}/1 punct`)
  .join('\n')}

REZULTAT FINAL: ${finalScore}/${maxScore} puncte (${percentage.toFixed(1)}%)

Oferă un raport final în 4 puncte, fiind autentic și provocator în abordare:

- DESCOPERIRI ȘI REVELAȚII: Ce și-a dat seama elevul despre Biblie prin această activitate? Ce conexiuni neașteptate a făcut?

- CĂLĂTORIA SPIRITUALĂ: Unde se află acum în înțelegerea sa față de unde a început? Ce transformare observi în gândirea lui?

- PROVOCĂRI PENTRU VIITOR: Ce întrebări mari ar trebui să-și pună despre credință și Scriptură? Către ce mister biblic să se îndrepte cu curiozitate?

- CHEMAREA PERSONALĂ: Cum poate transforma aceste cunoștințe în trăire autentică? Ce i-ar schimba perspectiva asupra vieții de zi cu zi?

Fii direct, profund și evită clișeele. Vorbește ca un mentor spiritual care vede potențialul din elev.

RĂSPUNDE DOAR CU TEXTUL RAPORTULUI FINAL.`;
}

// Handler principal
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed',
      }),
    };
  }

  let requestData;
  try {
    requestData = JSON.parse(event.body || '{}');
  } catch (parseError) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Date JSON invalide',
      }),
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Tip de cerere invalid',
      }),
    };
  }
};

// Gestionează feedback pentru o sarcină individuală
async function handleStepFeedback(requestData) {
  const { stepData, answer, student, isCorrect, exerciseConfig } = requestData;

  if (!stepData || answer === undefined || answer === null || !student || !exerciseConfig) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Date incomplete pentru procesarea AI',
      }),
    };
  }

  try {
    let feedback = '';
    let score = 0;

    if (stepData.type === 'grila') {
      // Pentru întrebări cu grile - punctajul este automat calculat
      score = isCorrect ? 1 : 0;

      const prompt = buildGrilaPrompt(stepData, student, answer, isCorrect, exerciseConfig);

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 250,
        messages: [
          {
            role: 'system',
            content:
              'Tu ești profesor de religie pentru clasa a IX-a. Oferă feedback educativ și spiritual.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      feedback = aiResponse.choices?.[0]?.message?.content?.trim();

      if (!feedback) {
        throw new Error('OpenAI nu a returnat feedback valid pentru grila');
      }
    } else if (stepData.type === 'short') {
      // Pentru răspunsuri scurte - AI calculează punctajul
      const prompt = buildShortPrompt(stepData, student, answer, exerciseConfig);

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 350,
        messages: [
          {
            role: 'system',
            content:
              'Tu ești profesor de religie pentru clasa a IX-a. Fii generos în punctare și oferă feedback constructiv.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const aiText = aiResponse.choices?.[0]?.message?.content?.trim();

      if (!aiText) {
        throw new Error('OpenAI nu a returnat răspuns valid');
      }

      // Extrage punctajul și feedback-ul
      const punctajMatch = aiText.match(/PUNCTAJ:\s*([0-9.]+)/i);
      const feedbackMatch = aiText.match(/FEEDBACK:\s*(.+)/is);

      if (punctajMatch) {
        score = parseFloat(punctajMatch[1]);
        score = Math.max(0, Math.min(score, 1));
        score = Math.round(score * 2) / 2; // Rotunjire la 0.5
      } else {
        throw new Error('AI nu a returnat punctaj în formatul așteptat');
      }

      if (feedbackMatch) {
        feedback = feedbackMatch[1].trim();
      } else {
        throw new Error('AI nu a returnat feedback în formatul așteptat');
      }
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: `Tip de întrebare nesuportat: ${stepData.type}`,
        }),
      };
    }

    if (!feedback || feedback.length < 10) {
      throw new Error('Feedback AI prea scurt sau invalid');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        feedback: feedback,
        score: score,
        maxPoints: 1,
        aiGenerated: true,
      }),
    };
  } catch (error) {
    console.error('Eroare AI feedback:', {
      error: error.message,
      stepType: stepData?.type,
      student: student?.name,
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Sistemul de feedback AI este temporar indisponibil.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}

// Gestionează raportul final
async function handleFinalReport(requestData) {
  const { student, performanceData, allStepsData, exerciseConfig } = requestData;

  if (!student || !performanceData || !allStepsData) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Date incomplete pentru raportul final',
      }),
    };
  }

  try {
    const prompt = buildFinalReportPrompt(student, performanceData, allStepsData, exerciseConfig);

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'Tu ești profesor de religie pentru clasa a IX-a. Oferă rapoarte finale inspirante.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const finalReport = aiResponse.choices?.[0]?.message?.content?.trim();

    if (!finalReport || finalReport.length < 50) {
      throw new Error('OpenAI nu a returnat raport final valid');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        finalReport: finalReport,
        aiGenerated: true,
      }),
    };
  } catch (error) {
    console.error('Eroare raport final AI:', {
      error: error.message,
      student: student?.name,
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Sistemul de raport final AI este temporar indisponibil.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}
