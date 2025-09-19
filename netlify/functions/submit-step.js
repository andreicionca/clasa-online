// netlify/functions/submit-step.js
// Funcția pentru trimiterea răspunsurilor pas cu pas și feedback AI instant

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

exports.handler = async (event) => {
  // Doar POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { studentId, worksheetId, stepNumber, answer, attemptNumber } = JSON.parse(
      event.body || '{}'
    );

    // Validare input
    if (
      !studentId ||
      !worksheetId ||
      stepNumber === undefined ||
      answer === null ||
      answer === undefined
    ) {
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

    // 1. Verifică dacă elevul și worksheet-ul există și sunt valide
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, surname')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Student invalid',
        }),
      };
    }

    const { data: worksheet, error: worksheetError } = await supabase
      .from('worksheets')
      .select('id, subject, grade, title, structure, is_active, max_attempts')
      .eq('id', worksheetId)
      .single();

    if (worksheetError || !worksheet) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Worksheet invalid',
        }),
      };
    }

    // 2. Verifică dacă worksheet-ul este activ
    if (!worksheet.is_active) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Această activitate a fost închisă',
        }),
      };
    }

    // 3. Determină numărul încercării curente
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

    // 4. Verifică dacă mai poate face încercări
    if (currentAttempt > worksheet.max_attempts) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Ai depășit numărul maxim de încercări',
        }),
      };
    }

    // 5. Creează sau actualizează worksheet_attempts
    const { data: existingAttempt } = await supabase
      .from('worksheet_attempts')
      .select('id')
      .eq('student_id', studentId)
      .eq('worksheet_id', worksheetId)
      .eq('attempt_number', currentAttempt)
      .single();

    if (!existingAttempt) {
      await supabase.from('worksheet_attempts').insert({
        student_id: studentId,
        worksheet_id: worksheetId,
        attempt_number: currentAttempt,
        total_score: 0,
        is_completed: false,
      });
    }

    // 6. Verifică dacă pasul este valid
    const steps = worksheet.structure.steps || [];
    if (stepNumber < 1 || stepNumber > steps.length) {
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

    // 7. Validează răspunsul în funcție de tipul întrebării
    let processedAnswer = answer;
    let isCorrect = false;
    let autoScore = 0;

    if (stepData.type === 'grila') {
      // Pentru grile, răspunsul trebuie să fie un număr valid
      if (typeof answer !== 'number' || answer < 0 || answer >= stepData.options.length) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: 'Răspunsul selectat nu este valid',
          }),
        };
      }

      isCorrect = answer === stepData.correct_answer;
      autoScore = isCorrect ? 1 : 0;
    } else if (stepData.type === 'short') {
      // Pentru răspunsuri scurte, verifică lungimea minimă
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
      // Pentru răspunsuri scurte, scorul va fi determinat de AI
    }

    // 8. Apelează funcția specifică pentru feedback AI
    let feedback = 'Feedback în curs de procesare...';
    let finalScore = autoScore;

    try {
      const aiResponse = await callWorksheetSpecificFunction(
        worksheet.subject,
        worksheet.grade,
        stepData,
        processedAnswer,
        student,
        stepIndex,
        isCorrect
      );

      if (aiResponse.success) {
        feedback = aiResponse.feedback || feedback;
        finalScore = aiResponse.score !== undefined ? aiResponse.score : finalScore;
      }
    } catch (aiError) {
      console.error('Eroare AI feedback:', aiError);
      // Continuă cu feedback-ul de fallback
    }

    // 9. Verifică dacă există deja progres pentru acest pas și încercare
    const { data: existingProgress } = await supabase
      .from('student_progress')
      .select('id')
      .eq('student_id', studentId)
      .eq('worksheet_id', worksheetId)
      .eq('step_number', stepNumber)
      .eq('attempt_number', currentAttempt)
      .single();

    // 10. Salvează sau actualizează progresul
    if (existingProgress) {
      // Actualizează progresul existent
      const { error: updateError } = await supabase
        .from('student_progress')
        .update({
          answer: processedAnswer,
          feedback: feedback,
          score: finalScore,
          completed_at: new Date().toISOString(),
        })
        .eq('id', existingProgress.id);

      if (updateError) throw updateError;
    } else {
      // Inserează progres nou
      const { error: insertError } = await supabase.from('student_progress').insert({
        student_id: studentId,
        worksheet_id: worksheetId,
        step_number: stepNumber,
        answer: processedAnswer,
        feedback: feedback,
        score: finalScore,
        attempt_number: currentAttempt,
      });

      if (insertError) throw insertError;
    }

    // 11. Actualizează scorul total al încercării
    await updateAttemptTotalScore(studentId, worksheetId, currentAttempt);

    // 12. Returnează succesul cu feedback-ul
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        feedback: feedback,
        score: finalScore,
        isCorrect: isCorrect,
        stepCompleted: true,
        message: 'Răspuns salvat cu succes!',
      }),
    };
  } catch (error) {
    console.error('Eroare submit-step:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Eroare de server. Te rugăm să încerci din nou.',
      }),
    };
  }
};

// Funcție pentru apelarea funcției specifice de worksheet pentru AI feedback
async function callWorksheetSpecificFunction(
  subject,
  grade,
  stepData,
  answer,
  student,
  stepIndex,
  isCorrect
) {
  try {
    // Construiește numele funcției specifice
    const functionName = `submit-${subject}-${grade}-securitate`;

    // Pregătește payload-ul pentru funcția specifică
    const payload = {
      stepData,
      answer,
      student,
      stepIndex,
      isCorrect,
      requestType: 'ai_feedback',
    };

    // Apelează funcția specifică prin fetch intern
    const response = await fetch(
      `${process.env.NETLIFY_URL}/.netlify/functions/worksheets/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(`AI function responded with ${response.status}`);
    }
  } catch (error) {
    console.error('Eroare apel funcție AI:', error);

    // Fallback - returnează feedback basic
    if (stepData.type === 'grila') {
      return {
        success: true,
        feedback: isCorrect
          ? 'Răspuns corect!'
          : 'Răspuns incorect. Încearcă să te gândești din nou la conceptele învățate.',
        score: isCorrect ? 1 : 0,
      };
    } else {
      return {
        success: true,
        feedback:
          'Răspunsul tău a fost înregistrat. Feedback-ul detaliat va fi disponibil în curând.',
        score: 0.5, // Scor implicit pentru răspunsuri scurte
      };
    }
  }
}

// Funcție pentru actualizarea scorului total al încercării
async function updateAttemptTotalScore(studentId, worksheetId, attemptNumber) {
  try {
    // Calculează scorul total pentru această încercare
    const { data: progressSteps } = await supabase
      .from('student_progress')
      .select('score')
      .eq('student_id', studentId)
      .eq('worksheet_id', worksheetId)
      .eq('attempt_number', attemptNumber);

    if (progressSteps && progressSteps.length > 0) {
      const totalScore = progressSteps.reduce((sum, step) => sum + (step.score || 0), 0);

      // Actualizează scorul total în worksheet_attempts
      await supabase
        .from('worksheet_attempts')
        .update({ total_score: totalScore })
        .eq('student_id', studentId)
        .eq('worksheet_id', worksheetId)
        .eq('attempt_number', attemptNumber);
    }
  } catch (error) {
    console.error('Eroare actualizare scor total:', error);
  }
}
