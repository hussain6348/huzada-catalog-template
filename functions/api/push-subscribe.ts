import { requireAdmin, json } from '../_lib/guard';
import { createDbClient, ensurePushTables } from '../_lib/push';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
    },
  });
};

export const onRequestPost = async (context: any) => {
  const denied = await requireAdmin(context.request, context.env);
  if (denied) return denied;

  const db = createDbClient(context.env);
  if (!db) {
    return json({ error: 'Turso database credentials missing in environment' }, 503, jsonHeaders);
  }

  await ensurePushTables(db);

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON request body' }, 400, jsonHeaders);
  }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  // Strict input validation for push subscription
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    typeof p256dh !== 'string' ||
    !p256dh ||
    typeof auth !== 'string' ||
    !auth
  ) {
    return json({ error: 'Invalid push subscription payload' }, 400, jsonHeaders);
  }

  const userAgent = context.request.headers.get('user-agent') || 'unknown';
  const createdAt = new Date().toISOString();

  try {
    await db.execute({
      sql: `
        INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          user_agent = excluded.user_agent
      `,
      args: [endpoint, p256dh, auth, userAgent, createdAt],
    });

    return json({ success: true, message: 'Subscribed to push alerts' }, 200, jsonHeaders);
  } catch (err: any) {
    console.error("Save subscription error:", err);
    return json({ error: err?.message || 'Failed to save subscription' }, 500, jsonHeaders);
  }
};

export const onRequestDelete = async (context: any) => {
  const denied = await requireAdmin(context.request, context.env);
  if (denied) return denied;

  const db = createDbClient(context.env);
  if (!db) {
    return json({ error: 'Turso database credentials missing in environment' }, 503, jsonHeaders);
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON request body' }, 400, jsonHeaders);
  }

  const endpoint = body?.endpoint;
  if (!endpoint || typeof endpoint !== 'string') {
    return json({ error: 'Missing subscription endpoint to delete' }, 400, jsonHeaders);
  }

  try {
    await db.execute({
      sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
      args: [endpoint],
    });

    return json({ success: true, message: 'Unsubscribed from push alerts' }, 200, jsonHeaders);
  } catch (err: any) {
    console.error("Delete subscription error:", err);
    return json({ error: err?.message || 'Failed to delete subscription' }, 500, jsonHeaders);
  }
};
