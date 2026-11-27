import { createClient } from '@libsql/client/web';
import { requireAdmin, json } from '../_lib/guard';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: jsonHeaders,
  });
}

export async function onRequestGet(context: any) {
  try {
    const env = context.env || {};
    const tursoUrl = (env.TURSO_DATABASE_URL || '').trim();
    const tursoToken = (env.TURSO_AUTH_TOKEN || '').trim();

    if (!tursoUrl || !tursoToken) {
      return json({ image_url: null }, 200, jsonHeaders);
    }

    if (
      !tursoUrl.startsWith('libsql://') &&
      !tursoUrl.startsWith('https://') &&
      !tursoUrl.startsWith('http://') &&
      !tursoUrl.startsWith('wss://')
    ) {
      return json({ image_url: null }, 200, jsonHeaders);
    }

    const db = createClient({ url: tursoUrl, authToken: tursoToken });

    const url = new URL(context.request.url);
    const slotId = (url.searchParams.get('slot') || '').trim();

    let res;
    try {
      if (slotId) {
        res = await db.execute({ sql: 'SELECT image_url FROM theme_settings WHERE slot_id = ?', args: [slotId] });
      } else {
        res = await db.execute('SELECT * FROM theme_settings');
      }
    } catch {
      await db.execute('CREATE TABLE IF NOT EXISTS theme_settings (slot_id TEXT PRIMARY KEY, image_url TEXT)');
      if (slotId) {
        res = await db.execute({ sql: 'SELECT image_url FROM theme_settings WHERE slot_id = ?', args: [slotId] });
      } else {
        res = await db.execute('SELECT * FROM theme_settings');
      }
    }

    if (slotId) {
      let imageUrl = res?.rows && res.rows.length > 0 ? (res.rows[0].image_url as string | null) : null;

      // Resilient Dual-Source Fallback: If not found in theme_settings, check business_info.imageSlots
      if (!imageUrl) {
        try {
          const bizRes = await db.execute({ sql: 'SELECT data FROM business_info WHERE id = ?', args: ['default'] });
          if (bizRes.rows && bizRes.rows.length > 0 && bizRes.rows[0]?.data) {
            const bizData = JSON.parse(bizRes.rows[0].data as string);
            imageUrl = bizData?.imageSlots?.[slotId] || (slotId === 'logo' ? bizData?.logo : null) || null;
          }
        } catch {}
      }

      return json({ image_url: imageUrl }, 200, jsonHeaders);
    } else {
      let allRows = (res?.rows || []).map((r: any) => ({ slot_id: r.slot_id, image_url: r.image_url }));
      try {
        const bizRes = await db.execute({ sql: 'SELECT data FROM business_info WHERE id = ?', args: ['default'] });
        if (bizRes.rows && bizRes.rows.length > 0 && bizRes.rows[0]?.data) {
          const bizData = JSON.parse(bizRes.rows[0].data as string);
          const existingSlots = new Set(allRows.map((r: any) => r.slot_id));
          if (bizData?.logo && !existingSlots.has('logo')) {
            allRows.push({ slot_id: 'logo', image_url: bizData.logo });
            existingSlots.add('logo');
          }
          if (bizData?.imageSlots && typeof bizData.imageSlots === 'object') {
            for (const [sId, sUrl] of Object.entries(bizData.imageSlots)) {
              if (sUrl && !existingSlots.has(sId)) {
                allRows.push({ slot_id: sId, image_url: sUrl as string });
                existingSlots.add(sId);
              }
            }
          }
        }
      } catch {}
      return json(allRows, 200, jsonHeaders);
    }
  } catch (e: any) {
    return json({ error: e.message || 'Failed to fetch media' }, 500, jsonHeaders);
  }
}

export async function onRequestPost(context: any) {
  const denied = await requireAdmin(context.request, context.env);
  if (denied) return denied;

  try {
    const env = context.env || {};
    const tursoUrl = (env.TURSO_DATABASE_URL || '').trim();
    const tursoToken = (env.TURSO_AUTH_TOKEN || '').trim();

    if (!tursoUrl || !tursoToken) {
      return json({ success: false, error: 'Turso credentials missing' }, 503, jsonHeaders);
    }

    const db = createClient({ url: tursoUrl, authToken: tursoToken });
    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'Invalid JSON request' }, 400, jsonHeaders);
    }

    const slotId = body?.slot_id ?? body?.slot ?? body?.slotId ?? (body?.logo !== undefined ? 'logo' : null);
    const imageUrl = body?.image_url ?? body?.imageUrl ?? body?.url ?? (typeof body?.logo === 'string' ? body.logo : null);

    if (slotId) {
      const upsertSlot = () => db.execute({
        sql: 'INSERT INTO theme_settings (slot_id, image_url) VALUES (?, ?) ON CONFLICT(slot_id) DO UPDATE SET image_url=excluded.image_url',
        args: [slotId, imageUrl ?? null]
      });
      try {
        await upsertSlot();
      } catch {
        await db.execute('CREATE TABLE IF NOT EXISTS theme_settings (slot_id TEXT PRIMARY KEY, image_url TEXT)');
        await upsertSlot();
      }
    }

    // Resilient Dual-Sync: Safely merge into business_info JSON blob
    const syncBizInfo = async () => {
      let bizRes;
      try {
        bizRes = await db.execute({ sql: 'SELECT data FROM business_info WHERE id = ?', args: ['default'] });
      } catch {
        await db.execute('CREATE TABLE IF NOT EXISTS business_info (id TEXT PRIMARY KEY, data TEXT)');
        bizRes = await db.execute({ sql: 'SELECT data FROM business_info WHERE id = ?', args: ['default'] });
      }

      let bizData: Record<string, any> = {};
      if (bizRes.rows && bizRes.rows.length > 0 && bizRes.rows[0]?.data) {
        try {
          bizData = JSON.parse(bizRes.rows[0].data as string) || {};
        } catch {
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
    };

    try {
      await syncBizInfo();
    } catch (syncErr) {
      console.warn('Sync to business_info warning:', syncErr);
    }

    return json({ success: true, slot_id: slotId, image_url: imageUrl }, 200, jsonHeaders);
  } catch (e: any) {
    return json({ error: e.message || 'Failed to update media' }, 500, jsonHeaders);
  }
}
