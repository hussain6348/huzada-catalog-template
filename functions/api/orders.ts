import { createClient } from "@libsql/client/web";
import { requireAdmin, json } from "../_lib/guard";

async function ensureOrdersTable(db: any) {
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
}

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
  const rawLimit = parseInt(url.searchParams.get("limit") || url.searchParams.get("pageSize") || "50", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
  const offset = (page - 1) * limit;

  const statusParam = (url.searchParams.get("status") || "").trim().toLowerCase();
  const searchParam = (url.searchParams.get("search") || url.searchParams.get("q") || "").trim();

  const tursoUrl = env?.TURSO_DATABASE_URL;
  const tursoToken = env?.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken && typeof tursoUrl === "string" && typeof tursoToken === "string" && tursoUrl.trim() && tursoToken.trim()) {
    try {
      const db = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
      await ensureOrdersTable(db);

      // Build parameterized filter conditions
      const whereClauses: string[] = [];
      const queryArgs: any[] = [];

      if (statusParam && statusParam !== "all") {
        whereClauses.push("status = ?");
        queryArgs.push(statusParam);
      }

      if (searchParam) {
        whereClauses.push("(customer_name LIKE ? OR customer_phone LIKE ? OR id LIKE ?)");
        const pattern = `%${searchParam}%`;
        queryArgs.push(pattern, pattern, pattern);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Total count query for pagination metadata
      const countRes = await db.execute({
        sql: `SELECT COUNT(*) as total FROM orders ${whereSql}`,
        args: [...queryArgs],
      });
      const totalCount = Number(countRes.rows?.[0]?.total ?? 0);
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const hasMore = page < totalPages;

      // Explicit column query with bounded pagination
      const dataArgs = [...queryArgs, limit, offset];
      const result = await db.execute({
        sql: `SELECT id, customer_name, customer_phone, customer_address, notes, items, total, status, created_at 
              FROM orders ${whereSql} 
              ORDER BY rowid DESC 
              LIMIT ? OFFSET ?`,
        args: dataArgs,
      });

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

      return json({
        success: true,
        orders,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasMore,
        },
        source: "turso",
      });
    } catch (e: any) {
      console.error("Fetch orders error:", e);
      return json({ success: false, error: "Database error fetching orders", orders: [] }, 500);
    }
  }

  return json({
    success: true,
    orders: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 1, hasMore: false },
    source: "fallback",
  });
};

export const onRequestPatch = async (context: any) => {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON format" }, 400);
  }

  const ALLOWED_STATUSES = ["pending", "processing", "completed", "cancelled"];
  if (!body || typeof body.id !== "string" || body.id.length > 64 || !ALLOWED_STATUSES.includes(body.status)) {
    return json({ error: "Invalid order update payload" }, 400);
  }

  const tursoUrl = env?.TURSO_DATABASE_URL;
  const tursoToken = env?.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken && typeof tursoUrl === "string" && typeof tursoToken === "string" && tursoUrl.trim() && tursoToken.trim()) {
    try {
      const db = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
      await ensureOrdersTable(db);
      await db.execute({
        sql: "UPDATE orders SET status = ? WHERE id = ?",
        args: [body.status, body.id],
      });
      return json({ success: true, id: body.id, status: body.status });
    } catch (e: any) {
      console.error("Update order status error:", e);
      return json({ success: false, error: "Failed to update order status" }, 500);
    }
  }

  return json({ success: true, id: body.id, status: body.status, source: "mock" });
};
