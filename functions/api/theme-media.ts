import { createClient } from '@libsql/client/web';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export async function onRequestGet(context: any) {
  try {
    const env = context.env;
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) return new Response(JSON.stringify({}), { status: 200, headers: jsonHeaders });

    const db = createClient({ url: env.TURSO_DATABASE_URL.trim(), authToken: env.TURSO_AUTH_TOKEN.trim() });
    await db.execute('CREATE TABLE IF NOT EXISTS theme_settings (slot_id TEXT PRIMARY KEY, image_url TEXT)');

    const url = new URL(context.request.url);
    const slotId = url.searchParams.get('slot');

    if (slotId) {
      const res = await db.execute({ sql: 'SELECT image_url FROM theme_settings WHERE slot_id = ?', args: [slotId] });
      return new Response(JSON.stringify({ image_url: res.rows.length > 0 ? res.rows[0].image_url : null }), { headers: jsonHeaders });
    } else {
      const res = await db.execute('SELECT * FROM theme_settings');
      return new Response(JSON.stringify(res.rows), { headers: jsonHeaders });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: jsonHeaders });
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

    const db = createClient({ url: env.TURSO_DATABASE_URL.trim(), authToken: env.TURSO_AUTH_TOKEN.trim() });
    const body = await context.request.json();

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
      } catch {
        bizData = {};
      }
    }
    bizData.imageSlots = bizData.imageSlots || {};
    if (slotId && imageUrl) {
      bizData.imageSlots[slotId] = imageUrl;
      if (slotId === 'logo') {
        bizData.logo = imageUrl;
      }
    }
    await db.execute({
      sql: 'INSERT INTO business_info (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      args: ['default', JSON.stringify(bizData) || '{}'],
    });

    return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
  } catch (e: any) {
     return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: jsonHeaders });
  }
}