// netlify/functions/worksheet-submit-tic-XII-securitate.js
// Funcția AI specializată pentru feedback-ul activității "Securitate – Viruși, Antivirus, Firewall"
// Simplificată - doar răspunsuri scurte

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Construiește prompt-uri specifice pentru fiecare întrebare despre securitate
function buildSecurityPrompt(stepData, student, answer, stepIndex) {
  const baseContext = `Tu ești profesor de TIC pentru clasa a XII-a. Evaluezi răspunsul despre securitatea informatică.

ÎNTREBAREA: "${stepData.question}"
RĂSPUNSUL ELEVULUI: "${answer}"`;

  switch (stepIndex) {
    case 0: // Categorii de virusi
      return `${baseContext}

CRITERII DE PUNCTARE (Total: 4 puncte):
- 2 categorii de viruși: 2p (1p fiecare)
- 2 efecte specifice: 2p (1p fiecare)

CATEGORII VALIDE: viruși de fișiere, viruși de boot sector
EFECTE SPECIFICE: aplicațiile nu mai pornesc sau rulează eronat, calculatorul nu mai pornește corect


Evaluează răspunsul și acordă punctaj între 0-4.

PUNCTAJ: [0-4]
FEEDBACK:
- [evaluare factual neutră]
- [explică ce lipsește sau confirmă corectitudinea]
- [Fun fact despre viruși + emoji]`;

    case 1: // Firewall rol și activare
      return `${baseContext}

CRITERII DE PUNCTARE (Total: 4 puncte):
- Rol firewall: 2p (controlează trafic, blochează accese neautorizate)
- Modalitate activare: 2p (Control Panel/Settings → Security → Firewall)

ROLURI VALIDE oricare: controlează traficul de intrare/ieșire, blochează accesul neautorizat, monitorizează conexiuni, protejează porturile
ACTIVĂRI VALIDE: Control Panel → Windows Security, Settings → Update & Security → Windows Security, click dreapta pe Network → Properties

Evaluează răspunsul și acordă punctaj între 0-4.

PUNCTAJ: [0-4]
FEEDBACK:
- [evaluare factual neutră]
- [explică ce lipsește sau confirmă corectitudinea]
- [Fun fact despre firewall + emoji]`;

    case 2: // Transmitere virusi și protecție
      return `${baseContext}

CRITERII DE PUNCTARE (Total: 4 puncte):
- 2 modalități transmitere: 2p (1p fiecare)
- 2 măsuri protecție: 2p (1p fiecare)

TRANSMITERE VALIDĂ: email attachments, USB infectate, download-uri nesigure, site-uri malițioase, rețele P2P, CD/DVD infectate
PROTECȚIE VALIDĂ: antivirus actualizat, firewall activ, evitare site-uri suspecte, scanare USB-uri, backup regulat, actualizări OS

Evaluează răspunsul și acordă punctaj între 0-4.

PUNCTAJ: [0-4]
FEEDBACK:
- [evaluare factual neutră]
- [explică ce lipsește sau confirmă corectitudinea]
- [Fun fact despre transmiterea virusilor + emoji]`;

    case 3: // Programe antivirus și operații
      return `${baseContext}

CRITERII DE PUNCTARE (Total: 5 puncte):
- 2 programe antivirus: 2p (1p fiecare)
- 3 operații la detectare: 3p (1p fiecare)

PROGRAME VALIDE: Bitdefender, Avast, AVG, Kaspersky, Norton, Windows Defender, ESET, McAfee
OPERAȚII VALIDE: carantină, ștergere, dezinfectare/curățare, restaurare, blocare acces, alertă utilizator, scanare completă

Evaluează răspunsul și acordă punctaj între 0-5.

PUNCTAJ: [0-5]
FEEDBACK:
- [evaluare factual neutră]
- [explică ce lipsește sau confirmă corectitudinea]
- [Fun fact despre programe antivirus + emoji]`;

    case 4: // Actualizare antivirus
      return `${baseContext}

CRITERII DE PUNCTARE (Total: 5 puncte):
- Argument actualizare: 2p (viruși noi apar zilnic, baza de date trebuie updatată)
- 3 programe antivirus: 3p (1p fiecare)

ARGUMENTE VALIDE: apar viruși noi zilnic, baza de date trebuie actualizată, detectarea celor mai noi amenințări, patches de securitate
PROGRAME VALIDE: Kaspersky, AVG, Norton, Bitdefender, Avast, ESET, McAfee, Windows Defender

Evaluează răspunsul și acordă punctaj între 0-5.

PUNCTAJ: [0-5]
FEEDBACK:
- [evaluare factual neutră]
- [explică ce lipsește sau confirmă corectitudinea]
- [Fun fact despre actualizările antivirus + emoji]`;

    case 5: // Protecție timp real
      return `${baseContext}

CRITERII DE PUNCTARE (Total: 3 puncte):
- Modalitate corectă protecție timp real: 3p

MODALITĂȚI VALIDE: activarea protecției în timp real din antivirus, Real-time protection ON, Live Guard activat, monitorizare continuă activată

Evaluează răspunsul și acordă punctaj între 0-3.

PUNCTAJ: [0-3]
FEEDBACK:
- [evaluare factual neutră]
- [explică ce lipsește sau confirmă corectitudinea]
- [Fun fact despre protecția în timp real + emoji]`;

    case 6: // Operații antivirus
      return `${baseContext}

CRITERII DE PUNCTARE (Total: 3 puncte):
- 3 operații la detectare: 3p (1p fiecare)

OPERAȚII VALIDE: ștergere fișiere infectate, carantinare fișiere suspecte, dezinfectare/curățare, restaurare, blocare acces, alertă utilizator, izolare

Evaluează răspunsul și acordă punctaj între 0-3.

PUNCTAJ: [0-3]
FEEDBACK:
- [evaluare factual neutră]
- [explică ce lipsește sau confirmă corectitudinea]
- [Fun fact despre operațiile antivirus + emoji]`;

    case 7: // Programe antivirus și necesitatea actualizării
      return `${baseContext}

CRITERII DE PUNCTAJE (Total: 4 puncte):
- 2 programe antivirus: 2p (1p fiecare)
- Explicație actualizare: 2p

PROGRAME VALIDE: Bitdefender, Avast, AVG, Kaspersky, Norton, Windows Defender, ESET, McAfee
EXPLICAȚII VALIDE: detectarea celor mai noi viruși, actualizarea bazei de date, protecție împotriva amenințărilor recente

Evaluează răspunsul și acordă punctaj între 0-4.

PUNCTAJ: [0-4]
FEEDBACK:
- [evaluare factual neutră]
- [explică ce lipsește sau confirmă corectitudinea]
- [Fun fact despre importanța actualizărilor + emoji]`;

    default:
      return `${baseContext}

Evaluează răspunsul despre securitatea informatică și acordă punctaj echitabil.
PUNCTAJ: [0-${stepData.points}]
FEEDBACK:
- [evaluare factual neutră]
- [explică ce lipsește sau confirmă corectitudinea]
- [Fun fact despre securitate + emoji]`;
  }
}

