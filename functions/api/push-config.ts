import { requireAdmin, json } from '../_lib/guard';
import { createDbClient, getOrCreateVapidConfig } from '../_lib/push';

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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
    },
  });
};

export const onRequestGet = async (context: any) => {
  const denied = await requireAdmin(context.request, context.env);
  if (denied) return denied;

  const db = createDbClient(context.env);
  if (!db) {
    return json({ error: 'Turso database credentials missing in environment' }, 503, jsonHeaders);
  }

  try {
    const config = await getOrCreateVapidConfig(db);
    // Security: Only return the public key, NEVER the private key
    return json({ publicKey: config.publicKey }, 200, jsonHeaders);
  } catch (err: any) {
    console.error("VAPID config error:", err);
    return json({ error: err?.message || 'Failed to get VAPID configuration' }, 500, jsonHeaders);
  }
};
