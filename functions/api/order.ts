import { createClient } from '@libsql/client/web';

export const onRequestPost = async (context: any) => {
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { request, env } = context;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const orderId = `ORD-${Date.now()}`;
    
    const tursoUrl = env?.TURSO_DATABASE_URL;
    const tursoToken = env?.TURSO_AUTH_TOKEN;

    if (
      tursoUrl &&
      tursoToken &&
      typeof tursoUrl === 'string' &&
      typeof tursoToken === 'string' &&
      tursoUrl.trim() !== '' &&
      tursoToken.trim() !== ''
    ) {
      const cleanUrl = tursoUrl.trim();
      if (
        cleanUrl.startsWith('libsql://') ||
        cleanUrl.startsWith('https://') ||
        cleanUrl.startsWith('http://') ||
        cleanUrl.startsWith('wss://')
      ) {
        try {
          const db = createClient({ url: cleanUrl, authToken: tursoToken.trim() });
          await db.execute(`
            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              customer_name TEXT,
              customer_phone TEXT,
              customer_address TEXT,
              items TEXT,
              total REAL,
              status TEXT DEFAULT 'pending',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await db.execute({
            sql: `INSERT INTO orders (id, customer_name, customer_phone, customer_address, items, total, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [
              orderId,
              body.customerName || '',
              body.customerPhone || '',
              body.customerAddress || '',
              JSON.stringify(body.items || []),
              body.total || 0,
              'pending',
            ],
          });
        } catch (e) {
          console.error('Error inserting order:', e);
        }
      }
    }
    
    return new Response(JSON.stringify({ success: true, orderId }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Server error' }),
      { status: 500, headers: jsonHeaders }
    );
  }
};
