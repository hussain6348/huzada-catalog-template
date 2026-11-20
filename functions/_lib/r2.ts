/**
 * Cloudflare R2 Storage & Media Helper
 * Standardizes bucket binding resolution and public asset URL generation
 * across all Cloudflare Pages functions.
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

export function extractFileKey(urlOrPath: string): string | null {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;
  try {
    const urlObj = new URL(urlOrPath);
    return decodeURIComponent(urlObj.pathname.replace(/^\/api\/media\//, '').replace(/^\//, ''));
  } catch {
    const cleaned = urlOrPath.replace(/^\/api\/media\//, '').replace(/^\//, '');
    return decodeURIComponent(cleaned);
  }
}
