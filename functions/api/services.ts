// @ts-nocheck
import { createClient } from '@libsql/client/web';

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
      return new Response(JSON.stringify({ error: 'Turso database credentials missing in environment' }), {
        headers: jsonHeaders,
        status: 503,
      });
    }

    const client = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    await client.execute(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY, name TEXT, category TEXT, price INTEGER,
        duration TEXT, description TEXT, images TEXT, badge TEXT
      )
    `);

    const result = await client.execute('SELECT * FROM services');
    const services = (result.rows || []).map((row: any) => ({
      id: row.id, 
      name: row.name, 
      category: row.category, 
      price: row.price,
      duration: row.duration != null ? String(row.duration) : '30 mins', 
      description: row.description, 
      badge: row.badge,
      images: (() => {
        try {
          return typeof row.images === 'string' ? JSON.parse(row.images || '[]') : (row.images || []);
        } catch {
          return [row.images].filter(Boolean);
        }
      })()
    }));

    return new Response(JSON.stringify(services), {
      headers: jsonHeaders,
      status: 200,
    });
  } catch (err: any) {
    console.error("GET Services Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to get services' }), {
      headers: jsonHeaders,
      status: 500,
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: 'Turso database credentials missing in environment' }), {
        headers: jsonHeaders,
        status: 503,
      });
    }

    const client = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
        headers: jsonHeaders,
        status: 400,
      });
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

    await client.execute({
      sql: `INSERT INTO services (id, name, category, price, duration, description, images, badge)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, category=excluded.category, price=excluded.price,
            duration=excluded.duration, description=excluded.description, images=excluded.images, badge=excluded.badge`,
      args: [id, name, category, price, duration, description, imagesJson, badge]
    });

    return new Response(JSON.stringify({ success: true, id }), {
      headers: jsonHeaders,
      status: 200,
    });
  } catch (err: any) {
    console.error("POST Services Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to save service' }), {
      headers: jsonHeaders,
      status: 500,
    });
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: 'Turso database credentials missing in environment' }), {
        headers: jsonHeaders,
        status: 503,
      });
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
      return new Response(JSON.stringify({ error: 'Missing service ID to delete' }), {
        headers: jsonHeaders,
        status: 400,
      });
    }

    const client = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    await client.execute({
      sql: 'DELETE FROM services WHERE id = ?',
      args: [id],
    });

    return new Response(JSON.stringify({ success: true, id }), {
      headers: jsonHeaders,
      status: 200,
    });
  } catch (err: any) {
    console.error("DELETE Services Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to delete service' }), {
      headers: jsonHeaders,
      status: 500,
    });
  }
};
