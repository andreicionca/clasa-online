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
        'id, subject, grade, title, description, structure, max_attempts, is_active, is_visible'
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

    // 4. Verifică dacă elevul are încercări disponibile
    const { data: attempts, error: attemptsError } = await supabase
      .from('worksheet_attempts')
      .select('attempt_number')
      .eq('student_id', student.id)
      .eq('worksheet_id', worksheet.id)
      .order('attempt_number', { ascending: false });

    if (attemptsError) {
      throw attemptsError;
    }

    const currentAttemptNumber = attempts.length > 0 ? attempts[0].attempt_number : 0;
    const hasAttemptsLeft = currentAttemptNumber < worksheet.max_attempts;

    // 5. Încarcă progresul curent dacă există
    let currentProgress = null;
    if (attempts.length > 0) {
      const { data: progress, error: progressError } = await supabase
        .from('student_progress')
        .select('step_number, answer, feedback, score, completed_at')
        .eq('student_id', student.id)
        .eq('worksheet_id', worksheet.id)
        .eq('attempt_number', currentAttemptNumber)
        .order('step_number');

      if (!progressError && progress) {
        currentProgress = progress;
      }
    }

    // 6. Succes - returnează toate datele necesare
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
