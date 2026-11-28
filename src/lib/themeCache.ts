import { parseJsonResponse } from './safeJson';

export interface ValidatedThemeSnapshot {
  v: 1;
  origin: string;
  updatedAt: number;
  primaryColor: string;
  primaryHoverColor: string;
  accentColor: string;
  spiceColor: string;
  bgColor: string;
  textColor: string;
  onPrimaryColor: string;
  radius: string;
  fontFamily: string;
}

const DEFAULT_PRIMARY = '#0ea5e9';
const DEFAULT_SPICE = '#ea580c';
const DEFAULT_BG = '#0f172a';
const DEFAULT_TEXT = '#ffffff';
const DEFAULT_RADIUS = '0.75rem';
const DEFAULT_FONT_FAMILY = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif";

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_COLOR_RE = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|color-mix)\([^;{}<>]{1,120}\)$/i;
const SAFE_RADIUS_RE = /^\d+(?:\.\d+)?(?:px|rem|em|%)$/;

let activeThemePromise: Promise<any> | null = null;
let lastCompletedFetchAt = 0;

function getOriginScope(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return 'default';
}

export function getThemeStorageKey(): string {
  return `waas_theme_snapshot:${getOriginScope()}`;
}

export function isValidCssColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 140) return false;
  if (/[;{}<>\n\r]/.test(trimmed)) return false;
  return HEX_COLOR_RE.test(trimmed) || FUNC_COLOR_RE.test(trimmed);
}

function getHexLuminance(color: string): number | null {
  const cleaned = color.trim().replace('#', '');
  if (!/^[0-9a-f]+$/i.test(cleaned)) return null;
  let fullHex = cleaned;
  if (cleaned.length === 3 || cleaned.length === 4) {
    fullHex = cleaned
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (cleaned.length >= 6) {
    fullHex = cleaned.slice(0, 6);
  } else {
    return null;
  }
  const r = parseInt(fullHex.slice(0, 2), 16) || 0;
  const g = parseInt(fullHex.slice(2, 4), 16) || 0;
  const b = parseInt(fullHex.slice(4, 6), 16) || 0;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function computeOnPrimaryColor(primaryColor: string): string {
  const luminance = getHexLuminance(primaryColor);
  if (luminance !== null) {
    return luminance > 0.65 ? '#0f172a' : '#ffffff';
  }
  return '#ffffff';
}

export function determineSpiceColor(primaryColor?: string, bgColor?: string): string {
  const primary = (primaryColor || '').toLowerCase().trim();
  const bg = (bgColor || '').toLowerCase().trim();

  if (primary === '#10b981' || bg === '#09090b') {
    return '#a855f7';
  }
  if (primary === '#d97706' || bg === '#1c1917') {
    return '#f43f5e';
  }
  if (primary === '#0ea5e9' || bg === '#ffffff' || bg === '#f8fafc') {
    return '#ea580c';
  }

  const hex = primary.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    if (g > r + 30 && g > b) return '#a855f7';
    if (b > r + 30 && b > g) return '#ea580c';
    if (r > b + 40 && g > b) return '#f43f5e';
  }

  return DEFAULT_SPICE;
}

export function extractThemeData(raw: any): any {
  if (!raw) return null;
  const base = raw?.data !== undefined ? raw.data : raw;
  return Array.isArray(base) ? base[0] || null : base;
}

export function normalizeThemeConfig(rawInput?: any): ValidatedThemeSnapshot {
  const data = extractThemeData(rawInput) || {};
  const primaryColor = isValidCssColor(data.primaryColor) ? data.primaryColor.trim() : DEFAULT_PRIMARY;
  const bgColor = isValidCssColor(data.bgColor) ? data.bgColor.trim() : DEFAULT_BG;

  let textColor = isValidCssColor(data.textColor) ? data.textColor.trim() : DEFAULT_TEXT;
  if (textColor.toLowerCase() === bgColor.toLowerCase()) {
    const bgLuminance = getHexLuminance(bgColor);
    textColor = bgLuminance !== null && bgLuminance > 0.5 ? '#0f172a' : '#ffffff';
  }

  const spiceColor = isValidCssColor(data.spiceColor)
    ? data.spiceColor.trim()
    : determineSpiceColor(primaryColor, bgColor);

  const accentColor = isValidCssColor(data.accentColor) ? data.accentColor.trim() : primaryColor;
  const primaryHoverColor = isValidCssColor(data.primaryHoverColor)
    ? data.primaryHoverColor.trim()
    : `color-mix(in srgb, ${primaryColor} 85%, #000000)`;

  const onPrimaryColor = isValidCssColor(data.onPrimaryColor)
    ? data.onPrimaryColor.trim()
    : computeOnPrimaryColor(primaryColor);

  const rawRadius = typeof data.radius === 'string' ? data.radius.trim() : '';
  const radius = SAFE_RADIUS_RE.test(rawRadius) ? rawRadius : DEFAULT_RADIUS;

  const rawFont = typeof data.fontFamily === 'string' ? data.fontFamily.trim() : '';
  const fontFamily =
    rawFont && rawFont.length <= 160 && !/[;{}<>\n\r]/.test(rawFont)
      ? rawFont
      : DEFAULT_FONT_FAMILY;

  return {
    v: 1,
    origin: getOriginScope(),
    updatedAt: typeof data.updatedAt === 'number' && data.updatedAt > 0 ? data.updatedAt : Date.now(),
    primaryColor,
    primaryHoverColor,
    accentColor,
    spiceColor,
    bgColor,
    textColor,
    onPrimaryColor,
    radius,
    fontFamily,
  };
}

export function readStoredThemeSnapshot(): ValidatedThemeSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getThemeStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.origin && parsed.origin !== getOriginScope()) return null;
    return normalizeThemeConfig(parsed);
  } catch {
    return null;
  }
}

