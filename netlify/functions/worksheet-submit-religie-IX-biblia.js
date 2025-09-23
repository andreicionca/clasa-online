// netlify/functions/worksheet-submit-religie-IX-biblia.js
// Funcția AI specializată pentru feedback-ul activității "Biblia – Cartea Cărților"
// Sistem nou cu prompt-uri specifice și fragmente din textul sursă

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

FRAGMENTUL DIN TEXTUL DAT:
"Prima carte a fost scrisă de Moise în jurul anului 1400 î.Hr. – Facerea (Geneza)."

CRITERII DE PUNCTARE:
- 1 PUNCT: Menționează "1400 î.Hr." sau formulări echivalente (ex: secolul XIV î.Hr.)
- 0.5 PUNCTE: Perioada aproximativ corectă (1500-1300 î.Hr.) sau "Epoca lui Moise"
- 0 PUNCTE: Informații complet greșite

APRECIAZĂ dacă elevul citează din text sau demonstrează cunoștințe biblice proprii.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază sursa informațiilor - text și/sau cunoștințe proprii]
- [doar dacă sunt probleme reale]
- [întrebare reflexivă despre importanța acestei perioade]`;

    case 2: // Autor + evenimente
      return `Tu ești profesor de religie. Evaluezi răspunsul despre prima carte a Bibliei.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"un om numit Moise a început să scrie primele texte. Prima carte se numește Facerea (Geneza) și povestește începutul lumii, viața lui Adam și Eva, potopul lui Noe și alegerea lui Avraam."

CRITERII DE PUNCTARE:
- 1 PUNCT: Moise + minimum 2 evenimente biblice corecte din Geneza
- 0.5 PUNCTE: Moise + 1 eveniment SAU doar 2+ evenimente fără autor
- 0 PUNCTE: Informații lipsă sau greșite

EVENIMENTE BIBLICE VALIDE (din text sau cunoștințe proprii):
- Din text: începutul lumii, viața lui Adam și Eva, potopul lui Noe, alegerea lui Avraam
- Alte evenimente corecte din Geneza: Căderea în păcat, Turnul Babel, Povestea lui Iosif, Sacrificiul lui Avraam, etc.

APRECIAZĂ dacă elevul citează fidel din text SAU demonstrează cunoștințe biblice proprii.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază sursele de informații - text și/sau cunoștințe proprii]
- [doar dacă lipsesc informații esențiale]
- [întrebare reflexivă despre semnificația acestor evenimente]`;

    case 3: // Ultima carte
      return `Tu ești profesor de religie. Evaluezi răspunsul despre ultima carte a Bibliei.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"Ultima carte, Apocalipsa, scrisă de Ioan în jurul anului 95 d.Hr., arată prin imagini simbolice lupta dintre bine și rău și victoria finală a lui Dumnezeu."

CRITERII DE PUNCTARE:
- 1 PUNCT: Ioan/Apostolul Ioan + perioada corectă (95 d.Hr. sau similar)
- 0.5 PUNCTE: Ioan SAU perioada aproximativ corectă (80-110 d.Hr.)
- 0 PUNCTE: Informații în mare parte greșite

APRECIAZĂ dacă elevul citează din text sau demonstrează cunoștințe biblice proprii.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază sursa informațiilor - text și/sau cunoștințe proprii]
- [doar dacă sunt probleme reale]
- [întrebare reflexivă despre semnificația Apocalipsei]`;

    case 4: // Fragment vechi NT
      return `Tu ești profesor de religie. Evaluezi răspunsul despre cel mai vechi fragment al Noului Testament.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"Cel mai vechi fragment al Noului Testament este Papirusul P52, datat în jurul anului 120 d.Hr."

CRITERII DE PUNCTARE:
- 1 PUNCT: P52/Papirusul P52 + perioada corectă (120 d.Hr. sau similar)
- 0.5 PUNCTE: P52 SAU perioada aproximativ corectă (100-150 d.Hr.)
- 0 PUNCTE: Informații în mare parte greșite

APRECIAZĂ dacă elevul citează din text sau demonstrează cunoștințe despre manuscrise biblice.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază sursa informațiilor - text și/sau cunoștințe proprii]
- [doar dacă sunt probleme reale]
- [întrebare reflexivă despre importanța manuscriselor vechi]`;

    case 5: // Materiale scriere
      return `Tu ești profesor de religie. Evaluezi răspunsul despre materialele pe care se scriau textele biblice.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"Materialul: inițial s-a folosit papirusul, o „hârtie" obținută dintr-o plantă care creștea la Nil. Mai târziu s-a folosit și pergamentul (piele de animal)."

