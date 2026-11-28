import { createClient } from '@libsql/client/web';
import { requireAdmin, json } from '../../_lib/guard';
import { deleteR2UrlsIfUnreferenced, parseImageList } from '../../_lib/r2';

export async function onRequestPut(context: any) {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  try {
    const tursoUrl = env?.TURSO_DATABASE_URL;
    const tursoToken = env?.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken || typeof tursoUrl !== 'string' || typeof tursoToken !== 'string' || !tursoUrl.trim() || !tursoToken.trim()) {
      return json({ success: false, error: 'Database pending configuration' }, 400);
    }

    const id = context.params?.id;
    if (!id || typeof id !== 'string') {
      return json({ success: false, error: 'Missing product id' }, 400);
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: 'Malformed JSON payload' }, 400);
    }

    const name = String(body.name || '').trim();
    const price = Math.max(0, Number(parseFloat(body.price)) || 0);
    const description = String(body.description || '').trim();
    const category = String(body.category || 'General').trim();
    const stock = Math.max(0, Number(parseInt(body.stock, 10)) || 0);
    const badge = body.badge ? String(body.badge).trim() : null;
    const imagesArray = Array.isArray(body.images) ? body.images.map(String).filter(Boolean).slice(0, 5) : [];
    const imagePath = String(imagesArray[0] || body.image_path || body.image || '').trim();

    const client = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
    const nextUrls = new Set(imagesArray.length > 0 ? imagesArray : imagePath ? [imagePath] : []);

    let oldUrls: string[] = [];
    try {
      const result = await client.execute({
        sql: 'SELECT image_path, image, images FROM products WHERE id = ?',
        args: [id],
      });
      if (result.rows.length > 0) {
        const row = result.rows[0] as any;
        oldUrls = [row.image_path, row.image, ...parseImageList(row.images)]
          .map((u) => (typeof u === 'string' ? u.trim() : ''))
          .filter(Boolean);
      }
    } catch (lookupError) {
      console.warn('Non-fatal product media lookup notice:', lookupError);
    }

    await client.execute({
      sql: `UPDATE products SET 
              name = ?, 
              price = ?, 
              description = ?, 
              image = ?, 
              image_path = ?, 
              images = ?, 
              category = ?, 
              stock = ?, 
              badge = ? 
            WHERE id = ?`,
      args: [
        name,
        price,
        description,
        imagePath,
        imagePath,
        JSON.stringify(imagesArray.length > 0 ? imagesArray : (imagePath ? [imagePath] : [])),
        category,
        stock,
        badge,
        id,
      ],
    });

    const removedUrls = oldUrls.filter((u) => !nextUrls.has(u));
    if (removedUrls.length > 0) {
      await deleteR2UrlsIfUnreferenced(env, removedUrls);
    }

    return json({ success: true, id });
  } catch (error: any) {
    console.error("Product update error:", error);
    return json({ error: error?.message || 'Server error updating product' }, 500);
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
      return json({ success: false, error: 'Database pending configuration' }, 400);
    }

    const id = context.params?.id;
    if (!id || typeof id !== 'string') {
      return json({ success: false, error: 'Missing product id' }, 400);
    }

    const client = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });

    let oldUrls: string[] = [];
    try {
      const result = await client.execute({
        sql: 'SELECT image_path, image, images FROM products WHERE id = ?',
        args: [id],
      });
      if (result.rows.length > 0) {
        const row = result.rows[0] as any;
        oldUrls = [row.image_path, row.image, ...parseImageList(row.images)]
          .map((u) => (typeof u === 'string' ? u.trim() : ''))
          .filter(Boolean);
      }
    } catch (lookupError) {
      console.warn('Non-fatal product media lookup notice:', lookupError);
    }

    await client.execute({
      sql: 'DELETE FROM products WHERE id = ?',
      args: [id],
    });

    if (oldUrls.length > 0) {
      await deleteR2UrlsIfUnreferenced(env, oldUrls);
    }

    return json({ success: true, id });
  } catch (error: any) {
    console.error("Product delete error:", error);
    return json({ error: error?.message || 'Server error deleting product' }, 500);
  }
}
