/// <reference types="@cloudflare/workers-types" />
import { createClient } from '@libsql/client/web';
import { verifyAuthToken, unauthorizedResponse } from './_auth';

async function initProductsTable(db: any) {
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

  // Ensure all expected columns are automatically ensured before insertion.
  // Run safe migration queries inside isolated try-catch blocks and silently ignore if column already exists.
  const migrations = [
    'ALTER TABLE products ADD COLUMN category TEXT',
    'ALTER TABLE products ADD COLUMN images TEXT',
    'ALTER TABLE products ADD COLUMN image TEXT',
    'ALTER TABLE products ADD COLUMN description TEXT',
    'ALTER TABLE products ADD COLUMN price REAL',
    'ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10',
    'ALTER TABLE products ADD COLUMN badge TEXT',
    'ALTER TABLE products ADD COLUMN created_at TEXT',
  ];

  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch {
      // Catch and silently ignore any "duplicate column name" errors so it never throws on columns that already exist.
    }
  }
}

export const onRequestGet = async (context: any) => {
  const { env } = context;

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await initProductsTable(db);

      const result = await db.execute('SELECT * FROM products ORDER BY rowid DESC');
      const products = result.rows.map(r => {
        let images: string[] = [];
        try {
          if (typeof r.images === 'string' && r.images.trim().length > 0) {
            const parsed = JSON.parse(r.images);
            if (Array.isArray(parsed)) {
              images = parsed.filter(url => typeof url === 'string' && url.trim().length > 0);
            }
          } else if (Array.isArray(r.images)) {
            images = r.images.filter(url => typeof url === 'string' && url.trim().length > 0);
          }
        } catch {
          images = [];
        }

        if (images.length === 0 && r.image) {
          images = [String(r.image)];
        }

        return {
          id: String(r.id),
          name: String(r.name || ''),
          description: String(r.description || ''),
          price: Number(r.price || 0),
          category: String(r.category || 'General'),
          images: images.slice(0, 5),
          image: images[0] || (r.image ? String(r.image) : ''),
          stock: Number(r.stock ?? 10),
          badge: r.badge ? String(r.badge) : undefined,
        };
      });

      return new Response(JSON.stringify({ success: true, products }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      console.error('Turso fetch products error:', e);
      return new Response(JSON.stringify({ success: false, error: e.message || 'Database query error', products: [] }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
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

  let body: any;
  try {
    body = await request.json();
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Strict Parameter Normalization & Type Casting
  const id: string = String(body.id || `prod_${Date.now()}`);
  const name: string = String(body.name || '');
  const description: string = String(body.description || '');
  const category: string = String(body.category || 'General');
  const price: number = parseFloat(body.price) || 0.0;
  const stock: number = parseInt(body.stock, 10) || 0;
  const imagesJsonString: string = JSON.stringify(Array.isArray(body.images) ? body.images : [body.image].filter(Boolean));
  const primaryImage: string = String(Array.isArray(body.images) && body.images.length > 0 ? body.images[0] : (body.image || ''));
  const createdAt: string = new Date().toISOString();

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await initProductsTable(db);

      try {
        await db.execute({
          sql: `INSERT INTO products (id, name, description, category, price, stock, images, image, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  description = excluded.description,
                  category = excluded.category,
                  price = excluded.price,
                  stock = excluded.stock,
                  images = excluded.images,
                  image = excluded.image`,
          args: [id, name, description, category, price, stock, imagesJsonString, primaryImage, createdAt],
        });
      } catch (upsertError: any) {
        // Fallback to direct INSERT if ON CONFLICT clause is not supported on the target schema
        await db.execute({
          sql: `INSERT INTO products (id, name, description, category, price, stock, images, image, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [id, name, description, category, price, stock, imagesJsonString, primaryImage, createdAt],
        });
      }

      const responseProduct = {
        ...body,
        id,
        name,
        description,
        category,
        price,
        stock,
        images: Array.isArray(body.images) ? body.images : [body.image].filter(Boolean),
        image: primaryImage,
        created_at: createdAt,
      };

      return new Response(JSON.stringify({ success: true, product: responseProduct }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      console.error('Turso save product error:', e);
      return new Response(JSON.stringify({ success: false, error: e.message || 'Failed to save product in database' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Fallback when Turso env variables are not present
  const fallbackProduct = {
    ...body,
    id,
    name,
    description,
    category,
    price,
    stock,
    images: Array.isArray(body.images) ? body.images : [body.image].filter(Boolean),
    image: primaryImage,
    created_at: createdAt,
  };

  return new Response(JSON.stringify({ success: true, product: fallbackProduct, source: 'fallback' }), {
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
      await initProductsTable(db);
      await db.execute({
        sql: 'DELETE FROM products WHERE id = ?',
        args: [String(id)],
      });
    } catch (e: any) {
      console.error('Turso delete product error:', e);
      return new Response(JSON.stringify({ success: false, error: e.message || 'Failed to delete product' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ success: true, id }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