export function persistThemeSnapshot(rawInput: any): ValidatedThemeSnapshot {
  const snapshot = normalizeThemeConfig(rawInput);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getThemeStorageKey(), JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota or private-mode access errors
    }
  }
  return snapshot;
}

export function clearThemeHydratingFlag(): void {
  if (typeof document === 'undefined') return;
  const removeFlag = () => {
    try {
      document.documentElement.classList.remove('waas-theme-hydrating');
    } catch {}
  };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(removeFlag);
    });
  } else {
    setTimeout(removeFlag, 0);
  }
}

export function applyThemeToDocument(rawInput: any): ValidatedThemeSnapshot {
  const snapshot = normalizeThemeConfig(rawInput);
  if (typeof document !== 'undefined') {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--theme-primary', snapshot.primaryColor);
    rootStyle.setProperty('--theme-primary-hover', snapshot.primaryHoverColor);
    rootStyle.setProperty('--theme-accent', snapshot.accentColor);
    rootStyle.setProperty('--theme-accent-soft', `color-mix(in srgb, ${snapshot.accentColor} 14%, transparent)`);
    rootStyle.setProperty('--theme-spice', snapshot.spiceColor);
    rootStyle.setProperty('--theme-spice-soft', `color-mix(in srgb, ${snapshot.spiceColor} 14%, transparent)`);
    rootStyle.setProperty('--theme-bg', snapshot.bgColor);
    rootStyle.setProperty('--theme-text', snapshot.textColor);
    rootStyle.setProperty('--theme-on-primary', snapshot.onPrimaryColor);
    rootStyle.setProperty('--theme-radius', snapshot.radius);
    rootStyle.setProperty('--font-body', snapshot.fontFamily);
  }
  return snapshot;
}

export function applyStoredThemeSnapshot(): ValidatedThemeSnapshot | null {
  const cached = readStoredThemeSnapshot();
  if (!cached) return null;
  return applyThemeToDocument(cached);
}

export function applyAndPersistTheme(rawInput: any, suppressTransition = false): ValidatedThemeSnapshot {
  if (suppressTransition && typeof document !== 'undefined') {
    try {
      document.documentElement.classList.add('waas-theme-hydrating');
    } catch {}
  }
  const applied = applyThemeToDocument(rawInput);
  persistThemeSnapshot(applied);
  if (suppressTransition) {
    clearThemeHydratingFlag();
  }
  return applied;
}

export function shouldRevalidateThemeOnVisible(staleMs = 4000): boolean {
  if (lastCompletedFetchAt === 0) return true;
  return Date.now() - lastCompletedFetchAt >= staleMs;
}

/**
 * Coalesces simultaneous mount-time `/api/theme` requests across App,
 * PublicStorefrontPortal, and AITheme into a single `?t=${Date.now()}` + `no-store`
 * fetch, while permitting unthrottled forced refreshes on theme updates or stale resume.
 */
export function fetchThemePayload(force = false): Promise<any> {
  if (!force && activeThemePromise) {
    return activeThemePromise;
  }

  if (!force && typeof window !== 'undefined' && (window as any).__WAAS_THEME_PROMISE__) {
    const earlyPromise = (window as any).__WAAS_THEME_PROMISE__;
    delete (window as any).__WAAS_THEME_PROMISE__;
    const wrapped = Promise.resolve(earlyPromise)
      .then((res) => parseJsonResponse(res))
      .then((parsed) => {
        if (parsed) {
          lastCompletedFetchAt = Date.now();
          return parsed;
        }
        return fetch(`/api/theme?t=${Date.now()}`, { cache: 'no-store' })
          .then((res) => parseJsonResponse(res))
          .then((fresh) => {
            if (fresh) lastCompletedFetchAt = Date.now();
            return fresh;
          });
      })
      .catch(() => null)
      .finally(() => {
        if (activeThemePromise === wrapped) {
          activeThemePromise = null;
        }
      });
    activeThemePromise = wrapped;
    return wrapped;
  }

  const promise = fetch(`/api/theme?t=${Date.now()}`, { cache: 'no-store' })
    .then((res) => parseJsonResponse(res))
    .then((data) => {
      if (data) lastCompletedFetchAt = Date.now();
      return data;
    })
    .catch(() => null)
    .finally(() => {
      if (activeThemePromise === promise) {
        activeThemePromise = null;
      }
    });
  activeThemePromise = promise;
  return promise;
}
