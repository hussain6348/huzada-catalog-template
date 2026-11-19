// @ts-nocheck
import { verifyAuth } from './utils/auth';
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export const onRequestPost = async (context: any) => {
  const authRes = await verifyAuth(context.request, context.env);
  if (authRes) {
    return authRes;
  }

  const db = createDbClient(context.env);
  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Turso database credentials missing in environment' }),
      { status: 503, headers: jsonHeaders }
    );
  }

  await ensurePushTables(db);

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON request body' }),
      { status: 400, headers: jsonHeaders }
    );
  }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    typeof p256dh !== 'string' ||
    !p256dh ||
    typeof auth !== 'string' ||
    !auth
  ) {
    return new Response(
      JSON.stringify({ error: 'Invalid push subscription payload' }),
      { status: 400, headers: jsonHeaders }
    );
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

    return new Response(
      JSON.stringify({ success: true, message: 'Subscribed' }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to save subscription' }),
      { status: 500, headers: jsonHeaders }
    );
  }
};

export const onRequestDelete = async (context: any) => {
  const authRes = await verifyAuth(context.request, context.env);
  if (authRes) {
    return authRes;
  }

  const db = createDbClient(context.env);
  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Turso database credentials missing in environment' }),
      { status: 503, headers: jsonHeaders }
    );
  }

  await ensurePushTables(db);

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON request body' }),
      { status: 400, headers: jsonHeaders }
    );
  }

  const endpoint = body?.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid endpoint' }),
      { status: 400, headers: jsonHeaders }
    );
  }

  try {
    await db.execute({
      sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
      args: [endpoint],
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Unsubscribed' }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to delete subscription' }),
      { status: 500, headers: jsonHeaders }
    );
  }
};
