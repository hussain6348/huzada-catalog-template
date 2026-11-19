// @ts-nocheck
import { createClient } from '@libsql/client/web';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export async function onRequestGet(context: any) {
  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: 'Turso credentials missing' }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const db = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    await db.execute('CREATE TABLE IF NOT EXISTS business_info (id TEXT PRIMARY KEY, data TEXT)');
    const res = await db.execute({
      sql: 'SELECT data FROM business_info WHERE id = ?',
      args: ['default'],
    });

    if (res.rows && res.rows.length > 0 && res.rows[0].data) {
      const businessInfo = JSON.parse(res.rows[0].data as string);
      return new Response(JSON.stringify({ success: true, businessInfo }), {
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true, businessInfo: null }), {
      headers: jsonHeaders,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
}

export async function onRequestPost(context: any) {
  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: 'Turso credentials missing' }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const db = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    await db.execute('CREATE TABLE IF NOT EXISTS business_info (id TEXT PRIMARY KEY, data TEXT)');
    await db.execute('CREATE TABLE IF NOT EXISTS theme_settings (slot_id TEXT PRIMARY KEY, image_url TEXT)');

    const body = await context.request.json();

    // Ensure body contains promoText preserved in JSON stringify payload alongside R2 image slots
    const serializedData = JSON.stringify(body);

    await db.execute({
      sql: 'INSERT INTO business_info (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      args: ['default', serializedData],
    });

    // Also sync promoText to theme_settings table if provided
    if (body.promoText !== undefined) {
      await db.execute({
        sql: 'INSERT INTO theme_settings (slot_id, image_url) VALUES (?, ?) ON CONFLICT(slot_id) DO UPDATE SET image_url=excluded.image_url',
        args: ['promo_text', body.promoText || ''],
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: jsonHeaders,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
}
