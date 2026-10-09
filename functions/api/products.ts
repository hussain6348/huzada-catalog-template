/// <reference types="@cloudflare/workers-types" />
import { createClient } from '@libsql/client/web';
import { verifyAuthToken, unauthorizedResponse } from './_auth';

export const onRequestGet = async (context: any) => {
  const { env } = context;

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await db.execute(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          price REAL,
          category TEXT,
          images TEXT,
          image TEXT,
          stock INTEGER DEFAULT 10,
          badge TEXT,
          created_at TEXT
        )
      `);

      const result = await db.execute('SELECT * FROM products ORDER BY rowid DESC');
      const products = result.rows.map(r => {
        let images: string[] = [];
        try {
          if (typeof r.images === 'string') {
            images = JSON.parse(r.images);
          } else if (Array.isArray(r.images)) {
            images = r.images;
          }
        } catch {
          images = [];
        }
        if (images.length === 0 && r.image) {
          images = [String(r.image)];
        }

        return {
          id: r.id,
          name: r.name,
          description: r.description || '',
          price: Number(r.price || 0),
          category: r.category || 'General',
          images: images.slice(0, 5),
          image: images[0] || (r.image ? String(r.image) : ''),
          stock: Number(r.stock ?? 10),
          badge: r.badge || undefined,
        };
      });

      return new Response(JSON.stringify({ success: true, products }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      console.error('Turso fetch products error:', e);
    }
  }

  return new Response(JSON.stringify({ success: true, products: [], source: 'fallback' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestPost = async (context: any) => {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization');
  const isAuthorized = await verifyAuthToken(authHeader, env);
  if (!isAuthorized) {
    return unauthorizedResponse('Authentication required to modify inventory items.');
  }

  const product = await request.json();

  const imagesArray = Array.isArray(product.images) && product.images.length > 0
    ? product.images.slice(0, 5)
    : (product.image ? [product.image] : []);
  const primaryImage = imagesArray[0] || product.image || '';

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await db.execute(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          price REAL,
          category TEXT,
          images TEXT,
          image TEXT,
          stock INTEGER DEFAULT 10,
          badge TEXT,
          created_at TEXT
        )
      `);

      await db.execute({
        sql: `INSERT INTO products (id, name, description, price, category, images, image, stock, badge, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                price = excluded.price,
                category = excluded.category,
                images = excluded.images,
                image = excluded.image,
                stock = excluded.stock,
                badge = excluded.badge`,
        args: [
          product.id,
          product.name,
          product.description || '',
          product.price || 0,
          product.category || 'General',
          JSON.stringify(imagesArray),
          primaryImage,
          product.stock ?? 10,
          product.badge || null,
          new Date().toISOString(),
        ],
      });

      return new Response(JSON.stringify({ success: true, product: { ...product, images: imagesArray, image: primaryImage } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      console.error('Turso save product error:', e);
    }
  }

  return new Response(JSON.stringify({ success: true, product: { ...product, images: imagesArray, image: primaryImage }, source: 'fallback' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestDelete = async (context: any) => {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization');
  const isAuthorized = await verifyAuthToken(authHeader, env);
  if (!isAuthorized) {
    return unauthorizedResponse('Authentication required to delete inventory items.');
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id && env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await db.execute({
        sql: 'DELETE FROM products WHERE id = ?',
        args: [id],
      });
    } catch (e: any) {
      console.error('Turso delete product error:', e);
    }
  }

  return new Response(JSON.stringify({ success: true, id }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
