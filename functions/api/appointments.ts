// @ts-nocheck
const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

interface Env {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  if (!env?.TURSO_DATABASE_URL || !env?.TURSO_AUTH_TOKEN) {
    return new Response(JSON.stringify({ success: true, appointments: [] }), {
      headers: jsonHeaders,
    });
  }
  try {
    const res = await fetch(`${env.TURSO_DATABASE_URL.replace('libsql://', 'https://')}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            type: 'execute',
            stmt: { sql: 'SELECT * FROM appointments ORDER BY created_at DESC;' },
          },
        ],
      }),
    });
    const data = (await res.json()) as any;
    const rows = data?.results?.[0]?.response?.result?.rows || [];
    const appointments = rows.map((r: any) => ({
      id: String(r[0]?.value ?? ''),
      customerName: String(r[1]?.value ?? ''),
      customerPhone: String(r[2]?.value ?? ''),
      serviceName: String(r[3]?.value ?? ''),
      date: String(r[4]?.value ?? ''),
      time: String(r[5]?.value ?? ''),
      notes: String(r[6]?.value ?? ''),
      status: String(r[7]?.value ?? 'pending'),
      createdAt: String(r[8]?.value ?? new Date().toISOString()),
    }));
    return new Response(JSON.stringify({ success: true, appointments }), {
      headers: jsonHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { id, status } = ((await request.json()) || {}) as { id: string; status: string };
    if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
      await fetch(`${env.TURSO_DATABASE_URL.replace('libsql://', 'https://')}/v2/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              type: 'execute',
              stmt: {
                sql: 'UPDATE appointments SET status = ? WHERE id = ?;',
                args: [
                  { type: 'text', value: status },
                  { type: 'text', value: id },
                ],
              },
            },
          ],
        }),
      });
    }
    return new Response(JSON.stringify({ success: true, id, status }), {
      headers: jsonHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
};
