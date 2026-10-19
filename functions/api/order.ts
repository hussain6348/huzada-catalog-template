import { createClient } from "@libsql/client/web";
import { json } from "../_lib/guard";

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  let body: any;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  // Security: Cap input lengths to prevent database exhaustion
  const orderId = String(body.orderId || `ORD-${Date.now()}`).substring(0, 50);
  const customerName = String(body.customerName || "").substring(0, 100);
  const customerPhone = String(body.customerPhone || "").substring(0, 50);
  const customerAddress = String(body.customerAddress || "").substring(0, 300);
  const notes = String(body.notes || "").substring(0, 500);
  const total = Math.min(Number(body.total) || 0, 9999999);
  const status = "pending"; // Security: Force pending, ignore client status

  let items = [];
  if (Array.isArray(body.items)) {
    items = body.items.slice(0, 50); // Cap at 50 items
  }

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY, customer_name TEXT, customer_phone TEXT,
          customer_address TEXT, notes TEXT, items TEXT, total REAL,
          status TEXT DEFAULT "pending", created_at TEXT
        )
      `);
      await db.execute({
        sql: `INSERT INTO orders (id, customer_name, customer_phone, customer_address, notes, items, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [orderId, customerName, customerPhone, customerAddress, notes, JSON.stringify(items), total, status, new Date().toISOString()],
      });
    } catch (e) { console.error("Turso DB error:", e); }
  }
  return json({ success: true, orderId });
};
