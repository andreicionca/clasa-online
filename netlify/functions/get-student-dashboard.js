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

    console.log('🔍 Se caută studentul cu codul:', studentCode);

    // 1. Verifică și obține datele elevului
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, surname, grade')
      .eq('access_code', studentCode)
      .single();

    if (studentError || !student) {
      console.error('❌ Eroare la găsirea studentului:', studentError);
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

    console.log('✅ Student găsit:', student);

    // 2. Obține toți studenții din EXACT aceeași clasă (cu tot cu secțiune)
    const { data: classmates, error: classmatesError } = await supabase
      .from('students')
      .select('id, name, surname')
      .eq('grade', student.grade); // Match exact: "XI E" = "XI E"

    if (classmatesError) {
      console.error('❌ Eroare la încărcarea colegilor:', classmatesError);
      throw classmatesError;
    }

    console.log(`✅ ${classmates.length} colegi găsiți în clasa ${student.grade}`);

    // 3. Obține toate încercările COMPLETATE ale colegilor din clasă
    const classmateIds = classmates.map((s) => s.id);

    const { data: allAttempts, error: attemptsError } = await supabase
      .from('worksheet_attempts')
      .select('id, student_id, worksheet_id, attempt_number, total_score, completed_at')
      .in('student_id', classmateIds)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false });

    if (attemptsError) {
      console.error('❌ Eroare la încărcarea încercărilor:', attemptsError);
      throw attemptsError;
    }

    console.log(
      `✅ ${allAttempts.length} încercări completate găsite pentru clasa ${student.grade}`
    );

    // 4. Extrage worksheet_ids unice din încercări
    const worksheetIdsUsed = [...new Set(allAttempts.map((a) => a.worksheet_id))];

    if (worksheetIdsUsed.length === 0) {
      console.log('ℹ️ Nicio fișă nu a fost încercată de clasa ta încă');

      // Returnează răspuns gol dar valid
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
          worksheets: [],
          overall_stats: {
            total_points_earned: 0,
            total_points_possible: 0,
            overall_rank: null,
            total_students_with_attempts: 0,
            overall_top_5: [],
            worksheets_completed: 0,
            worksheets_total: 0,
            completion_percentage: 0,
          },
        }),
      };
    }

    console.log(`📋 Se încarcă ${worksheetIdsUsed.length} worksheets folosite de clasă`);

    // 5. Încarcă DOAR worksheets folosite de clasă (indiferent de grade)
    const { data: worksheetsRaw, error: worksheetsError } = await supabase
      .from('worksheets')
      .select('id, subject, grade, topic, title, description, structure, max_attempts, is_active')
      .in('id', worksheetIdsUsed)
      .order('created_at', { ascending: false });

    if (worksheetsError) {
      console.error('❌ Eroare la încărcarea worksheets:', worksheetsError);
      throw worksheetsError;
    }

    console.log(`✅ ${worksheetsRaw.length} worksheets încărcate`);

    // Parse JSON structure pentru fiecare worksheet
    const worksheets = worksheetsRaw.map((ws) => {
      try {
        const parsedStructure =
          typeof ws.structure === 'string' ? JSON.parse(ws.structure) : ws.structure;

        return {
          ...ws,
          structure: parsedStructure,
        };
      } catch (parseError) {
        console.error(`❌ Eroare la parsarea structure pentru worksheet ${ws.id}:`, parseError);
        return {
          ...ws,
          structure: { steps: [], exercise_config: { has_scoring: true, total_points: 0 } },
        };
      }
    });

    // 6. Procesează datele pentru fiecare worksheet
    const worksheetsData = worksheets.map((worksheet) => {
      // Calculează max score din structure
      const maxScore = worksheet.structure.steps.reduce((sum, step) => sum + (step.points || 0), 0);

      console.log(
        `📝 Procesare worksheet ${worksheet.id} - ${worksheet.title}, max_score: ${maxScore}`
      );

      // Filtrează încercările pentru acest worksheet (doar din clasa curentă)
      const worksheetAttempts = allAttempts.filter((a) => a.worksheet_id === worksheet.id);

      console.log(`  → ${worksheetAttempts.length} încercări din clasa ${student.grade}`);

      // Calculează BEST score pentru fiecare student DIN CLASĂ
      const studentBestScores = {};

      worksheetAttempts.forEach((attempt) => {
        const studentId = attempt.student_id;
        const score = parseFloat(attempt.total_score) || 0;

        if (!studentBestScores[studentId] || score > studentBestScores[studentId].score) {
          studentBestScores[studentId] = {
            score: score,
            attempt_number: attempt.attempt_number,
            completed_at: attempt.completed_at,
          };
        }
      });

      console.log(`  → ${Object.keys(studentBestScores).length} studenți cu best scores`);

      // Creează array pentru ranking (doar colegii din clasă care au încercat)
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
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return new Date(a.completed_at) - new Date(b.completed_at);
        });

      // Adaugă rank
      rankings.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      // Găsește datele elevului curent
      const studentData = rankings.find((r) => r.student_id === student.id);

      // Top 5
      const top5 = rankings.slice(0, 5);

      console.log(
        `  → Studentul curent: ${
          studentData ? `rank ${studentData.rank}, score ${studentData.score}` : 'neînceput'
        }`
      );

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

    // 7. Calculează statistici generale (overall - doar pentru clasa curentă)
    console.log('📊 Calculare statistici generale...');

    const overallScores = {};

    classmates.forEach((classmate) => {
      let totalScore = 0;

      worksheetsData.forEach((ws) => {
        const studentEntry = ws.top_5.find((entry) => entry.student_id === classmate.id);

        if (!studentEntry) {
          const studentAttempts = allAttempts.filter(
            (a) => a.worksheet_id === ws.id && a.student_id === classmate.id
          );

          if (studentAttempts.length > 0) {
            const bestScore = Math.max(
              ...studentAttempts.map((a) => parseFloat(a.total_score) || 0)
            );
            totalScore += bestScore;
          }
        } else {
          totalScore += studentEntry.score;
        }
      });

      if (totalScore > 0) {
        overallScores[classmate.id] = {
          student_id: classmate.id,
          name: `${classmate.name} ${classmate.surname}`,
          total_score: totalScore,
        };
      }
    });

    const overallRankings = Object.values(overallScores).sort(
      (a, b) => b.total_score - a.total_score
    );

    overallRankings.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    console.log(`  → ${overallRankings.length} studenți în clasamentul general`);

    const studentOverallData = overallRankings.find((r) => r.student_id === student.id);

    console.log(
      `  → Studentul curent: ${
        studentOverallData
          ? `rank ${studentOverallData.rank}, total ${studentOverallData.total_score}`
          : 'fără puncte'
      }`
    );

    const totalPointsPossible = worksheetsData.reduce((sum, ws) => sum + ws.max_score, 0);
    const completedWorksheetsCount = worksheetsData.filter((ws) => ws.has_attempted).length;

    console.log(`  → Total puncte posibile: ${totalPointsPossible}`);
    console.log(`  → Worksheets completate: ${completedWorksheetsCount}/${worksheets.length}`);

    // 8. Construiește răspunsul final
    const response = {
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
    };

    console.log('✅ Răspuns construit cu succes');
    console.log('📤 Se returnează date pentru:', {
      student: `${student.name} ${student.surname}`,
      worksheets: worksheetsData.length,
      rank: response.overall_stats.overall_rank,
      score: response.overall_stats.total_points_earned,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('❌ Eroare CRITICĂ în get-student-dashboard:', error);
    console.error('Stack trace:', error.stack);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Eroare de server. Încearcă din nou.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
