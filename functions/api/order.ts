import { createClient } from "@libsql/client/web";
import { json } from "../_lib/guard";
import { sendBookingPushAlerts } from "../_lib/push";

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  // Security: Cap input lengths to prevent database exhaustion
  const orderId = String(body.orderId || `ORD-${Date.now()}`).substring(0, 50);
  const customerName = String(body.customerName || "").substring(0, 100);
  const customerPhone = String(body.customerPhone || "").substring(0, 50);
  const customerAddress = String(body.customerAddress || "").substring(0, 300);
  const notes = String(body.notes || "").substring(0, 500);
  const total = Math.min(Number(body.total) || 0, 9999999);
  const status = "pending";

  let items: any[] = [];
  if (Array.isArray(body.items)) {
    items = body.items.slice(0, 50); // Cap at 50 items
  }

  const tursoUrl = env?.TURSO_DATABASE_URL;
  const tursoToken = env?.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken && typeof tursoUrl === "string" && typeof tursoToken === "string" && tursoUrl.trim() && tursoToken.trim()) {
    try {
      const db = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
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
          customerName,
          customerPhone,
          customerAddress,
          notes,
          JSON.stringify(items),
          total,
          status,
          new Date().toISOString(),
        ],
      });

      const customerLabel = customerName.trim() || "New Customer";
      const firstItemName = (items[0]?.name || "").trim();
      const itemLabel = firstItemName
        ? (items.length > 1 ? `${firstItemName} +${items.length - 1} more` : firstItemName)
        : (items.length > 0 ? `${items.length} items` : "Order");
      const detailLabel = total > 0 ? `Rs. ${total}` : "";

      const pushPromise = sendBookingPushAlerts(db, {
        title: "New Order Received",
        body: `${customerLabel} placed an order for ${itemLabel}${detailLabel ? ` (${detailLabel})` : ""}`,
        url: "/admin",
      }).catch((err) => console.error("Push notification failed:", err));

      if (typeof context?.waitUntil === "function") {
        context.waitUntil(pushPromise);
      }
    } catch (e) {
      console.error("Turso DB error in order creation:", e);
    }
  }

  return json({ success: true, orderId });
};
