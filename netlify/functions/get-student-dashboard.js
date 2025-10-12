// netlify/functions/get-student-dashboard.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

exports.handler = async (event) => {
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
    const { studentCode } = JSON.parse(event.body || '{}');

    if (!studentCode) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Codul elevului este obligatoriu',
        }),
      };
    }

    // 1. Verifică și obține datele elevului
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

    // 2. Obține toate worksheets pentru clasa elevului
    const { data: worksheets, error: worksheetsError } = await supabase
      .from('worksheets')
      .select('id, subject, grade, topic, title, description, structure, max_attempts, is_active')
      .eq('grade', student.grade)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (worksheetsError) {
      throw worksheetsError;
    }

    // 3. Obține toți studenții din aceeași clasă (pentru rankings)
    const { data: classmates, error: classmatesError } = await supabase
      .from('students')
      .select('id, name, surname')
      .eq('grade', student.grade);

    if (classmatesError) {
      throw classmatesError;
    }

    // 4. Obține toate încercările completate pentru toate worksheets
    const worksheetIds = worksheets.map((w) => w.id);
    const classmateIds = classmates.map((s) => s.id);

    const { data: allAttempts, error: attemptsError } = await supabase
      .from('worksheet_attempts')
      .select('id, student_id, worksheet_id, attempt_number, total_score, completed_at')
      .in('worksheet_id', worksheetIds)
      .in('student_id', classmateIds)
      .eq('is_completed', true);

    if (attemptsError) {
      throw attemptsError;
    }

    // 5. Procesează datele pentru fiecare worksheet
    const worksheetsData = worksheets.map((worksheet) => {
      // Calculează max score din structure
      const maxScore = worksheet.structure.steps.reduce((sum, step) => sum + step.points, 0);

      // Filtrează încercările pentru acest worksheet
      const worksheetAttempts = allAttempts.filter((a) => a.worksheet_id === worksheet.id);

      // Calculează best score pentru fiecare student
      const studentBestScores = {};
      worksheetAttempts.forEach((attempt) => {
        const studentId = attempt.student_id;
        if (
          !studentBestScores[studentId] ||
          attempt.total_score > studentBestScores[studentId].score
        ) {
          studentBestScores[studentId] = {
            score: attempt.total_score,
            attempt_number: attempt.attempt_number,
            completed_at: attempt.completed_at,
          };
        }
      });

      // Creează array pentru ranking (doar studenți cu cel puțin o încercare)
      const rankings = Object.entries(studentBestScores)
        .map(([studentId, data]) => {
          const studentInfo = classmates.find((s) => s.id === parseInt(studentId));
          return {
            student_id: parseInt(studentId),
            name: studentInfo ? `${studentInfo.name} ${studentInfo.surname}` : 'Necunoscut',
            score: data.score,
            attempt_number: data.attempt_number,
            completed_at: data.completed_at,
          };
        })
        .sort((a, b) => b.score - a.score); // Sortează descrescător

      // Adaugă rank
      rankings.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      // Găsește datele elevului curent
      const studentData = rankings.find((r) => r.student_id === student.id);

      // Top 5
      const top5 = rankings.slice(0, 5);

      return {
        id: worksheet.id,
        subject: worksheet.subject,
        topic: worksheet.topic,
        title: worksheet.title,
        description: worksheet.description,
        max_attempts: worksheet.max_attempts,
        is_active: worksheet.is_active,
        max_score: maxScore,
        student_best_score: studentData ? studentData.score : null,
        student_best_attempt: studentData ? studentData.attempt_number : null,
        student_rank: studentData ? studentData.rank : null,
        completed_at: studentData ? studentData.completed_at : null,
        total_students: rankings.length,
        top_5: top5,
        has_attempted: !!studentData,
      };
    });

    // 6. Calculează statistici generale (overall)
    const overallScores = {};

    // Pentru fiecare student, sumează best scores din toate worksheets
    classmates.forEach((classmate) => {
      const totalScore = worksheetsData.reduce((sum, ws) => {
        const studentEntry = ws.top_5.find((entry) => entry.student_id === classmate.id);
        // Caută în tot ranking-ul, nu doar top 5
        const allRankings = allAttempts
          .filter((a) => a.worksheet_id === ws.id && a.student_id === classmate.id)
          .map((a) => a.total_score);

        const bestScore = allRankings.length > 0 ? Math.max(...allRankings) : 0;
        return sum + bestScore;
      }, 0);

      if (totalScore > 0) {
        overallScores[classmate.id] = {
          student_id: classmate.id,
          name: `${classmate.name} ${classmate.surname}`,
          total_score: totalScore,
        };
      }
    });

    // Creează ranking general
    const overallRankings = Object.values(overallScores).sort(
      (a, b) => b.total_score - a.total_score
    );

    overallRankings.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Găsește poziția studentului curent
    const studentOverallData = overallRankings.find((r) => r.student_id === student.id);

    // Calculează total puncte posibile
    const totalPointsPossible = worksheetsData.reduce((sum, ws) => sum + ws.max_score, 0);

    // Calculează câte worksheets au fost completate
    const completedWorksheetsCount = worksheetsData.filter((ws) => ws.has_attempted).length;

    // 7. Construiește răspunsul final
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
        worksheets: worksheetsData,
        overall_stats: {
          total_points_earned: studentOverallData ? studentOverallData.total_score : 0,
          total_points_possible: totalPointsPossible,
          overall_rank: studentOverallData ? studentOverallData.rank : null,
          total_students_with_attempts: overallRankings.length,
          overall_top_5: overallRankings.slice(0, 5),
          worksheets_completed: completedWorksheetsCount,
          worksheets_total: worksheets.length,
          completion_percentage:
            worksheets.length > 0
              ? Math.round((completedWorksheetsCount / worksheets.length) * 100)
              : 0,
        },
      }),
    };
  } catch (error) {
    console.error('Eroare get-student-dashboard:', error);
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
