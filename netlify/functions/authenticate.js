// netlify/functions/authenticate.js
// Autentificare dublă: cod elev + parolă worksheet

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
    const { studentCode, worksheetPassword } = JSON.parse(event.body || '{}');

    // Validare input
    if (!studentCode || !worksheetPassword) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Codul elevului și parola worksheet-ului sunt obligatorii',
        }),
      };
    }

    // 1. Verifică codul elevului
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, surname, grade')
      .eq('access_code', studentCode)
      .single();

    if (studentError || !student) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Cod elev invalid',
        }),
      };
    }

    // 2. Verifică parola worksheet-ului
    const { data: worksheet, error: worksheetError } = await supabase
      .from('worksheets')
      .select(
        'id, subject, grade, topic, title, description, structure, max_attempts, is_active, is_visible'
      )
      .eq('password', worksheetPassword)
      .single();

    if (worksheetError || !worksheet) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Parolă worksheet invalidă',
        }),
      };
    }

    // 3. Verifică dacă worksheet-ul este vizibil
    if (!worksheet.is_visible) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Această activitate nu este disponibilă',
        }),
      };
    }

    // 4. Verifică încercările existente și determină statusul curent
    const { data: attempts, error: attemptsError } = await supabase
      .from('worksheet_attempts')
      .select('attempt_number, is_completed')
      .eq('student_id', student.id)
      .eq('worksheet_id', worksheet.id)
      .order('attempt_number', { ascending: false });

    if (attemptsError) {
      throw attemptsError;
    }

    const currentAttemptNumber = attempts.length > 0 ? attempts[0].attempt_number : 0;
    const hasAttemptsLeft = currentAttemptNumber < worksheet.max_attempts;

    // Determină dacă ultima încercare a fost completată
    const lastAttemptCompleted = attempts.length > 0 ? attempts[0].is_completed : false;

    // 5. Logica pentru încărcarea progresului
    let currentProgress = null;
    let shouldRestoreProgress = false;

    if (attempts.length > 0) {
      // Dacă ultima încercare NU a fost completată, încarcă progresul pentru continuare
      if (!lastAttemptCompleted) {
        const { data: progress, error: progressError } = await supabase
          .from('student_progress')
          .select('step_number, answer, feedback, score, completed_at')
          .eq('student_id', student.id)
          .eq('worksheet_id', worksheet.id)
          .eq('attempt_number', currentAttemptNumber)
          .order('step_number');

        if (!progressError && progress) {
          currentProgress = progress;
          shouldRestoreProgress = true; // Încarcă progresul în interfață
        }
      }
      // Dacă ultima încercare A fost completată, nu încărca progresul (exercițiu curat)
    }

    // 6. Determină dacă poate începe o încercare nouă
    const canStartNewAttempt = lastAttemptCompleted && hasAttemptsLeft;

    // 7. Succes - returnează toate datele necesare
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        student: {
          id: student.id,
          name: student.name,
          surname: student.surname,
          grade: student.grade,
        },
        worksheet: {
          id: worksheet.id,
          subject: worksheet.subject,
          grade: worksheet.grade,
          topic: worksheet.topic,
          title: worksheet.title,
          description: worksheet.description,
          structure: worksheet.structure,
          is_active: worksheet.is_active,
          max_attempts: worksheet.max_attempts,
        },
        session: {
          current_attempt: currentAttemptNumber + 1,
          has_attempts_left: hasAttemptsLeft,
          can_submit: worksheet.is_active && hasAttemptsLeft,
          progress: currentProgress,
          should_restore_progress: shouldRestoreProgress, // Flag pentru frontend
          last_attempt_completed: lastAttemptCompleted,
          can_start_new_attempt: canStartNewAttempt,
        },
      }),
    };
  } catch (error) {
    console.error('Eroare autentificare:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Eroare de server. Încearcă din nou.',
      }),
    };
  }
};
