// netlify/functions/mark-attempt-completed.js
// Marchează o încercare ca fiind finalizată în baza de date

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
    console.error('Eroare parsare JSON în mark-attempt-completed:', parseError);
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

  const { studentId, worksheetId, attemptNumber, globalFeedback } = requestData;

  try {
    // Validare date de intrare
    if (!studentId || !worksheetId || !attemptNumber) {
      console.error('Date incomplete în mark-attempt-completed:', {
        studentId,
        worksheetId,
        attemptNumber,
      });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Date incomplete. StudentId, worksheetId și attemptNumber sunt obligatorii.',
        }),
      };
    }

    // 1. Verifică că încercarea există în baza de date
    const { data: existingAttempt, error: selectError } = await supabase
      .from('worksheet_attempts')
      .select('id, is_completed')
      .eq('student_id', studentId)
      .eq('worksheet_id', worksheetId)
      .eq('attempt_number', attemptNumber)
      .single();

    if (selectError || !existingAttempt) {
      console.error('Încercarea nu există în BD:', selectError);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Încercarea specificată nu a fost găsită în baza de date',
        }),
      };
    }

    // 2. Verifică dacă încercarea nu este deja marcată ca finalizată
    if (existingAttempt.is_completed) {
      console.log('Încercarea este deja marcată ca finalizată:', {
        studentId,
        worksheetId,
        attemptNumber,
      });
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          message: 'Încercarea era deja marcată ca finalizată',
          already_completed: true,
        }),
      };
    }

    // 3. Calculează scorul total final pentru această încercare
    const { data: progressSteps, error: progressError } = await supabase
      .from('student_progress')
      .select('score')
      .eq('student_id', studentId)
      .eq('worksheet_id', worksheetId)
      .eq('attempt_number', attemptNumber);

    if (progressError) {
      console.error('Eroare încărcare progres pentru scor final:', progressError);
      throw new Error('Eroare la calcularea scorului final');
    }

    const finalTotalScore = progressSteps
      ? progressSteps.reduce((sum, step) => sum + (step.score || 0), 0)
      : 0;

    // 4. Marchează încercarea ca finalizată și actualizează scorul
    const { error: updateError } = await supabase
      .from('worksheet_attempts')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        total_score: finalTotalScore,
        global_feedback: globalFeedback,
      })
      .eq('id', existingAttempt.id);

    if (updateError) {
      console.error('Eroare actualizare attempt ca finalizat:', updateError);
      throw new Error('Eroare la marcarea încercării ca finalizată');
    }

    console.log('Încercare marcată ca finalizată cu succes:', {
      studentId,
      worksheetId,
      attemptNumber,
      finalScore: finalTotalScore,
    });

    // 5. Returnează succesul
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Încercarea a fost marcată ca finalizată cu succes',
        final_score: finalTotalScore,
        completed_at: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Eroare critică în mark-attempt-completed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Eroare de server. Te rugăm să încerci din nou.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
