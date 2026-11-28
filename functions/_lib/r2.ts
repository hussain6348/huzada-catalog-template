import { createClient } from '@libsql/client/web';

/**
 * Cloudflare R2 Storage & Media Helper
 * Standardizes bucket binding resolution, public URL generation,
 * safe key extraction, and reference-checked orphan cleanup.
 */

export function getR2Bucket(env: any): any {
  return env?.R2_STORAGE || env?.BUCKET || env?.STORAGE || env?.MEDIA || env?.CATALOG_BUCKET || null;
}

export function getR2PublicUrl(env: any, filename: string): string {
  const safeName = encodeURIComponent(filename);
  if (env?.R2_PUBLIC_URL && typeof env.R2_PUBLIC_URL === 'string' && env.R2_PUBLIC_URL.trim()) {
    const base = env.R2_PUBLIC_URL.trim().replace(/\/+$/, '');
    return `${base}/${safeName}`;
  }
  if (env?.R2_DEV_HASH && typeof env.R2_DEV_HASH === 'string' && env.R2_DEV_HASH.trim()) {
    return `https://pub-${env.R2_DEV_HASH.trim()}.r2.dev/${safeName}`;
  }
  return `/api/media/${safeName}`;
}

export function safeDecodeKey(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function extractFileKey(urlOrPath: string, env?: any): string | null {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  const isStaticAssetPath = (path: string) =>
    path.startsWith('/assets/') ||
    path.startsWith('/src/assets/') ||
    path === '/huzada-logo.png' ||
    path === '/huzadalogo.jpeg' ||
    path === '/default-logo.png' ||
    path === '/favicon.ico';

  if (trimmed.includes('/api/media/')) {
    const rawSegment = (trimmed.split('/api/media/').pop() || '').split(/[?#]/)[0].replace(/^\/+/, '');
    return rawSegment ? safeDecodeKey(rawSegment) : null;
  }

  if (/^(https?:)?\/\//i.test(trimmed)) {
    try {
      const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
      const urlObj = new URL(normalized);
      const configuredPublicBase =
        env?.R2_PUBLIC_URL && typeof env.R2_PUBLIC_URL === 'string' ? env.R2_PUBLIC_URL.trim().replace(/\/+$/, '') : '';

      if (configuredPublicBase) {
        try {
          const baseUrlObj = new URL(configuredPublicBase);
          const basePath = baseUrlObj.pathname.replace(/\/+$/, '');
          if (
            urlObj.origin.toLowerCase() === baseUrlObj.origin.toLowerCase() &&
            (!basePath || urlObj.pathname === basePath || urlObj.pathname.startsWith(`${basePath}/`))
          ) {
            const rel = urlObj.pathname.slice(basePath.length).replace(/^\/+/, '');
            return rel ? safeDecodeKey(rel) : null;
          }
        } catch {
          if (normalized.startsWith(`${configuredPublicBase}/`)) {
            const rel = normalized.slice(configuredPublicBase.length + 1).split(/[?#]/)[0].replace(/^\/+/, '');
            return rel ? safeDecodeKey(rel) : null;
          }
        }
      }

      if (urlObj.hostname.endsWith('.r2.dev')) {
        const rel = urlObj.pathname.replace(/^\/+/, '');
        return rel ? safeDecodeKey(rel) : null;
      }

      return null;
    } catch {
      return null;
    }
  }

  const pathOnly = trimmed.split(/[?#]/)[0];
  if (isStaticAssetPath(pathOnly)) return null;
  const cleaned = pathOnly.replace(/^\/+/, '');
  return cleaned ? safeDecodeKey(cleaned) : null;
}

export function parseImageList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }
    if (typeof parsed === 'string' && parsed.trim()) {
      return [parsed.trim()];
    }
  } catch {
    return [trimmed];
  }
  return [];
}

function isMissingSchemaError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('no such table') || msg.includes('no such column') || msg.includes('has no column');
}

/**
 * Checks whether an R2 object key is still referenced anywhere in Turso
 * (`services`, `products`, `theme_settings`, or `business_info`) before deleting.
 * Fails closed (`true`) on unexpected DB query errors so shared assets are protected.
 */
export async function isR2KeyReferenced(env: any, rawKey: string): Promise<boolean> {
  const targetKey = safeDecodeKey(String(rawKey || '').trim());
  if (!targetKey) return true;

  const tursoUrl = typeof env?.TURSO_DATABASE_URL === 'string' ? env.TURSO_DATABASE_URL.trim() : '';
  const tursoToken = typeof env?.TURSO_AUTH_TOKEN === 'string' ? env.TURSO_AUTH_TOKEN.trim() : '';
  if (!tursoUrl || !tursoToken) {
    return false;
  }

  const encodedKey = encodeURIComponent(targetKey);
  const rawPattern = `%${targetKey}%`;
  const encPattern = `%${encodedKey}%`;

  const matchesTarget = (candidate: unknown): boolean => {
    if (typeof candidate !== 'string' || !candidate.trim()) return false;
    return extractFileKey(candidate, env) === targetKey;
  };

  try {
    const db = createClient({ url: tursoUrl, authToken: tursoToken });

    try {
      const srvRes = await db.execute({
        sql: 'SELECT images FROM services WHERE images LIKE ? OR images LIKE ?',
        args: [rawPattern, encPattern],
      });
      for (const row of srvRes.rows || []) {
        if (parseImageList(row?.images).some(matchesTarget)) return true;
      }
    } catch (err: any) {
      if (!isMissingSchemaError(err)) throw err;
    }

    try {
      const prodRes = await db.execute({
        sql: `SELECT image, image_path, images FROM products
              WHERE image LIKE ? OR image LIKE ?
                 OR image_path LIKE ? OR image_path LIKE ?
                 OR images LIKE ? OR images LIKE ?`,
        args: [rawPattern, encPattern, rawPattern, encPattern, rawPattern, encPattern],
      });
      for (const row of prodRes.rows || []) {
        if (matchesTarget(row?.image) || matchesTarget(row?.image_path) || parseImageList(row?.images).some(matchesTarget)) {
          return true;
        }
      }
    } catch (err: any) {
      const errMsg = String(err?.message || '').toLowerCase();
      if (errMsg.includes('no such column') || errMsg.includes('has no column')) {
        try {
          const fallbackProdRes = await db.execute({
            sql: 'SELECT image_path FROM products WHERE image_path LIKE ? OR image_path LIKE ?',
            args: [rawPattern, encPattern],
          });
          for (const row of fallbackProdRes.rows || []) {
            if (matchesTarget(row?.image_path)) return true;
          }
        } catch (innerErr: any) {
          if (!isMissingSchemaError(innerErr)) throw innerErr;
        }
      } else if (!isMissingSchemaError(err)) {
        throw err;
      }
    }

    try {
      const themeRes = await db.execute({
        sql: 'SELECT image_url FROM theme_settings WHERE image_url LIKE ? OR image_url LIKE ?',
        args: [rawPattern, encPattern],
      });
      for (const row of themeRes.rows || []) {
        if (matchesTarget(row?.image_url)) return true;
      }
    } catch (err: any) {
      if (!isMissingSchemaError(err)) throw err;
    }

    try {
      const bizRes = await db.execute({
        sql: 'SELECT data FROM business_info WHERE id = ?',
        args: ['default'],
      });
      if (bizRes.rows && bizRes.rows.length > 0 && typeof bizRes.rows[0]?.data === 'string') {
        try {
          const bizData = JSON.parse(bizRes.rows[0].data) || {};
          const slotCandidates = [
            bizData.logo,
            bizData.heroImage,
            bizData.heroImage2,
            bizData.heroImage3,
            ...(bizData.imageSlots && typeof bizData.imageSlots === 'object' ? Object.values(bizData.imageSlots) : []),
          ];
          if (slotCandidates.some(matchesTarget)) return true;
        } catch {
          if (bizRes.rows[0].data.includes(targetKey) || bizRes.rows[0].data.includes(encodedKey)) {
            return true;
          }
        }
      }
    } catch (err: any) {
      if (!isMissingSchemaError(err)) throw err;
    }

    return false;
  } catch (err) {
    console.warn('Reference verification failed; retaining R2 object for safety:', err);
    return true;
  }
}

export async function deleteR2ObjectIfUnreferenced(
  env: any,
  rawKey: string
): Promise<{ deleted: boolean; skipped?: boolean; key: string | null; reason?: string }> {
  const key = safeDecodeKey(String(rawKey || '').trim());
  const bucket = getR2Bucket(env);
  if (!bucket || !key) {
    return { deleted: false, key: key || null, reason: !bucket ? 'missing_bucket' : 'missing_key' };
  }

  const stillReferenced = await isR2KeyReferenced(env, key);
  if (stillReferenced) {
    return { deleted: false, skipped: true, key, reason: 'still_referenced' };
  }

  await bucket.delete(key);
  return { deleted: true, key };
}

export async function deleteR2UrlsIfUnreferenced(env: any, urls: string[]): Promise<void> {
  const uniqueKeys = Array.from(
    new Set(
      (Array.isArray(urls) ? urls : [])
        .map((url) => extractFileKey(url, env))
        .filter((k): k is string => Boolean(k))
    )
  );
  for (const key of uniqueKeys) {
    try {
      await deleteR2ObjectIfUnreferenced(env, key);
    } catch (err) {
      console.warn(`Non-fatal R2 cleanup note for "${key}":`, err);
    }
  }
}
