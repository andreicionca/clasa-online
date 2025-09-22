// netlify/functions/worksheet-submit-religie-IX-biblia.js
// Funcția AI specializată pentru feedback-ul activității "Biblia – Cartea Cărților"
// Gestionează atât feedback-ul per sarcină cât și raportul final

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Contextul complet al răspunsurilor corecte pentru evaluarea AI
const CORRECT_ANSWERS_CONTEXT = {
  1: {
    question: 'În jurul cărui an a fost scrisă prima carte a Bibliei, Facerea (Geneza)?',
    correct: '1400 î.Hr.',
    context:
      'Prima carte a Bibliei, Facerea (Geneza), a fost scrisă de Moise în jurul anului 1400 î.Hr., în timpul peregrinării prin pustie.',
  },
  2: {
    question:
      'Precizați autorul primei cărți a Bibliei, Facerea (Geneza), și enumerați două evenimente importante relatate de el în această carte.',
    correct: 'Moise; exemple: Crearea lumii și a omului, Potopul lui Noe, Alegerea lui Avraam',
    context:
      'Autorul este Moise. Evenimente importante includ: Crearea lumii și a omului (Geneza 1-2), Potopul lui Noe (Geneza 6-9), Alegerea lui Avraam (Geneza 12), Povestea lui Iosif, Căderea în păcat, Turnul Babel.',
  },
  3: {
    question: 'Cine a scris ultima carte a Bibliei și în ce perioadă?',
    correct: 'Apostolul Ioan, în jurul anului 95 d.Hr.',
    context:
      'Ultima carte a Bibliei, Apocalipsa (Revelația), a fost scrisă de Apostolul Ioan în jurul anului 95 d.Hr., în timpul exilului său pe insula Patmos.',
  },
  4: {
    question: 'Care este cel mai vechi fragment al Noului Testament descoperit până astăzi?',
    correct: 'Papirusul P52, datat în jurul anului 120 d.Hr.',
    context:
      'Papirusul P52 este cel mai vechi fragment al Noului Testament, datat în jurul anului 120 d.Hr. și conține versete din Evanghelia după Ioan.',
  },
  5: {
    question:
      'Enumerați materialele pe care erau scrise textele biblice în Antichitate și precizați, pentru fiecare, modul de obținere.',
    correct:
      'Papirus – obținut din planta care creștea la Nil; Pergament – realizat din piele de animal',
    context:
      'Materialele principale erau: Papirusul - obținut din planta de papirus care creștea pe malurile Nilului în Egipt, și Pergamentul - realizat din piele de animal (oaie, capră, vițel) prelucrata special pentru scriere.',
  },
  6: {
    question:
      'Menționați două limbi în care au fost redactate părți ale Bibliei și indicați la ce secțiune aparțin.',
    correct: 'Ebraica – Vechiul Testament; Greaca koiné – Noul Testament',
    context:
      'Limbile principale: Ebraica - majoritatea Vechiului Testament, Greaca koiné - întreg Noul Testament. De asemenea, Aramaica apare în fragmente din Vechiul Testament (Ezra, Daniel).',
  },
  7: {
    question: 'Câte cărți are Biblia în total și cum sunt împărțite?',
    correct: '66 de cărți – 39 în Vechiul Testament și 27 în Noul Testament',
    context:
      'Biblia protestantă conține 66 de cărți: 39 în Vechiul Testament și 27 în Noul Testament. Biblia catolică conține cărți suplimentare (deuterocanonice).',
  },
  8: {
    question:
      'În ce an și unde a fost tipărită prima traducere completă a Bibliei în limba română?',
    correct: 'București, în anul 1688',
    context:
      "Prima traducere completă a Bibliei în limba română a fost tipărită la București în anul 1688, cunoscută ca 'Biblia de la București' sau 'Biblia lui Șerban Cantacuzino'.",
  },
  9: {
    question:
      'Menționați o povestire sau un personaj biblic pe care îl cunoașteți și prezentați pe scurt ce vă amintiți despre acesta.',
    correct: 'Răspuns liber - orice personaj sau povestire biblică validă',
    context:
      'Răspunsuri acceptabile includ: Isus Hristos, Moise, David, Avraam, Noe, Maria, apostolii, sau povestiri ca Facerea, Exodul, Pilda Bunului Samaritean, Învierea lui Lazăr, etc.',
  },
};

