// netlify/functions/ping.js
exports.handler = async function () {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 500,
      body: 'Missing Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)',
    };
  }

  try {
    // interogare minimă pe tabela "worksheets"
    await fetch(`${SUPABASE_URL}/rest/v1/worksheets?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    return {
      statusCode: 200,
      body: 'Supabase ping OK (clasa-online)',
    };
  } catch (err) {
    console.error('Supabase ping error:', err);
    return {
      statusCode: 500,
      body: 'Supabase ping failed',
    };
  }
};
