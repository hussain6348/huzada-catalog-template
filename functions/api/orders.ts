import { createClient } from "@libsql/client/web";
import { requireAdmin, json } from "../_lib/guard";

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await db.execute(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY, customer_name TEXT, customer_phone TEXT, customer_address TEXT,
          notes TEXT, items TEXT, total REAL, status TEXT DEFAULT "pending", created_at TEXT
        )
      `);
      const result = await db.execute("SELECT * FROM orders ORDER BY rowid DESC LIMIT 100");
      const orders = result.rows.map(r => ({
        id: r.id, customerName: r.customer_name, customerPhone: r.customer_phone,
        customerAddress: r.customer_address, notes: r.notes || "",
        items: typeof r.items === "string" ? JSON.parse(r.items || "[]") : (r.items || []),
        total: Number(r.total || 0), status: r.status || "pending",
        createdAt: r.created_at || new Date().toISOString(),
      }));
      return json({ success: true, orders, source: "turso" });
    } catch (e: any) {
      console.error(e);
      return json({ success: false, error: "Server error", orders: [] }, 500);
    }
  }
  return json({ success: true, orders: [], source: "fallback" });
};

export const onRequestPatch = async (context: any) => {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  let body: any;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const ALLOWED = ["pending", "processing", "completed", "cancelled"];
  if (typeof body.id !== "string" || body.id.length > 64 || !ALLOWED.includes(body.status)) {
    return json({ error: "Invalid input" }, 400);
  }

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await db.execute({
        sql: "UPDATE orders SET status = ? WHERE id = ?",
        args: [body.status, body.id],
      });
      return json({ success: true, id: body.id, status: body.status });
    } catch (e: any) {
      console.error(e);
      return json({ success: false, error: "Server error" }, 500);
    }
  }
  return json({ success: true, id: body.id, status: body.status, mock: true });
};