// Construiește prompt dinamic pentru întrebări cu grile
function buildGrilaPrompt(stepData, student, answer, isCorrect, exerciseConfig) {
  const stepNumber = extractStepNumber(stepData.question);
  const contextInfo = CORRECT_ANSWERS_CONTEXT[stepNumber];

  const basePrompt = `Ești un profesor de religie, cald, amuzant și înțelegător, care predă despre Biblia pentru clasa a IX-a. Răspunde în maxim 3 propoziții cu ton încurajator și educativ.

Elevul ${student.name} ${student.surname} a răspuns la întrebarea:
"${stepData.question}"

Opțiunile erau:
${stepData.options.map((opt, i) => `${i}. ${opt}`).join('\n')}

Răspuns corect: ${stepData.options[stepData.correct_answer]}
Răspuns elev: ${stepData.options[answer]}
Rezultat: ${isCorrect ? 'CORECT' : 'GREȘIT'}

Context suplimentar: ${contextInfo?.context || ''}`;

  if (isCorrect) {
    return `${basePrompt}

Confirmă că răspunsul este corect și explică importanța acestei informații pentru înțelegerea Bibliei. Adaugă o perspectivă spirituală sau educativă relevantă.

FORMATARE OBLIGATORIE:
- Folosește bullet points cu "•" pentru fiecare idee principală
- Separă fiecare punct pe linie nouă
- Maxim 3 puncte principale
- Fiecare punct să aibă maxim 1-2 propoziții
- Termină cu o încurajare sau reflecție spirituală

RĂSPUNDE DOAR CU TEXTUL FEEDBACK-ULUI, FĂRĂ JSON SAU ALTE FORMATĂRI.`;
  } else {
    return `${basePrompt}

Explică cu bunătate de ce răspunsul corect este cel adevărat și oferă informații suplimentare care să îi ajute pe elev să înțeleagă mai bine această parte din istoria biblică.

FORMATARE OBLIGATORIE:
- Folosește bullet points cu "•" pentru fiecare idee principală
- Separă fiecare punct pe linie nouă
- Maxim 3 puncte principale
- Fiecare punct să aibă maxim 1-2 propoziții
- Termină cu o încurajare sau reflecție spirituală

RĂSPUNDE DOAR CU TEXTUL FEEDBACK-ULUI, FĂRĂ JSON SAU ALTE FORMATĂRI.`;
  }
}

// Construiește prompt dinamic pentru răspunsuri scurte
function buildShortPrompt(stepData, student, answer, exerciseConfig) {
  const stepNumber = extractStepNumber(stepData.question);
  const contextInfo = CORRECT_ANSWERS_CONTEXT[stepNumber];

  return `Ești un profesor de religie, cald, amuzant și înțelegător, care evaluează cunoștințele elevilor despre Biblie. Evaluează răspunsul cu generozitate și oferă feedback în 3-4 propoziții cu ton încurajator.

Elevul ${student.name} ${student.surname} a răspuns la întrebarea:
"${stepData.question}"

Răspunsul elevului:
"${answer}"

RĂSPUNS CORECT DE REFERINȚĂ:
${contextInfo?.correct || ''}

CONTEXT SUPLIMENTAR PENTRU EVALUARE:
${contextInfo?.context || ''}

Punctaj maxim disponibil: ${stepData.points} punct

INSTRUCȚIUNI DE EVALUARE:
- Acordă 1 punct complet pentru răspunsuri corecte și complete
- Acordă 0.5 puncte pentru răspunsuri parțial corecte sau incomplete
- Fii generos cu elevii care demonstrează înțelegere de bază
- Pentru întrebarea 9 (personaj biblic), acceptă orice personaj sau povestire biblică validă
- Explică ce este bun în răspuns și oferă informații suplimentare utile
- Încurajează elevul și subliniază importanța învățării despre Biblie

FORMATARE OBLIGATORIE:
- Folosește bullet points cu "•" pentru fiecare idee principală
- Separă fiecare punct pe linie nouă
- Maxim 3-4 puncte principale
- Fiecare punct să aibă maxim 1-2 propoziții
- Termină cu o încurajare creștină caldă

OBLIGATORIU - Răspunde EXACT în acest format:
PUNCTAJ: [0, 0.5, sau 1]
FEEDBACK:
- [primul punct principal]
- [al doilea punct principal]
- [al treilea punct principal]`;
}

