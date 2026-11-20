import { createClient } from "@libsql/client/web";
import { requireAdmin, json } from "../_lib/guard";

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const tursoUrl = env?.TURSO_DATABASE_URL;
  const tursoToken = env?.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken && typeof tursoUrl === "string" && typeof tursoToken === "string" && tursoUrl.trim() && tursoToken.trim()) {
    try {
      const db = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
      await db.execute(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY, customer_name TEXT, customer_phone TEXT, customer_address TEXT,
          notes TEXT, items TEXT, total REAL, status TEXT DEFAULT 'pending', created_at TEXT
        )
      `);
      const result = await db.execute("SELECT * FROM orders ORDER BY rowid DESC LIMIT 100");
      const orders = (result.rows || []).map((r: any) => {
        let parsedItems: any[] = [];
        if (typeof r.items === "string" && r.items.trim()) {
          try {
            const parsed = JSON.parse(r.items);
            if (Array.isArray(parsed)) parsedItems = parsed;
          } catch {
            parsedItems = [];
          }
        } else if (Array.isArray(r.items)) {
          parsedItems = r.items;
        }

        return {
          id: String(r.id || ""),
          customerName: String(r.customer_name || ""),
          customerPhone: String(r.customer_phone || ""),
          customerAddress: String(r.customer_address || ""),
          notes: String(r.notes || ""),
          items: parsedItems,
          total: Number(r.total || 0),
          status: String(r.status || "pending"),
          createdAt: String(r.created_at || new Date().toISOString()),
        };
      });
      return json({ success: true, orders, source: "turso" });
    } catch (e: any) {
      console.error("Fetch orders error:", e);
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
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  const ALLOWED = ["pending", "processing", "completed", "cancelled"];
  if (!body || typeof body.id !== "string" || body.id.length > 64 || !ALLOWED.includes(body.status)) {
    return json({ error: "Invalid input" }, 400);
  }

  const tursoUrl = env?.TURSO_DATABASE_URL;
  const tursoToken = env?.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken && typeof tursoUrl === "string" && typeof tursoToken === "string" && tursoUrl.trim() && tursoToken.trim()) {
    try {
      const db = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
      await db.execute({
        sql: "UPDATE orders SET status = ? WHERE id = ?",
        args: [body.status, body.id],
      });
      return json({ success: true, id: body.id, status: body.status });
    } catch (e: any) {
      console.error("Update order status error:", e);
      return json({ success: false, error: "Server error" }, 500);
    }
  }
  return json({ success: true, id: body.id, status: body.status, mock: true });
};
