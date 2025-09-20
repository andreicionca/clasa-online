// netlify/functions/worksheet-submit-step.js
// Funcția pentru trimiterea răspunsurilor pas cu pas cu AI obligatoriu

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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
    console.error('Eroare parsare JSON în submit-step:', parseError);
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

  const { studentId, worksheetId, stepNumber, answer, attemptNumber } = requestData;

  try {
    // Validare date de intrare
    if (
      !studentId ||
      !worksheetId ||
      stepNumber === undefined ||
      answer === null ||
      answer === undefined
    ) {
      console.error('Date incomplete în submit-step:', {
        studentId,
        worksheetId,
        stepNumber,
        answer,
      });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Date incomplete. Verifică toate câmpurile.',
        }),
      };
    }

    // 1. Verifică și încarcă datele studentului
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, surname, grade')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      console.error('Student nu există sau eroare BD:', studentError);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Student invalid sau eroare de baza de date',
        }),
      };
    }

    // 2. Verifică și încarcă datele worksheet-ului
    const { data: worksheet, error: worksheetError } = await supabase
      .from('worksheets')
      .select('id, subject, grade, title, structure, is_active, max_attempts')
      .eq('id', worksheetId)
      .single();

    if (worksheetError || !worksheet) {
      console.error('Worksheet nu există sau eroare BD:', worksheetError);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Activitate invalidă sau eroare de baza de date',
        }),
      };
    }

    // 3. Verifică dacă worksheet-ul este activ
    if (!worksheet.is_active) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Această activitate a fost închisă și nu mai acceptă răspunsuri',
        }),
      };
    }

    // 4. Determină și verifică numărul încercării curente
    let currentAttempt = attemptNumber;

    if (!currentAttempt) {
      const { data: attempts } = await supabase
        .from('worksheet_attempts')
        .select('attempt_number')
        .eq('student_id', studentId)
        .eq('worksheet_id', worksheetId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      currentAttempt = attempts && attempts.length > 0 ? attempts[0].attempt_number : 1;
    }

    if (currentAttempt > worksheet.max_attempts) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: `Ai depășit numărul maxim de încercări (${worksheet.max_attempts})`,
        }),
      };
    }

    // 5. Verifică și validează structura pasului
    const steps = worksheet.structure.steps || [];
    if (stepNumber < 1 || stepNumber > steps.length) {
      console.error('Numărul pasului invalid:', { stepNumber, totalSteps: steps.length });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Numărul pasului este invalid',
        }),
      };
    }

    const stepData = steps[stepNumber - 1];
    const stepIndex = stepNumber - 1;

    // 6. Validează răspunsul în funcție de tipul întrebării
    let processedAnswer = answer;
    let isCorrect = false;

    if (stepData.type === 'grila') {
      // Validare răspuns grila
      if (typeof answer !== 'number' || answer < 0 || answer >= stepData.options.length) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: 'Răspunsul selectat nu este valid pentru această întrebare',
          }),
        };
      }

      isCorrect = answer === stepData.correct_answer;
    } else if (stepData.type === 'short') {
      // Validare răspuns scurt
      if (typeof answer !== 'string' || answer.trim().length < 5) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: 'Răspunsul trebuie să aibă cel puțin 5 caractere',
          }),
        };
      }

      processedAnswer = answer.trim();
      // Pentru răspunsuri scurte isCorrect nu se aplică
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

    // 7. Apelează AI pentru feedback - OBLIGATORIU
    console.log('Apel AI pentru feedback:', {
      student: student.name,
      stepType: stepData.type,
      stepNumber,
    });

    let aiResponse;
    try {
      aiResponse = await callWorksheetSpecificAI(
        worksheet.subject,
        worksheet.grade,
        stepData,
        processedAnswer,
        student,
        stepIndex,
        isCorrect
      );
    } catch (aiError) {
      console.error('Eroare critică în apelul AI:', aiError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Sistemul de feedback AI este temporar indisponibil. Te rugăm să încerci din nou.',
          retryable: true,
        }),
      };
    }

    // Verifică că AI-ul a returnat date valide
    if (!aiResponse || !aiResponse.success) {
      console.error('AI-ul nu a returnat date valide:', aiResponse);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error:
            'Sistemul de feedback AI nu a putut procesa răspunsul. Te rugăm să încerci din nou.',
          retryable: true,
        }),
      };
    }

    const { feedback, score } = aiResponse;

    if (!feedback || score === undefined || score === null) {
      console.error('Feedback sau scor invalid de la AI:', { feedback: !!feedback, score });
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Feedback-ul AI este incomplet. Te rugăm să încerci din nou.',
          retryable: true,
        }),
      };
    }

    // 8. Doar după succesul AI, creează/actualizează încercarea în BD
    const { data: existingAttempt } = await supabase
      .from('worksheet_attempts')
      .select('id')
      .eq('student_id', studentId)
      .eq('worksheet_id', worksheetId)
      .eq('attempt_number', currentAttempt)
      .single();

    if (!existingAttempt) {
      const { error: attemptError } = await supabase.from('worksheet_attempts').insert({
        student_id: studentId,
        worksheet_id: worksheetId,
        attempt_number: currentAttempt,
        total_score: 0,
        is_completed: false,
      });

      if (attemptError) {
        console.error('Eroare creare attempt:', attemptError);
        throw new Error('Eroare la salvarea încercării în baza de date');
      }
    }

    // 9. Salvează progresul cu feedback-ul AI (doar după succes)
    const { data: existingProgress } = await supabase
      .from('student_progress')
      .select('id')
      .eq('student_id', studentId)
      .eq('worksheet_id', worksheetId)
      .eq('step_number', stepNumber)
      .eq('attempt_number', currentAttempt)
      .single();

    if (existingProgress) {
      // Actualizează progresul existent
      const { error: updateError } = await supabase
        .from('student_progress')
        .update({
          answer: processedAnswer,
          feedback: feedback,
          score: score,
          completed_at: new Date().toISOString(),
        })
        .eq('id', existingProgress.id);

      if (updateError) {
        console.error('Eroare actualizare progres:', updateError);
        throw new Error('Eroare la actualizarea progresului în baza de date');
      }
    } else {
      // Inserează progres nou
      const { error: insertError } = await supabase.from('student_progress').insert({
        student_id: studentId,
        worksheet_id: worksheetId,
        step_number: stepNumber,
        answer: processedAnswer,
        feedback: feedback,
        score: score,
        attempt_number: currentAttempt,
      });

      if (insertError) {
        console.error('Eroare inserare progres:', insertError);
        throw new Error('Eroare la salvarea progresului în baza de date');
      }
    }

    // 10. Actualizează scorul total al încercării
    await updateAttemptTotalScore(studentId, worksheetId, currentAttempt);

    console.log('Progres salvat cu succes:', {
      student: student.name,
      stepNumber,
      score,
      feedbackLength: feedback.length,
    });

    // 11. Returnează succesul cu feedback-ul AI
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
        isCorrect: isCorrect,
        stepCompleted: true,
        maxPoints: stepData.points,
        message: 'Răspuns evaluat și salvat cu succes!',
      }),
    };
  } catch (error) {
    console.error('Eroare critică în submit-step:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Eroare de server. Te rugăm să încerci din nou.',
        retryable: true,
      }),
    };
  }
};