// Prompt pentru raportul final specializat pe securitate IT
function buildFinalSecurityReport(student, performanceData, exerciseConfig) {
  const finalScore = performanceData.totalScore;
  const maxScore = exerciseConfig.total_points || 32;
  const percentage = (finalScore / maxScore) * 100;

  return `Tu ești profesor de TIC prietenos și expert în securitate informatică. Elevul ${
    student.name
  } ${student.surname} din clasa a ${
    student.grade
  }-a a terminat testul despre "Securitate – Viruși, Antivirus, Firewall".

PERFORMANȚA: ${finalScore}/${maxScore} puncte (${percentage.toFixed(1)}%)

Oferă un raport final scurt și personalizat în 4 puncte cu bullet points:

- **🔒 Puncte forte în securitate:** [ce concepte de securitate a înțeles bine]
- **🛡️ Zone de îmbunătățit:** [aspecte care merită mai multă atenție, formulate constructiv]
- **💡 Știai că...?:** [un fapt interesant despre securitatea IT + emoji]
- **🚀 Recomandări practice:** [sfaturi concrete pentru siguranța online]

Fii direct, profesional dar prietenos, ca un profesor care își cunoaște elevii. Maxim 2 propoziții per punct.
Folosește terminologie IT precisă dar accesibilă pentru clasa a XII-a.

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
  const { stepData, answer, student, stepIndex, exerciseConfig } = requestData;

  if (!stepData || answer === undefined || answer === null || !student || stepIndex === undefined) {
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
    const prompt = buildSecurityPrompt(stepData, student, answer, stepIndex);

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'Tu ești profesor de TIC pentru clasa a XII-a, expert în securitatea informatică. Evaluezi răspunsurile elevilor cu profesionalism și încurajare.',
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

    // Extrage punctajul
    const punctajMatch = aiText.match(/PUNCTAJ:\s*([0-9.]+)/i);
    const feedbackMatch = aiText.match(/FEEDBACK:\s*(.+)/is);

    let score = 0;
    if (punctajMatch) {
      score = parseFloat(punctajMatch[1]);
      score = Math.max(0, Math.min(score, stepData.points || 5));
    } else {
      throw new Error('AI nu a returnat punctaj în formatul așteptat');
    }

    let feedback = '';
    if (feedbackMatch) {
      feedback = feedbackMatch[1].trim();
    } else {
      throw new Error('AI nu a returnat feedback în formatul așteptat');
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
        maxPoints: stepData.points || 5,
        aiGenerated: true,
      }),
    };
  } catch (error) {
    console.error('Eroare AI feedback:', {
      error: error.message,
      stepIndex: stepIndex,
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
  const { student, performanceData, exerciseConfig } = requestData;

  if (!student || !performanceData || !exerciseConfig) {
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
    const prompt = buildFinalSecurityReport(student, performanceData, exerciseConfig);

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'Tu ești profesor de TIC pentru clasa a XII-a, expert în securitatea informatică. Oferă rapoarte finale motivante și educative.',
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
