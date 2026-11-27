export const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=960&q=75';

/**
 * Normalizes Unsplash URLs with auto=format, fit=crop, width, and quality
 * so images match rendered dimensions without oversizing Slow 4G payloads.
 */
export function optimizeUnsplashUrl(
  rawUrl: string,
  width = 800,
  quality = 75
): string {
  if (!rawUrl || !rawUrl.includes('images.unsplash.com')) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set('auto', 'format');
    parsed.searchParams.set('fit', 'crop');
    parsed.searchParams.set('w', String(width));
    parsed.searchParams.set('q', String(quality));
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function buildUnsplashSrcSet(
  rawUrl: string,
  widths = [640, 1080],
  quality = 75
): string | undefined {
  if (!rawUrl || !rawUrl.includes('images.unsplash.com')) return undefined;
  return widths
    .map((w) => `${optimizeUnsplashUrl(rawUrl, w, quality)} ${w}w`)
    .join(', ');
}
