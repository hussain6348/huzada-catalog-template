import { createClient } from '@libsql/client/web';
import { requireAdmin, json } from '../../_lib/guard';

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
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  try {
    const tursoUrl = env?.TURSO_DATABASE_URL;
    const tursoToken = env?.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken || typeof tursoUrl !== 'string' || typeof tursoToken !== 'string' || !tursoUrl.trim() || !tursoToken.trim()) {
      return json({ success: false, error: 'Database pending' }, 400);
    }

    const id = context.params?.id;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { name, price, description, image_path, category, stock, badge } = body;
    const client = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });

    // Clean up old R2 image if changed
    try {
      const result = await client.execute({ sql: 'SELECT image_path FROM products WHERE id = ?', args: [id] });
      const oldImagePath = result.rows.length > 0 ? (result.rows[0].image_path as string) : null;
      const r2Bucket = env.BUCKET || env.R2_BUCKET || env.MEDIA || env.CATALOG_BUCKET;

      if (oldImagePath && oldImagePath !== image_path && r2Bucket) {
        const fileKey = extractFileKey(oldImagePath);
        if (fileKey) {
          await r2Bucket.delete(fileKey);
        }
      }
    } catch (cleanupError) {
      console.error("Non-fatal R2 cleanup notice:", cleanupError);
    }

    await client.execute({
      sql: 'UPDATE products SET name = ?, price = ?, description = ?, image_path = ?, category = ?, stock = ?, badge = ? WHERE id = ?',
      args: [name || '', price || 0, description || '', image_path || '', category || 'General', stock ?? 10, badge || null, id]
    });
    return json({ success: true, id });
  } catch (error: any) {
    return json({ error: error?.message || 'Server error' }, 500);
  }
}

export async function onRequestDelete(context: any) {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  try {
    const tursoUrl = env?.TURSO_DATABASE_URL;
    const tursoToken = env?.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken || typeof tursoUrl !== 'string' || typeof tursoToken !== 'string' || !tursoUrl.trim() || !tursoToken.trim()) {
      return json({ success: false, error: 'Database pending' }, 400);
    }

    const id = context.params?.id;
    const client = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });

    try {
      const result = await client.execute({ sql: 'SELECT image_path FROM products WHERE id = ?', args: [id] });
      const oldImagePath = result.rows.length > 0 ? (result.rows[0].image_path as string) : null;
      const r2Bucket = env.BUCKET || env.R2_BUCKET || env.MEDIA || env.CATALOG_BUCKET;

      if (oldImagePath && r2Bucket) {
        const fileKey = extractFileKey(oldImagePath);
        if (fileKey) {
          await r2Bucket.delete(fileKey);
        }
      }
    } catch (cleanupError) {
      console.error("Non-fatal R2 cleanup notice:", cleanupError);
    }

    await client.execute({
      sql: 'DELETE FROM products WHERE id = ?',
      args: [id]
    });
    return json({ success: true, id });
  } catch (error: any) {
    return json({ error: error?.message || 'Server error' }, 500);
  }
}
