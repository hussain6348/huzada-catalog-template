/**
 * Client-side R2 media URL normalization & safe orphan deletion helpers.
 * Preserves external R2 public URLs (R2_PUBLIC_URL / *.r2.dev) and origin-relative
 * /api/media/... paths without stripping external R2 domains.
 */

function getConfiguredPublicBase(explicitBase?: string): string {
  const runtimeBase = typeof explicitBase === 'string' ? explicitBase.trim() : '';
  const viteBase =
    typeof (import.meta as any)?.env?.VITE_R2_PUBLIC_URL === 'string'
      ? (import.meta as any).env.VITE_R2_PUBLIC_URL.trim()
      : '';
  return (runtimeBase || viteBase).replace(/\/+$/, '');
}

function isOriginRelativeMediaUrl(parsed: URL): boolean {
  if (parsed.pathname.startsWith('/api/media/')) return true;
  return typeof window !== 'undefined' && parsed.origin === window.location.origin;
}

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

      if (isOriginRelativeMediaUrl(parsed)) {
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

export function extractR2KeyFromUrl(imageUrl?: string, publicBaseUrl?: string): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const trimmed = imageUrl.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  let rawKey = '';

  if (trimmed.includes('/api/media/')) {
    rawKey = (trimmed.split('/api/media/').pop() || '').split(/[?#]/)[0].replace(/^\/+/, '');
  } else if (/^(https?:)?\/\//i.test(trimmed)) {
    try {
      const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
      const urlObj = new URL(normalized);
      const configuredBase = getConfiguredPublicBase(publicBaseUrl);

      if (configuredBase) {
        try {
          const baseObj = new URL(configuredBase);
          const basePath = baseObj.pathname.replace(/\/+$/, '');
          if (
            urlObj.origin.toLowerCase() === baseObj.origin.toLowerCase() &&
            (!basePath || urlObj.pathname === basePath || urlObj.pathname.startsWith(`${basePath}/`))
          ) {
            rawKey = urlObj.pathname.slice(basePath.length).replace(/^\/+/, '');
          }
        } catch {
          if (normalized.startsWith(`${configuredBase}/`)) {
            rawKey = normalized.slice(configuredBase.length + 1).split(/[?#]/)[0].replace(/^\/+/, '');
          }
        }
      }

      if (!rawKey && urlObj.hostname.endsWith('.r2.dev')) {
        rawKey = urlObj.pathname.replace(/^\/+/, '');
      }
    } catch {
      return null;
    }
  } else {
    return null;
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
  getAuthHeaders: () => Record<string, string>,
  publicBaseUrl?: string
): Promise<void> {
  const key = extractR2KeyFromUrl(imageUrl, publicBaseUrl);
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
