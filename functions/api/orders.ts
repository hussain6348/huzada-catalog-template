import { createClient } from '@libsql/client/web';

export const onRequestGet = async (context: any) => {
  const { env } = context;
  
  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      
      // Ensure table exists
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

      const result = await db.execute('SELECT * FROM orders ORDER BY rowid DESC LIMIT 100');
      const orders = result.rows.map(r => ({
        id: r.id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        customerAddress: r.customer_address,
        notes: r.notes || '',
        items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []),
        total: Number(r.total || 0),
        status: r.status || 'pending',
        createdAt: r.created_at || new Date().toISOString(),
      }));

      return new Response(JSON.stringify({ success: true, orders, source: 'turso' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      console.error('Turso fetch error:', e);
      return new Response(JSON.stringify({ success: false, error: e.message, orders: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Fallback when Turso is not connected
  return new Response(JSON.stringify({ success: true, orders: [], source: 'fallback' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestPatch = async (context: any) => {
  const { request, env } = context;
  const body = await request.json();
  const { id, status } = body;

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await db.execute({
        sql: 'UPDATE orders SET status = ? WHERE id = ?',
        args: [status, id],
      });
      return new Response(JSON.stringify({ success: true, id, status }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ success: true, id, status, mock: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
