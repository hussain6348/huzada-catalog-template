interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const dbUrl = context.env.TURSO_DATABASE_URL;
  const token = context.env.TURSO_AUTH_TOKEN;

  // Make sure 'catalog' matches your actual Turso table name for this template
  const response = await fetch(`${dbUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      requests: [{ type: "execute", stmt: { sql: "SELECT * FROM catalog ORDER BY id DESC" } }]
    })
  });

  const data = await response.json();
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}
