import { parseJsonResponse } from './safeJson';

let activeThemePromise: Promise<any> | null = null;

/**
 * Coalesces simultaneous mount-time `/api/theme` requests across App,
 * PublicStorefrontPortal, and AITheme into a single `?t=${Date.now()}` + `no-store`
 * fetch, while permitting forced refreshes on theme updates or foreground resume.
 */
export function fetchThemePayload(force = false): Promise<any> {
  if (!force && activeThemePromise) {
    return activeThemePromise;
  }
  const promise = fetch(`/api/theme?t=${Date.now()}`, { cache: 'no-store' })
    .then((res) => parseJsonResponse(res))
    .catch(() => null)
    .finally(() => {
      setTimeout(() => {
        if (activeThemePromise === promise) {
          activeThemePromise = null;
        }
      }, 2500);
    });
  activeThemePromise = promise;
  return promise;
}