// Funcție helper pentru a extrage numărul întrebării
function extractStepNumber(question) {
  // Încearcă să identifice întrebarea pe baza textului
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

// Construiește prompt pentru raportul final
function buildFinalReportPrompt(student, performanceData, allStepsData, exerciseConfig) {
  // Calculează scorul cu punctul bonus
  const originalScore = performanceData.totalScore;
  const finalScore = originalScore + 1; // +1 punct bonus
  const maxScore = 10; // 9 întrebări + 1 bonus
  const percentage = (finalScore / maxScore) * 100;

  return `Ești un profesor de religie, cald, amuzant și înțelegător, care predă despre Biblie elevilor de clasa a IX-a. Elevul ${
    student.name
  } ${student.surname} a terminat întreaga activitate "Biblia – Cartea Cărților".

PERFORMANȚA COMPLETĂ:

${performanceData.stepResults
  .map(
    (step, index) => `
Întrebarea ${index + 1}: "${allStepsData[index].question.substring(0, 60)}..."
Punctaj obținut: ${step.score}/1
Feedback individual: "${step.feedback.substring(0, 80)}..."
`
  )
  .join('')}

REZULTAT FINAL: ${originalScore}/9 puncte + 1 punct bonus pentru participare = ${finalScore}/10 puncte (${percentage.toFixed(
    1
  )}%)

INSTRUCȚIUNI PENTRU RAPORTUL FINAL:
- Oferă o analiză completă și încurajatoare a cunoștințelor elevului despre Biblie
- Subliniază progresul spiritual și educativ demonstrat
- Identifică punctele forte și domeniile care ar putea fi aprofundate
- Oferă sfaturi concrete pentru dezvoltarea relației cu Scripturile
- Încurajează elevul să continue să studieze Biblia
- Include o perspectivă spirituală caldă și motivantă
- Raportul să fie în 4-5 propoziții, inspirant și educativ

FORMATARE OBLIGATORIE:
- Folosește bullet points cu "•" pentru fiecare idee principală
- Separă fiecare punct pe linie nouă
- Exact 4 puncte principale:
  • Primul punct: Aprecierea cunoștințelor demonstrate
  • Al doilea punct: Punctele forte și progresul observat
  • Al treilea punct: Sfaturi pentru aprofundarea studiului biblic
  • Al patrulea punct: Încurajare spirituală și motivație

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

// Gestionează feedback-ul pentru o sarcină individuală
async function handleStepFeedback(requestData) {
  const { stepData, answer, student, isCorrect, exerciseConfig } = requestData;

  // Validare date de intrare
  if (!stepData || answer === undefined || answer === null || !student || !exerciseConfig) {
    console.error('Date incomplete pentru AI feedback, sarcina:', {
      stepData: !!stepData,
      answer,
      student: !!student,
      exerciseConfig: !!exerciseConfig,
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

      // Calculează scorul - 1 punct pentru răspuns corect
      score = isCorrect ? 1 : 0;

      // Construiește prompt-ul dinamic
      const prompt = buildGrilaPrompt(stepData, student, answer, isCorrect, exerciseConfig);

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
              'Ești un profesor de religie, cald, amuzant și înțelegător, specializat în studiul Bibliei. Oferă feedback educativ și spiritual pentru elevii de clasa a IX-a.',
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
      const prompt = buildShortPrompt(stepData, student, answer, exerciseConfig);

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
              'Ești un profesor de religie, cald, amuzant și înțelegător, care evaluează cunoștințele despre Biblie. Fii generos cu punctajele și oferă feedback spiritual încurajator.',
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

      // Extrage scorul
      const punctajMatch = aiText.match(/PUNCTAJ:\s*([0-9.]+)/i);
      const feedbackMatch = aiText.match(/FEEDBACK:\s*(.+)/is);

      if (punctajMatch) {
        score = parseFloat(punctajMatch[1]);
        // Validează scorul (0, 0.5, sau 1)
        score = Math.max(0, Math.min(score, 1));
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

    console.log('Feedback AI per sarcina generat cu succes:', {
      type: stepData.type,
      score: score,
      feedbackLength: feedback.length,
    });

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
    // Log eroarea detailat pentru debugging
    console.error('Eroare AI feedback per sarcina:', {
      error: error.message,
      stack: error.stack,
      stepType: stepData?.type,
      student: student?.name,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    });

    // Returnează eroare explicită
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

// Gestionează raportul final
async function handleFinalReport(requestData) {
  const { student, performanceData, allStepsData, exerciseConfig } = requestData;

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
    const prompt = buildFinalReportPrompt(student, performanceData, allStepsData, exerciseConfig);

    console.log('Generez raport AI final pentru:', {
      student: student.name,
      totalScore: performanceData.totalScore,
      finalScore: performanceData.totalScore + 1,
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
            'Ești un profesor de religie, cald, amuzant și înțelegător, specializat în studiul Bibliei. Oferă rapoarte finale inspirante care să motiveze elevii să continue să studieze Scripturile.',
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

    // Returnează eroare explicită
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
