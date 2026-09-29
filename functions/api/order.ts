import { createClient } from '@libsql/client/web';

export const onRequestPost: PagesFunction<any> = async ({ request, env }) => {
  const body = await request.json() as any;
  const orderId = `ORD-${Date.now()}`;
  
  if (env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN) {
    const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
    try {
      await db.execute({
        sql: `INSERT INTO orders (id, customer_name, customer_phone, customer_address, items, total, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [orderId, body.customerName, body.customerPhone, body.customerAddress, JSON.stringify(body.items), body.total, 'pending'],
      });
    } catch (e) { console.error(e); }
  }
  
  return new Response(JSON.stringify({ success: true, orderId }), { headers: { 'Content-Type': 'application/json' } });
};
