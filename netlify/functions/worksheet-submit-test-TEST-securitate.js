// netlify/functions/submit-test-TEST-securitate.js
// Funcția AI specializată pentru feedback-ul activității de securitate digitală
// Gestionează atât feedback-ul per pas cât și raportul final

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Construiește prompt dinamic pentru întrebări cu grile
function buildGrilaPrompt(stepData, student, answer, isCorrect) {
  const basePrompt = `Ești un profesor de TIC specializat în securitate digitală pentru clasa XII. Răspunde în maxim 3 propoziții cu ton educativ și prietenos.

Elevul ${student.name} ${student.surname} a răspuns la întrebarea:
"${stepData.question}"

Opțiunile erau:
${stepData.options.map((opt, i) => `${i}. ${opt}`).join('\n')}

Răspuns corect: ${stepData.options[stepData.correct_answer]}
Răspuns elev: ${stepData.options[answer]}
Rezultat: ${isCorrect ? 'CORECT' : 'GREȘIT'}`;

  if (isCorrect) {
    return `${basePrompt}

Confirmă că răspunsul este corect și explică de ce această opțiune este cea mai bună pentru securitate digitală. Adaugă informații suplimentare utile despre acest concept.

RĂSPUNDE DOAR CU TEXTUL FEEDBACK-ULUI, FĂRĂ JSON SAU ALTE FORMATĂRI.`;
  } else {
    return `${basePrompt}

Explică de ce răspunsul corect este superior opțiunii alese de elev. Menționează riscurile sau dezavantajele opțiunii selectate greșit și oferă sfaturi practice.

RĂSPUNDE DOAR CU TEXTUL FEEDBACK-ULUI, FĂRĂ JSON SAU ALTE FORMATĂRI.`;
  }
}

// Construiește prompt dinamic pentru răspunsuri scurte
function buildShortPrompt(stepData, student, answer) {
  return `Ești un profesor de TIC specializat în securitate digitală pentru clasa XII. Evaluează răspunsul și oferă feedback în 3-4 propoziții cu ton încurajator și educativ.

Elevul ${student.name} ${student.surname} a răspuns la întrebarea:
"${stepData.question}"

Răspunsul elevului:
"${answer}"

Punctaj maxim disponibil: ${stepData.points} puncte

INSTRUCȚIUNI DE EVALUARE:
- Acordă punctaj între 0 și ${stepData.points} puncte
- Poți folosi valori cu 0.5 pentru răspunsuri parțial corecte
- Pentru răspunsuri incomplete dar corecte, oferă punctaj parțial generos
- Explică ce este bun în răspuns și ce ar putea fi îmbunătățit
- Oferă informații suplimentare relevante pentru securitatea digitală
- Fii constructiv și motivant în feedback

OBLIGATORIU - Răspunde EXACT în acest format:
PUNCTAJ: [numărul de puncte]
FEEDBACK: [textul feedback-ului educativ]`;
}

// Construiește prompt pentru raportul final global
function buildFinalReportPrompt(student, performanceData, allStepsData) {
  const { totalScore, maxScore, stepResults } = performanceData;
  const percentage = (totalScore / maxScore) * 100;

  return `Ești un profesor de TIC specializat în securitate digitală pentru clasa XII. Elevul ${
    student.name
  } ${student.surname} a terminat întreaga activitate despre securitate digitală.

PERFORMANȚA COMPLETĂ:

${stepResults
  .map(
    (step, index) => `
Pas ${index + 1} (${allStepsData[index].type}): "${allStepsData[index].question}"
Punctaj obținut: ${step.score}/${allStepsData[index].points}
Feedback individual: "${step.feedback.substring(0, 80)}..."
`
  )
  .join('')}

REZULTAT FINAL: ${totalScore}/${maxScore} puncte (${percentage.toFixed(1)}%)

INSTRUCȚIUNI PENTRU RAPORTUL FINAL:
- Oferă o analiză completă a performanței elevului la securitatea digitală
- Identifică punctele forte și domeniile care necesită îmbunătățire
- Oferă sfaturi concrete pentru dezvoltarea cunoștințelor de securitate
- Încurajează elevul și subliniază progresul făcut
- Raportul să fie în 4-5 propoziții, motivant și educativ
- Concentrează-te pe învățarea obținută, nu doar pe punctaj

RĂSPUNDE DOAR CU TEXTUL RAPORTULUI FINAL, FĂRĂ JSON SAU ALTE FORMATĂRI.`;
}

