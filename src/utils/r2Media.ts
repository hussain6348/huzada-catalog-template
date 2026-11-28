/**
 * Client-side R2 media URL normalization & safe orphan deletion helpers.
 * Preserves external R2 public URLs (R2_PUBLIC_URL / *.r2.dev) and origin-relative
 * /api/media/... paths without stripping external R2 domains.
 */

export function normalizeMediaUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;

  if (/^(https?:)?\/\//i.test(trimmed)) {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
      const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
      const parsed = new URL(normalized, origin);

      if (parsed.pathname.startsWith('/api/media/') || (typeof window !== 'undefined' && parsed.origin === window.location.origin)) {
        const rel = parsed.pathname + parsed.search;
        return rel.startsWith('/') ? rel : `/${rel}`;
      }

      return trimmed;
    } catch {
      return trimmed;
    }
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function extractR2KeyFromUrl(imageUrl?: string): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const trimmed = imageUrl.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  const isR2 = trimmed.includes('/api/media/') || trimmed.includes('.r2.dev');
  if (!isR2) return null;

  let rawKey = '';
  if (trimmed.includes('/api/media/')) {
    rawKey = (trimmed.split('/api/media/').pop() || '').split(/[?#]/)[0].replace(/^\/+/, '');
  } else {
    try {
      const urlObj = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed);
      rawKey = urlObj.pathname.replace(/^\/+/, '');
    } catch {
      rawKey = trimmed.split('/').filter(Boolean).pop() || '';
    }
  }

  if (!rawKey) return null;
  try {
    return decodeURIComponent(rawKey);
  } catch {
    return rawKey;
  }
}

export async function deleteOrphanR2Image(
  imageUrl: string | undefined,
  getAuthHeaders: () => Record<string, string>
): Promise<void> {
  const key = extractR2KeyFromUrl(imageUrl);
  if (!key) return;

  try {
    await fetch(`/api/media/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        ...getAuthHeaders(),
      },
    });
  } catch (err) {
    console.warn('Orphan R2 asset deletion note:', err);
  }
}
