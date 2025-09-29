// netlify/functions/worksheet-submit-religie-IX-respectul-fata-de-cele-sfinte.js
// Funcția AI specializată pentru feedback-ul activității "Respectul față de cele sfinte"

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Construiește prompt specific pentru întrebări cu grile
function buildGrilaPrompt(stepData, student, answer, isCorrect, exerciseConfig) {
  return `Tu ești profesor de religie. Evaluezi răspunsul unui elev la o întrebare cu variante multiple despre sfințenie și respectul față de cele sfinte.

ÎNTREBAREA: "${stepData.question}"

TOATE VARIANTELE:
${stepData.options.map((opt, i) => `${i}. ${opt}`).join('\n')}

RĂSPUNS CORECT: ${stepData.options[stepData.correct_answer]}
RĂSPUNS ELEV: ${stepData.options[answer]}
REZULTAT: ${isCorrect ? 'CORECT' : 'GREȘIT'}

${
  isCorrect
    ? 'Confirmă scurt că răspunsul este corect.'
    : 'Explică scurt de ce răspunsul corect este cel adevărat.'
}

Fii concis - maxim 1 propoziție per bullet point.

Răspunde EXACT în formatul:
FEEDBACK:
- [confirmare/corectare factuală]
- [explicație scurtă]
- [curiositate amuzantă + emoji]

RĂSPUNDE DOAR CU TEXTUL FEEDBACK-ULUI.`;
}

// Construiește prompt-uri specifice pentru răspunsuri scurte
function buildShortPrompt(stepData, student, answer, exerciseConfig) {
  const stepNumber = stepData.step;

  switch (stepNumber) {
    case 2: // Muntele rugului aprins
      return `Tu ești profesor de religie. Evaluezi răspunsul despre muntele unde Moise a văzut rugul aprins.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"pe când evreii erau sclavi în Egipt, un om pe nume Moise păștea oile socrului său pe lângă Muntele Horeb / Sinai (în Peninsula Sinai, azi Egipt)"

CRITERII DE PUNCTARE:
- 2 PUNCTE: "Horeb" SAU "Sinai" SAU "Horeb/Sinai" (oricare dintre aceste variante)
- 0 PUNCTE: Orice alt munte sau răspuns greșit

IMPORTANT: Acceptă și variații minore de scriere (ex: "muntele Sinai", "Horeb", "pe Sinai").

Răspunde EXACT:
PUNCTAJ: [0 sau 2]
FEEDBACK:
- [confirmare/corectare]
- [detaliu din text]
- [Fun fact: Muntele Sinai se află în Peninsula Sinai - o zonă pustie unde Moise păștea oile. Azi e o destinație turistică cu mănăstiri vechi de secole. Tu te plângi când mergi cu autobuzul 30 de minute la școală!]`;

    case 5: // Două sărbători de pelerinaj
      return `Tu ești profesor de religie. Evaluezi răspunsul despre sărbătorile evreiești de pelerinaj.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"cele trei mari sărbători de pelerinaj la Ierusalim – Paștele (Pesah), Cincizecimea (Shavuot) și Sărbătoarea Corturilor (Sucot)"

CRITERII DE PUNCTARE:
- 2 PUNCTE: Menționează CORECT cel puțin 2 sărbători din cele 3
- 0 PUNCTE: Mai puțin de 2 sărbători corecte

SĂRBĂTORI VALIDE (acceptă orice variantă):
- Paștele / Pesah / Pasti
- Cincizecimea / Shavuot / Rusalii
- Sărbătoarea Corturilor / Sucot / Corturilor

IMPORTANT:
- Verifică cu atenție dacă elevul menționează DOUĂ sărbători diferite
- Acceptă variații de scriere
- NU accepta sărbători care nu sunt de pelerinaj (ex: Hanuka, Yom Kippur)

Răspunde EXACT:
PUNCTAJ: [0 sau 2]
FEEDBACK:
- [confirmare/corectare]
- [detaliu despre sărbătorile menționate]
- [Cool fact: La aceste trei sărbători, TOȚI evreii din întreaga țară veneau la Ierusalim - era ca un mega-festival religios de câteva ori pe an. Imaginează-ți orașul plin cu zeci de mii de pelerini!]`;

    case 7: // Orașul Templului
      return `Tu ești profesor de religie. Evaluezi răspunsul despre orașul unde se afla Templul.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"Era sărbătoarea Paștelui, iar Ierusalimul fremăta de pelerini veniți din toate colțurile țării. Templul – considerat de evrei „locul cel mai sfânt de pe pământ""

CRITERII DE PUNCTARE:
- 2 PUNCTE: "Ierusalim" (acceptă și variații de scriere: Ierusalem, Jerusalem)
- 0 PUNCTE: Orice alt oraș

IMPORTANT: Acceptă și greșeli minore de scriere dacă este clar că se referă la Ierusalim.

Răspunde EXACT:
PUNCTAJ: [0 sau 2]
FEEDBACK:
- [confirmare/corectare]
- [detaliu despre Ierusalim]
- [Detaliu fascinant: Ierusalimul era și rămâne oraș sfânt pentru TREI religii: iudaism, creștinism și islam. E singurul oraș de pe pământ cu trei capitale spirituale în unul singur!]`;

    case 9: // Blasfemie
      return `Tu ești profesor de religie. Evaluezi răspunsul despre semnificația cuvântului "blasfemie".

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"

FRAGMENTUL DIN TEXTUL DAT:
"Lipsa de respect față de cele sfinte prin vorbe sau fapte se numește blasfemie."
"Blasfemie – lipsă de respect gravă, prin vorbe sau fapte, față de ceea ce este sfânt."

CRITERII DE PUNCTARE (STRICTE):
- 2 PUNCTE: Menționează clar "lipsă de respect" SAU "jignire" ȘI specifică "față de cele sfinte" SAU "față de ce este sfânt" SAU "față de Dumnezeu"
- 1 PUNCT: Menționează doar "lipsă de respect" sau "ofensă" fără a specifica CE anume (cele sfinte/Dumnezeu)
- 0 PUNCTE: Definiție complet greșită sau lipsă

EXEMPLE DE RĂSPUNSURI CORECTE (2 PUNCTE):
- "lipsă de respect față de cele sfinte"
- "jignirea lui Dumnezeu"
- "ofensă gravă față de religie"
- "lipsă de respect gravă față de ce este sfânt"

EXEMPLE DE RĂSPUNSURI PARȚIALE (1 PUNCT):
- "lipsă de respect" (fără a specifica față de ce)
- "o ofensă gravă" (fără context religios)

IMPORTANT: Dacă răspunsul conține AMBELE elemente (lipsă respect + față de sfânt), acordă 2 PUNCTE complet, chiar dacă formularea nu este perfectă.

Răspunde EXACT:
PUNCTAJ: [0, 1 sau 2]
FEEDBACK:
- [confirmare/corectare]
- [clarificare definiție dacă e cazul]
- [Important: În România, art. 29 din Constituție garantează libertatea religioasă și respectul între culte. Blasfemia nu e doar o chestiune religioasă, e și despre respectul civic față de credința altora!]`;
  }
}