CRITERII DE PUNCTARE:
- 1 PUNKT: 2 materiale corecte + modurile de obținere (papirus din planta de la Nil, pergament din piele)
- 0.5 PUNCTE: 1-2 materiale corecte, dar fără toate detaliile despre obținere
- 0 PUNCTE: Informații în mare parte greșite

APRECIAZĂ dacă elevul citează din text sau cunoaște din alte surse materialele antice de scriere.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază sursa informațiilor - text și/sau cunoștințe proprii]
- [doar dacă lipsesc detalii importante]
- [întrebare reflexivă despre conservarea textelor antice]`;

    case 6: // Limbi Biblie
      return `Tu ești profesor de religie. Evaluezi răspunsul despre limbile în care a fost scrisă Biblia.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"Ebraica – limba poporului Israel, în care s-a scris majoritatea Vechiului Testament. Aramaica – limbă vorbită în Orientul Apropiat, prezentă în câteva fragmente. Greaca koiné – limba comună a secolului I, în care a fost scris Noul Testament."

CRITERII DE PUNCTARE:
- 1 PUNCT: 2 limbi corecte + secțiunile corespunzătoare (Ebraica-VT, Greaca -NT)
- 0.5 PUNCTE: 1-2 limbi corecte, dar fără toate asocierile cu secțiunile
- 0 PUNCTE: Informații în mare parte greșite

APRECIAZĂ dacă elevul citează din text sau cunoaște din alte surse limbile biblice.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază sursa informațiilor - text și/sau cunoștințe proprii]
- [doar dacă lipsesc asocieri importante]
- [întrebare reflexivă despre diversitatea lingvistică a Bibliei]`;

    case 7: // Număr cărți
      return `Tu ești profesor de religie. Evaluezi răspunsul despre numărul cărților din Biblie.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"În total, Biblia are 66 de cărți: 39 alcătuiesc Vechiul Testament, 27 alcătuiesc Noul Testament."

CRITERII DE PUNCTARE:
- 1 PUNCT: 66 cărți + împărțirea corectă (39 VT + 27 NT)
- 0.5 PUNCTE: Numărul total corect SAU împărțirea corectă
- 0 PUNCTE: Informații în mare parte greșite

APRECIAZĂ dacă elevul citează din text sau cunoaște din alte surse structura Bibliei.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază sursa informațiilor - text și/sau cunoștințe proprii]
- [doar dacă lipsesc detalii despre împărțire]
- [întrebare reflexivă despre unitatea dintre VT și NT]`;

    case 8: // Prima traducere română
      return `Tu ești profesor de religie. Evaluezi răspunsul despre prima traducere completă a Bibliei în română.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"Prima traducere completă în română a fost tipărită la București, în 1688."

CRITERII DE PUNCTARE:
- 1 PUNCT: București + 1688 (ambele informații corecte)
- 0.5 PUNCTE: București SAU 1688 (una dintre informații corectă)
- 0 PUNCTE: Ambele informații greșite

APRECIAZĂ dacă elevul citează din text sau cunoaște din alte surse istoria traducerilor biblice.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază sursa informațiilor - text și/sau cunoștințe proprii]
- [doar dacă lipsesc detalii importante]
- [întrebare reflexivă despre importanța traducerilor în limba națională]`;

    case 9: // Personaj biblic
      return `Tu ești profesor de religie. Evaluezi răspunsul despre un personaj sau povestire biblică.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"



CRITERII GENEROASE DE PUNCTARE:
- 1 PUNCT: Orice personaj sau povestire biblică validă + descriere relevantă (din cunoștințe proprii)
- 0.5 PUNCTE: Personaj biblic corect dar descrierea foarte vagă
- 0 PUNCTE: Personaj/povestire non-biblică sau informații complet greșite

APRECIAZĂ creativitatea și conexiunea personală cu textele biblice, indiferent de sursa informațiilor.

Răspunde EXACT:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [apreciază personajul ales și sursa cunoștințelor]
- [adaugă o perspectivă interesantă despre personaj dacă e cazul]
- [întrebare reflexivă despre relevanța personajului pentru elevul de azi]`;

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
      const prompt = buildShortPrompt(stepData, student, answer, exerciseConfig);

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 350,
        messages: [
          {
            role: 'system',
            content:
              'Tu ești profesor de religie pentru clasa a IX-a. Apreciază atât cunoștințele din text cât și cele proprii ale elevului.',
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

      const punctajMatch = aiText.match(/PUNCTAJ:\s*([0-9.]+)/i);
      const feedbackMatch = aiText.match(/FEEDBACK:\s*(.+)/is);

      if (punctajMatch) {
        score = parseFloat(punctajMatch[1]);
        score = Math.max(0, Math.min(score, 1));
        score = Math.round(score * 2) / 2;
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
            'Tu ești profesor de religie pentru clasa a IX-a. Oferă rapoarte finale inspirante și provocatoare.',
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