// Handler principal
exports.handler = async (event) => {
  // Verifică metoda HTTP
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
    console.error('Eroare parsare JSON:', parseError);
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

  // Rutare pe baza tipului de cerere
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

// Gestionează feedback-ul pentru un pas individual
async function handleStepFeedback(requestData) {
  const { stepData, answer, student, isCorrect } = requestData;

  // Validare date de intrare
  if (!stepData || answer === undefined || answer === null || !student) {
    console.error('Date incomplete pentru AI feedback pas:', {
      stepData: !!stepData,
      answer,
      student: !!student,
    });
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
      // Procesează întrebări cu grile
      if (isCorrect === undefined) {
        console.error('isCorrect lipsește pentru grila');
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: 'Informații incomplete pentru evaluarea grilei',
          }),
        };
      }

      // Calculează scorul automat pentru grile
      score = isCorrect ? stepData.points : 0;

      // Construiește prompt-ul dinamic
      const prompt = buildGrilaPrompt(stepData, student, answer, isCorrect);

      console.log('Apel OpenAI pentru grila:', {
        student: student.name,
        question: stepData.question.substring(0, 50) + '...',
      });

      // Apel către OpenAI
      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 250,
        messages: [
          {
            role: 'system',
            content:
              'Ești un profesor de TIC prietenos și competent specializat în securitate digitală. Oferă feedback educativ și util pentru elevii de clasa XII.',
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
      // Procesează răspunsuri scurte

      // Construiește prompt-ul dinamic
      const prompt = buildShortPrompt(stepData, student, answer);

      console.log('Apel OpenAI pentru răspuns scurt:', {
        student: student.name,
        question: stepData.question.substring(0, 50) + '...',
        answerLength: answer.length,
      });

      // Apel către OpenAI
      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 350,
        messages: [
          {
            role: 'system',
            content:
              'Ești un profesor de TIC care evaluează răspunsuri despre securitate digitală. Fii generos cu punctajele pentru răspunsuri parțial corecte și oferă feedback constructiv și motivant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const aiText = aiResponse.choices?.[0]?.message?.content?.trim();

      if (!aiText) {
        throw new Error('OpenAI nu a returnat răspuns valid pentru întrebarea scurtă');
      }

      // Extrage punctajul și feedback-ul din răspunsul AI
      const punctajMatch = aiText.match(/PUNCTAJ:\s*([0-9.]+)/i);
      const feedbackMatch = aiText.match(/FEEDBACK:\s*(.+)/is);

      if (punctajMatch) {
        score = parseFloat(punctajMatch[1]);
        // Validează scorul în limitele punctajului maxim
        score = Math.max(0, Math.min(score, stepData.points));
        // Rotunjește la 0.5 pentru consistență
        score = Math.round(score * 2) / 2;
      } else {
        console.error('Nu s-a găsit punctaj în răspunsul AI:', aiText);
        throw new Error('AI-ul nu a returnat punctaj în formatul așteptat');
      }

      if (feedbackMatch) {
        feedback = feedbackMatch[1].trim();
      } else {
        console.error('Nu s-a găsit feedback în răspunsul AI:', aiText);
        throw new Error('AI-ul nu a returnat feedback în formatul așteptat');
      }
    } else {
      // Tip de întrebare necunoscut
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

    // Verifică că am primit feedback valid
    if (!feedback || feedback.length < 10) {
      throw new Error('Feedback-ul AI este prea scurt sau invalid');
    }

    console.log('Feedback AI per pas generat cu succes:', {
      type: stepData.type,
      score: score,
      feedbackLength: feedback.length,
    });

    // Returnează succesul cu datele AI
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
        maxPoints: stepData.points,
        aiGenerated: true,
      }),
    };
  } catch (error) {
    // Log eroarea detailat pentru debugging
    console.error('Eroare AI feedback per pas:', {
      error: error.message,
      stack: error.stack,
      stepType: stepData?.type,
      student: student?.name,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    });

    // Returnează eroare explicită - NU fallback
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error:
          'Sistemul de feedback AI este temporar indisponibil. Te rugăm să încerci din nou în câteva momente.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}

// Gestionează raportul final global
async function handleFinalReport(requestData) {
  const { student, performanceData, allStepsData } = requestData;

  // Validare date de intrare
  if (!student || !performanceData || !allStepsData) {
    console.error('Date incomplete pentru raport final:', {
      student: !!student,
      performanceData: !!performanceData,
      allStepsData: !!allStepsData,
    });
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Date incomplete pentru generarea raportului final',
      }),
    };
  }

  try {
    // Construiește prompt-ul pentru raportul final
    const prompt = buildFinalReportPrompt(student, performanceData, allStepsData);

    console.log('Generez raport AI final pentru:', {
      student: student.name,
      totalScore: performanceData.totalScore,
      maxScore: performanceData.maxScore,
    });

    // Apel către OpenAI pentru raportul final
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'Ești un profesor de TIC experimentat și empatic, specializat în securitate digitală. Oferă rapoarte finale motivante și educative care să inspire elevii să continue să învețe.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const finalReport = aiResponse.choices?.[0]?.message?.content?.trim();

    if (!finalReport) {
      throw new Error('OpenAI nu a returnat raport final valid');
    }

    // Verifică că raportul are lungimea potrivită
    if (finalReport.length < 50) {
      throw new Error('Raportul final AI este prea scurt');
    }

    console.log('Raport final AI generat cu succes:', {
      student: student.name,
      reportLength: finalReport.length,
    });

    // Returnează succesul cu raportul final
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
    // Log eroarea detailat pentru debugging
    console.error('Eroare generare raport final AI:', {
      error: error.message,
      stack: error.stack,
      student: student?.name,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    });

    // Returnează eroare explicită - NU fallback
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error:
          'Sistemul de raport final AI este temporar indisponibil. Te rugăm să încerci din nou în câteva momente.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}
