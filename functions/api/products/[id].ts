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

// Helper to extract the exact R2 object key from the image URL
const extractFileKey = (urlOrPath: string) => {
  if (!urlOrPath) return null;
  try {
    const urlObj = new URL(urlOrPath);
    return decodeURIComponent(urlObj.pathname.substring(1));
  } catch {
    const path = urlOrPath.startsWith('/') ? urlOrPath.substring(1) : urlOrPath;
    return decodeURIComponent(path);
  }
};

export async function onRequestPut(context: any) {
  try {
    const env = context?.env || {};
    const tursoUrl = env.TURSO_DATABASE_URL;
    const tursoToken = env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken || typeof tursoUrl !== 'string' || typeof tursoToken !== 'string' || !tursoUrl.trim() || !tursoToken.trim()) {
      return jsonResponse({ success: false, error: 'Database pending' }, 400);
    }

    const id = context.params.id;
    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      body = {};
    }

    const { name, price, description, image_path } = body;
    const client = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });

    // --- 🧹 R2 ORPHAN CLEANUP LOGIC ---
    try {
      const result = await client.execute({ sql: 'SELECT image_path FROM products WHERE id = ?', args: [id] });
      const oldImagePath = result.rows.length > 0 ? (result.rows[0].image_path as string) : null;
      
      const r2Bucket = env.BUCKET || env.R2_BUCKET || env.MEDIA;

      if (oldImagePath && oldImagePath !== image_path && r2Bucket) {
        const fileKey = extractFileKey(oldImagePath);
        if (fileKey) {
          await r2Bucket.delete(fileKey);
        }
      }
    } catch (cleanupError) {
      console.error("Non-fatal R2 cleanup error:", cleanupError);
    }
    // -----------------------------------

    await client.execute({
      sql: 'UPDATE products SET name = ?, price = ?, description = ?, image_path = ? WHERE id = ?',
      args: [name, price, description || '', image_path, id]
    });
    return jsonResponse({ success: true });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || 'Server error' }, 500);
  }
}

export async function onRequestDelete(context: any) {
  try {
    const env = context?.env || {};
    const tursoUrl = env.TURSO_DATABASE_URL;
    const tursoToken = env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken || typeof tursoUrl !== 'string' || typeof tursoToken !== 'string' || !tursoUrl.trim() || !tursoToken.trim()) {
      return jsonResponse({ success: false, error: 'Database pending' }, 400);
    }

    const id = context.params.id;
    const client = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });

    // --- 🧹 R2 ORPHAN CLEANUP LOGIC ---
    try {
      const result = await client.execute({ sql: 'SELECT image_path FROM products WHERE id = ?', args: [id] });
      const oldImagePath = result.rows.length > 0 ? (result.rows[0].image_path as string) : null;
      
      const r2Bucket = env.BUCKET || env.R2_BUCKET || env.MEDIA;
      
      if (oldImagePath && r2Bucket) {
        const fileKey = extractFileKey(oldImagePath);
        if (fileKey) {
          await r2Bucket.delete(fileKey);
        }
      }
    } catch (cleanupError) {
      console.error("Non-fatal R2 cleanup error:", cleanupError);
    }
    // -----------------------------------

    await client.execute({
      sql: 'DELETE FROM products WHERE id = ?',
      args: [id]
    });
    return jsonResponse({ success: true });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || 'Server error' }, 500);
  }
}