// Prompt pentru raportul final
function buildFinalReportPrompt(student, performanceData, allStepsData, exerciseConfig) {
  const finalScore = performanceData.totalScore;
  const maxScore = 18;
  const percentage = (finalScore / maxScore) * 100;

  return `Tu ești profesor de religie prietenos. Elevul ${student.name} ${
    student.surname
  } a terminat activitatea "Respectul față de cele sfinte".

PERFORMANȚA: ${finalScore}/${maxScore} puncte (${percentage.toFixed(1)}%)

Oferă un raport final scurt și personal în 4 puncte cu bullet points:

- **Ce ți-a ieșit cel mai bine:** [ce cunoștințe despre sfințenie a demonstrat solid]
- **Merită să aprofundezi:** [aspecte de explorat, formulate pozitiv]
- **Știai că…?:** [un fapt interesant legat de subiect + emoji]
- **Pasul următor:** [o sugestie practică și personală pentru continuare]

Fii cald, direct și folosește limbajul de profesor care își cunoaște elevii. Maxim 2-3 propoziții per punct.

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
      score = isCorrect ? 2 : 0;

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
              'Tu ești profesor de religie pentru clasa a IX-a. Evaluează strict conform criteriilor date.',
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

      const punctajMatch = aiText.match(/PUNCTAJ:\s*([0-9]+)/i);
      const feedbackMatch = aiText.match(/FEEDBACK:\s*(.+)/is);

      if (punctajMatch) {
        score = parseInt(punctajMatch[1]);
        score = Math.max(0, Math.min(score, 2));
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
        maxPoints: 2,
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
