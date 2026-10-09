/// <reference types="@cloudflare/workers-types" />
import { createClient } from '@libsql/client/web';
import { verifyAuthToken, unauthorizedResponse } from './_auth';

async function initProductsTable(db: any) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      category TEXT,
      price REAL,
      stock INTEGER DEFAULT 10,
      image TEXT,
      image_path TEXT,
      images TEXT,
      created_at TEXT
    )
  `);

  // Ensure all expected columns are automatically ensured before insertion.
  const migrations = [
    'ALTER TABLE products ADD COLUMN category TEXT',
    'ALTER TABLE products ADD COLUMN price REAL',
    'ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10',
    'ALTER TABLE products ADD COLUMN image TEXT',
    'ALTER TABLE products ADD COLUMN image_path TEXT',
    'ALTER TABLE products ADD COLUMN images TEXT',
    'ALTER TABLE products ADD COLUMN description TEXT',
    'ALTER TABLE products ADD COLUMN created_at TEXT',
  ];

  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch {
      // Catch and silently ignore any "duplicate column name" errors
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
      const products = result.rows.map((row: any) => {
        let parsedImages: string[] = [];
        if (typeof row.images === 'string' && row.images.trim()) {
          try {
            const parsed = JSON.parse(row.images);
            if (Array.isArray(parsed)) parsedImages = parsed.filter(Boolean);
            else if (typeof parsed === 'string' && parsed) parsedImages = [parsed];
          } catch (e) {
            const trimmed = row.images.trim();
            if (trimmed.startsWith('http') || trimmed.startsWith('data:')) {
              parsedImages = [trimmed];
            } else {
              parsedImages = [];
            }
          }
        } else if (Array.isArray(row.images)) {
          parsedImages = row.images.filter(Boolean);
        }

        const primaryCandidate = (
          row.image ||
          row.image_path ||
          parsedImages[0] ||
          (typeof row.images === 'string' && row.images.startsWith('http') ? row.images.trim() : '') ||
          ''
        );
        const primaryImage = typeof primaryCandidate === 'string' ? primaryCandidate.trim() : '';
        if (parsedImages.length === 0 && primaryImage) {
          parsedImages = [primaryImage];
        }

        return {
          id: String(row.id),
          name: String(row.name || ''),
          description: String(row.description || ''),
          price: Number(parseFloat(row.price as any) || 0),
          category: String(row.category || 'General'),
          images: parsedImages.slice(0, 5),
          image: primaryImage,
          image_path: primaryImage,
          stock: Number(parseInt(row.stock as any, 10) || 10),
          badge: row.badge ? String(row.badge) : undefined,
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

  // 1. Explicit Type Casting & Fallbacks:
  const id: string = String(
    body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prod_${Date.now()}`)
  );
  const name: string = String(body.name || '');
  const description: string = String(body.description || '');
  const category: string = String(body.category || 'General');
  const price: number = Number(parseFloat(body.price) || 0);
  const stock: number = Number(parseInt(body.stock, 10) || 10);

  const imagesArray: string[] = Array.isArray(body.images) && body.images.length > 0
    ? body.images.map(String).filter((img: string) => img.trim().length > 0)
    : (body.image ? [String(body.image)] : (body.image_path ? [String(body.image_path)] : []));

  const imagePath: string = String(imagesArray[0] || body.image || body.image_path || '');
  const image: string = String(imagesArray[0] || body.image || body.image_path || '');
  const images: string = JSON.stringify(Array.isArray(body.images) ? body.images : (imagesArray.length > 0 ? imagesArray : []));
  const createdAt: string = new Date().toISOString();

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    let args: any[] = [];
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await initProductsTable(db);

      // Verify actual columns and types in table schema
      const tableInfo = await db.execute('PRAGMA table_info(products)');
      const columnNames = new Set(tableInfo.rows.map((row: any) => String(row.name).toLowerCase()));
      const idCol = tableInfo.rows.find((row: any) => String(row.name).toLowerCase() === 'id');
      const isIdInteger = Boolean(idCol && String(idCol.type || '').toUpperCase().includes('INT'));

      const numericId = parseInt(String(body.id), 10);
      const hasValidIntId = Number.isInteger(numericId) && !isNaN(numericId) && String(numericId) === String(body.id).trim();

      const cols: string[] = [];
      args = [];
      let savedId = id;

      if (isIdInteger) {
        if (hasValidIntId) {
          cols.push('id');
          args.push(numericId);
          savedId = String(numericId);
        }
      } else {
        cols.push('id');
        args.push(id);
        savedId = id;
      }

      cols.push('name', 'description', 'category', 'price', 'stock');
      args.push(name, description, category, price, stock);

      if (columnNames.has('image') || columnNames.size === 0) {
        cols.push('image');
        args.push(image);
      }

      if (columnNames.has('image_path')) {
        cols.push('image_path');
        args.push(imagePath);
      }

      if (columnNames.has('images') || columnNames.size === 0) {
        cols.push('images');
        args.push(images);
      }

      if (columnNames.has('created_at')) {
        cols.push('created_at');
        args.push(createdAt);
      }

      const placeholders = cols.map(() => '?').join(', ');
      let insertResult: any;

      if (cols.includes('id')) {
        const setClause = cols
          .filter(c => c !== 'id' && c !== 'created_at')
          .map(c => `${c} = excluded.${c}`)
          .join(', ');

        try {
          insertResult = await db.execute({
            sql: `INSERT INTO products (${cols.join(', ')})
                  VALUES (${placeholders})
                  ON CONFLICT(id) DO UPDATE SET ${setClause}`,
            args,
          });
        } catch (upsertError: any) {
          insertResult = await db.execute({
            sql: `INSERT INTO products (${cols.join(', ')}) VALUES (${placeholders})`,
            args,
          });
        }
      } else {
        // Standard INSERT omitting id for autoincrement
        insertResult = await db.execute({
          sql: `INSERT INTO products (${cols.join(', ')}) VALUES (${placeholders})`,
          args,
        });

        if (insertResult?.lastInsertRowid !== undefined && insertResult?.lastInsertRowid !== null) {
          savedId = String(insertResult.lastInsertRowid);
        }
      }

      const responseProduct = {
        ...body,
        id: savedId,
        name,
        description,
        category,
        price,
        stock,
        image,
        image_path: imagePath,
        images: Array.isArray(body.images) ? body.images : imagesArray,
        created_at: createdAt,
      };

      return new Response(JSON.stringify({ success: true, product: responseProduct }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (insertError: any) {
      console.error('Failed to insert product. Query args:', JSON.stringify(args, null, 2));
      console.error('Turso execution error:', insertError);
      return new Response(JSON.stringify({
        success: false,
        error: insertError.message || 'Failed to save product in database',
        debugArgs: args,
      }), {
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
    image,
    image_path: imagePath,
    images: Array.isArray(body.images) ? body.images : imagesArray,
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
      const numericId = parseInt(String(id), 10);
      if (Number.isInteger(numericId) && !isNaN(numericId) && String(numericId) === String(id).trim()) {
        await db.execute({
          sql: 'DELETE FROM products WHERE id = ?',
          args: [numericId],
        });
      } else {
        await db.execute({
          sql: 'DELETE FROM products WHERE id = ?',
          args: [String(id)],
        });
      }
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
