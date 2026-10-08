import { createClient } from '@libsql/client/web';

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const body = await request.json();
  const orderId = body.orderId || `ORD-${Date.now()}`;
  
  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          customer_name TEXT,
          customer_phone TEXT,
          customer_address TEXT,
          notes TEXT,
          items TEXT,
          total REAL,
          status TEXT DEFAULT 'pending',
          created_at TEXT
        )
      `);

      await db.execute({
        sql: `INSERT INTO orders (id, customer_name, customer_phone, customer_address, notes, items, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          orderId,
          body.customerName || '',
          body.customerPhone || '',
          body.customerAddress || '',
          body.notes || '',
          JSON.stringify(body.items || []),
          body.total || 0,
          body.status || 'pending',
          new Date().toISOString(),
        ],
      });
    } catch (e) {
      console.error('Turso DB error:', e);
    }
  }
  
  return new Response(JSON.stringify({ success: true, orderId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