// Funcție pentru apelarea AI-ului specializat pe worksheet
// Fix pentru functia callWorksheetSpecificAI din submit-step.js
// Înlocuiește întreaga funcție cu aceasta:

async function callWorksheetSpecificAI(
  subject,
  grade,
  stepData,
  answer,
  student,
  stepIndex,
  isCorrect
) {
  try {
    // Construiește numele funcției AI specializate
    const functionName = `worksheet-submit-${subject}-${grade}-securitate`;

    // Pregătește payload-ul pentru funcția AI
    const payload = {
      stepData,
      answer,
      student,
      stepIndex,
      isCorrect,
      requestType: 'ai_feedback',
    };

    console.log(`Apel către funcția AI: ${functionName}`);

    // FIX: Folosește URL-ul corect pentru Netlify
    const baseURL = process.env.URL || process.env.NETLIFY_URL || 'https://clasaonline.netlify.app';

    // Apelează funcția AI specializată
    const response = await fetch(`${baseURL}/.netlify/functions/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI function ${functionName} răspuns ${response.status}:`, errorText);
      throw new Error(`AI function responded with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      console.error(`AI function ${functionName} returnează eroare:`, result.error);
      throw new Error(result.error || 'AI function returned unsuccessful response');
    }

    return result;
  } catch (error) {
    console.error('Eroare în apelul către AI specializat:', error);
    throw error; // Re-throw pentru a fi prins de handlerul principal
  }
}

// Funcție pentru actualizarea scorului total al încercării
async function updateAttemptTotalScore(studentId, worksheetId, attemptNumber) {
  try {
    // Calculează scorul total pentru această încercare
    const { data: progressSteps, error: progressError } = await supabase
      .from('student_progress')
      .select('score')
      .eq('student_id', studentId)
      .eq('worksheet_id', worksheetId)
      .eq('attempt_number', attemptNumber);

    if (progressError) {
      console.error('Eroare încărcare progres pentru scor total:', progressError);
      return; // Nu aruncă eroare, doar loggează
    }

    if (progressSteps && progressSteps.length > 0) {
      const totalScore = progressSteps.reduce((sum, step) => sum + (step.score || 0), 0);

      // Actualizează scorul total în worksheet_attempts
      const { error: updateError } = await supabase
        .from('worksheet_attempts')
        .update({ total_score: totalScore })
        .eq('student_id', studentId)
        .eq('worksheet_id', worksheetId)
        .eq('attempt_number', attemptNumber);

      if (updateError) {
        console.error('Eroare actualizare scor total:', updateError);
      } else {
        console.log(`Scor total actualizat: ${totalScore} pentru attempt ${attemptNumber}`);
      }
    }
  } catch (error) {
    console.error('Eroare în updateAttemptTotalScore:', error);
    // Nu aruncă eroare pentru că nu e critică pentru fluxul principal
  }
}
