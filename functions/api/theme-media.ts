import { createClient } from '@libsql/client/web';
import { requireAdmin, json } from '../_lib/guard';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export async function onRequestGet(context: any) {
  try {
    const env = context.env;
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) return json({}, 200, jsonHeaders);

    const db = createClient({ url: env.TURSO_DATABASE_URL.trim(), authToken: env.TURSO_AUTH_TOKEN.trim() });
    await db.execute('CREATE TABLE IF NOT EXISTS theme_settings (slot_id TEXT PRIMARY KEY, image_url TEXT)');

    const url = new URL(context.request.url);
    const slotId = url.searchParams.get('slot');

    if (slotId) {
      const res = await db.execute({ sql: 'SELECT image_url FROM theme_settings WHERE slot_id = ?', args: [slotId] });
      return json({ image_url: res.rows.length > 0 ? res.rows[0].image_url : null }, 200, jsonHeaders);
    } else {
      const res = await db.execute('SELECT * FROM theme_settings');
      return json(res.rows, 200, jsonHeaders);
    }
  } catch (e: any) {
    return json({ error: e.message }, 500, jsonHeaders);
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

    const db = createClient({ url: env.TURSO_DATABASE_URL.trim(), authToken: env.TURSO_AUTH_TOKEN.trim() });
    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'Invalid JSON request' }, 400, jsonHeaders);
    }

    const slotId = body?.slot_id ?? body?.slot ?? body?.slotId ?? (body?.logo !== undefined ? 'logo' : null);
    const imageUrl = body?.image_url ?? body?.imageUrl ?? body?.url ?? (typeof body?.logo === 'string' ? body.logo : null);

    await db.execute('CREATE TABLE IF NOT EXISTS theme_settings (slot_id TEXT PRIMARY KEY, image_url TEXT)');
    if (slotId) {
      await db.execute({
        sql: 'INSERT INTO theme_settings (slot_id, image_url) VALUES (?, ?) ON CONFLICT(slot_id) DO UPDATE SET image_url=excluded.image_url',
        args: [slotId, imageUrl ?? null]
      });
    }

    // Resilient Dual-Sync: Safely merge into business_info JSON blob
    await db.execute('CREATE TABLE IF NOT EXISTS business_info (id TEXT PRIMARY KEY, data TEXT)');
    const bizRes = await db.execute({ sql: 'SELECT data FROM business_info WHERE id = ?', args: ['default'] });
    let bizData: Record<string, any> = {};
    if (bizRes.rows && bizRes.rows.length > 0 && bizRes.rows[0]?.data) {
      try {
        bizData = JSON.parse(bizRes.rows[0].data as string) || {};
      } catch (err) {
        bizData = {};
      }
    }

    if (!bizData.imageSlots) bizData.imageSlots = {};
    if (slotId) {
      bizData.imageSlots[slotId] = imageUrl ?? null;
      if (slotId === 'logo') bizData.logo = imageUrl ?? null;
      if (slotId === 'hero') bizData.heroImage = imageUrl ?? null;
      if (slotId === 'hero2') bizData.heroImage2 = imageUrl ?? null;
      if (slotId === 'hero3') bizData.heroImage3 = imageUrl ?? null;
    }

    await db.execute({
      sql: 'INSERT INTO business_info (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      args: ['default', JSON.stringify(bizData)]
    });

    return json({ success: true, slot_id: slotId, image_url: imageUrl }, 200, jsonHeaders);
  } catch (e: any) {
    return json({ error: e.message }, 500, jsonHeaders);
  }
}
