import { createClient } from '@libsql/client/web';

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export async function onRequestPost(context: any) {
  try {
    const env = context?.env || {};
    const tursoUrl = env.TURSO_DATABASE_URL;
    const tursoToken = env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken || typeof tursoUrl !== 'string' || typeof tursoToken !== 'string' || !tursoUrl.trim() || !tursoToken.trim()) {
      return jsonResponse({ success: false, error: 'Database pending' }, 400);
    }

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      body = {};
    }

    const { name, price, description, image_path } = body;
    const client = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        description TEXT,
        image_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.execute({
      sql: 'INSERT INTO products (name, price, description, image_path) VALUES (?, ?, ?, ?)',
      args: [name || '', price || 0, description || '', image_path || '']
    });

    return jsonResponse({ success: true });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || 'Server error' }, 500);
  }
}

export async function onRequestGet(context: any) {
  try {
    const env = context?.env || {};
    const tursoUrl = env.TURSO_DATABASE_URL;
    const tursoToken = env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken || typeof tursoUrl !== 'string' || typeof tursoToken !== 'string' || !tursoUrl.trim() || !tursoToken.trim()) {
      return jsonResponse({ success: true, products: [] });
    }

    const client = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        description TEXT,
        image_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await client.execute('SELECT * FROM products ORDER BY created_at DESC');
    return jsonResponse({ success: true, products: result.rows || [] });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || 'Server error' }, 500);
  }
}
