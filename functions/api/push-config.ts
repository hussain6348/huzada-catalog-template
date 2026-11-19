// @ts-nocheck
import { verifyAuth } from './utils/auth';
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export const onRequestGet = async (context: any) => {
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

  try {
    const config = await getOrCreateVapidConfig(db);
    return new Response(
      JSON.stringify({ publicKey: config.publicKey }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to get VAPID configuration' }),
      { status: 500, headers: jsonHeaders }
    );
  }
};
