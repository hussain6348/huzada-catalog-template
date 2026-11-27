// @ts-nocheck
import { createClient } from '@libsql/client/web';
import { requireAdmin, json } from '../_lib/guard';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export async function onRequestGet(context: any) {
  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return json({ success: true, businessInfo: null }, 200, jsonHeaders);
    }

    const db = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    let res;
    try {
      res = await db.execute({
        sql: 'SELECT data FROM business_info WHERE id = ?',
        args: ['default'],
      });
    } catch {
      await db.execute('CREATE TABLE IF NOT EXISTS business_info (id TEXT PRIMARY KEY, data TEXT)');
      res = await db.execute({
        sql: 'SELECT data FROM business_info WHERE id = ?',
        args: ['default'],
      });
    }

    if (res.rows && res.rows.length > 0 && res.rows[0].data) {
      const businessInfo = JSON.parse(res.rows[0].data as string);
      return json({ success: true, businessInfo }, 200, jsonHeaders);
    }

    return json({ success: true, businessInfo: null }, 200, jsonHeaders);
  } catch (e: any) {
    return json({ success: false, error: e.message }, 500, jsonHeaders);
  }
}

export async function onRequestPost(context: any) {
  const denied = await requireAdmin(context.request, context.env);
  if (denied) return denied;

  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return json({ success: false, error: 'Turso credentials missing' }, 200, jsonHeaders);
    }

    const db = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'Invalid JSON request body' }, 400, jsonHeaders);
    }

    const serializedData = JSON.stringify(body);

    const upsertBiz = () => db.execute({
      sql: 'INSERT INTO business_info (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      args: ['default', serializedData],
    });

    try {
      await upsertBiz();
    } catch {
      await db.execute('CREATE TABLE IF NOT EXISTS business_info (id TEXT PRIMARY KEY, data TEXT)');
      await upsertBiz();
    }

    if (body.promoText !== undefined) {
      const upsertPromo = () => db.execute({
        sql: 'INSERT INTO theme_settings (slot_id, image_url) VALUES (?, ?) ON CONFLICT(slot_id) DO UPDATE SET image_url=excluded.image_url',
        args: ['promo_text', body.promoText || ''],
      });
      try {
        await upsertPromo();
      } catch {
        await db.execute('CREATE TABLE IF NOT EXISTS theme_settings (slot_id TEXT PRIMARY KEY, image_url TEXT)');
        await upsertPromo();
      }
    }

    return json({ success: true }, 200, jsonHeaders);
  } catch (e: any) {
    return json({ success: false, error: e.message }, 500, jsonHeaders);
  }
}
