// netlify/functions/bulk-insert-students.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function generateStudentCode(length = 6) {
  // Folosesc doar litere mari și cifre (fără confuzii: 0, O, I, 1)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { students } = JSON.parse(event.body || '{}');

    if (!students || !Array.isArray(students)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid students data' }),
      };
    }

    // Generează coduri unice pentru toți elevii
    const studentsWithCodes = students.map((student) => ({
      name: student.name,
      surname: student.surname,
      grade: student.grade,
      access_code: generateStudentCode(6), // 6 caractere
    }));

    // Inserează în baza de date
    const { data, error } = await supabase.from('students').insert(studentsWithCodes).select();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        count: data.length,
        students: data.map((s) => ({
          name: s.name,
          surname: s.surname,
          grade: s.grade,
          access_code: s.access_code,
        })),
      }),
    };
  } catch (error) {
    console.error('Eroare:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
