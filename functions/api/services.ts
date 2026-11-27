// @ts-nocheck
import { createClient } from '@libsql/client/web';
import { requireAdmin, json } from '../_lib/guard';

interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return json([], 200, jsonHeaders);
    }

    const client = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    const url = new URL(context.request.url);
    const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
    const rawLimit = parseInt(url.searchParams.get("limit") || url.searchParams.get("pageSize") || "50", 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
    const offset = (page - 1) * limit;

    const runQuery = () => client.execute({
      sql: 'SELECT * FROM services ORDER BY rowid DESC LIMIT ? OFFSET ?',
      args: [limit, offset],
    });

    let result;
    try {
      result = await runQuery();
    } catch {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY, name TEXT, category TEXT, price INTEGER,
          duration TEXT, description TEXT, images TEXT, badge TEXT
        )
      `);
      result = await runQuery();
    }
    const services = (result.rows || []).map((row: any) => ({
      id: String(row.id || ''), 
      name: String(row.name || ''), 
      category: String(row.category || 'General'), 
      price: Number(row.price || 0),
      duration: row.duration != null ? String(row.duration) : '30 mins', 
      description: String(row.description || ''), 
      badge: row.badge ? String(row.badge) : undefined,
      images: (() => {
        try {
          return typeof row.images === 'string' ? JSON.parse(row.images || '[]') : (row.images || []);
        } catch {
          return [row.images].filter(Boolean);
        }
      })()
    }));

    return json(services, 200, jsonHeaders);
  } catch (err: any) {
    console.error("GET Services Error:", err);
    return json({ error: err.message || 'Failed to get services' }, 500, jsonHeaders);
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const denied = await requireAdmin(context.request, context.env);
  if (denied) return denied;

  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return json({ error: 'Turso database credentials missing in environment' }, 503, jsonHeaders);
    }

    const client = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'Invalid JSON request body' }, 400, jsonHeaders);
    }
    
    const id = body.id || `SRV-${Math.floor(Math.random() * 10000)}`;
    const name = body.name || 'Untitled Service';
    const category = body.category || 'General';
    const price = Number(body.price) || 0;
    const duration = String(body.duration || (body.duration_minutes ? `${body.duration_minutes} mins` : '') || '30 mins').trim();
    const description = body.description || '';
    const badge = body.badge || '';
    
    let imagesJson = '[]';
    try {
      imagesJson = JSON.stringify(Array.isArray(body.images) ? body.images : [body.images].filter(Boolean));
    } catch {
      imagesJson = '[]';
    }

    const upsertService = () => client.execute({
      sql: `INSERT INTO services (id, name, category, price, duration, description, images, badge)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, category=excluded.category, price=excluded.price,
            duration=excluded.duration, description=excluded.description, images=excluded.images, badge=excluded.badge`,
      args: [id, name, category, price, duration, description, imagesJson, badge]
    });

    try {
      await upsertService();
    } catch {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY, name TEXT, category TEXT, price INTEGER,
          duration TEXT, description TEXT, images TEXT, badge TEXT
        )
      `);
      await upsertService();
    }

    return json({ success: true, id }, 200, jsonHeaders);
  } catch (err: any) {
    console.error("POST Services Error:", err);
    return json({ error: err.message || 'Failed to save service' }, 500, jsonHeaders);
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const denied = await requireAdmin(context.request, context.env);
  if (denied) return denied;

  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return json({ error: 'Turso database credentials missing in environment' }, 503, jsonHeaders);
    }

    const url = new URL(context.request.url);
    let id = url.searchParams.get('id');

    if (!id) {
      try {
        const body: any = await context.request.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return json({ error: 'Missing service ID to delete' }, 400, jsonHeaders);
    }

    const client = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    await client.execute({
      sql: 'DELETE FROM services WHERE id = ?',
      args: [id],
    });

    return json({ success: true, id }, 200, jsonHeaders);
  } catch (err: any) {
    console.error("DELETE Services Error:", err);
    return json({ error: err.message || 'Failed to delete service' }, 500, jsonHeaders);
  }
};
