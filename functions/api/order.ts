import { createClient } from "@libsql/client/web";
import { json } from "../_lib/guard";
import { sendOrderPushAlerts } from "../_lib/push";

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
    return json({ error: "Invalid JSON format" }, 400);
  }

  // Security & Validation: Strict input length and numeric clamping
  const rawId = String(body.orderId || `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
  const orderId = rawId.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50);
  const customerName = String(body.customerName || "Customer").trim().substring(0, 100);
  const customerPhone = String(body.customerPhone || "").trim().substring(0, 50);
  const customerAddress = String(body.customerAddress || "").trim().substring(0, 300);
  const notes = String(body.notes || "").trim().substring(0, 500);
  const total = Math.max(0, Math.min(Number(body.total) || 0, 9999999));
  const status = "pending";

  let items: any[] = [];
  if (Array.isArray(body.items)) {
    items = body.items.slice(0, 50).map((it: any) => ({
      id: String(it?.id || it?.product?.id || ""),
      name: String(it?.name || it?.product?.name || "Product").substring(0, 100),
      price: Math.max(0, Number(it?.price ?? it?.product?.price ?? 0)),
      quantity: Math.max(1, Math.min(Number(it?.quantity || 1), 999)),
    }));
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
        sql: `INSERT INTO orders (id, customer_name, customer_phone, customer_address, notes, items, total, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                customer_name = excluded.customer_name,
                customer_phone = excluded.customer_phone,
                customer_address = excluded.customer_address,
                notes = excluded.notes,
                items = excluded.items,
                total = excluded.total,
                status = excluded.status`,
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

      // Format clean, professional e-commerce push alert copy
      const customerLabel = customerName.trim() || "Customer";
      const totalItemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
      const firstItemName = (items[0]?.name || "").trim();
      const itemLabel = firstItemName
        ? (items.length > 1 ? `${firstItemName} +${items.length - 1} more` : firstItemName)
        : (totalItemCount > 0 ? `${totalItemCount} item${totalItemCount === 1 ? '' : 's'}` : "Storefront Order");
      const priceLabel = total > 0 ? ` (Total: Rs. ${total})` : "";

      const pushPromise = sendOrderPushAlerts(db, {
        title: "New Order Received",
        body: `${customerLabel} placed an order for ${itemLabel}${priceLabel}`,
        url: "/admin",
      }).catch((err) => console.error("Edge push dispatch failed:", err));

      if (typeof context?.waitUntil === "function") {
        context.waitUntil(pushPromise);
      }
    } catch (e) {
      console.error("Turso DB error in order creation:", e);
    }
  }

  return json({ success: true, orderId, status: "pending" });
};
