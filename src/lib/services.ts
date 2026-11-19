import type { Service } from './types';
import { getAuthHeaders } from './auth';

export const DEFAULT_SERVICE_IMAGE =
  'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&q=80';

export const INITIAL_SERVICES: Service[] = [];

const STORAGE_KEY = 'waas_services';
const FALLBACK_STORAGE_KEY = 'huzada_booking_services';
export const SERVICES_UPDATED_EVENT = 'services_updated';
export const CATALOG_UPDATED_EVENT = 'services_updated';

let memoryServicesCache: Service[] | null = null;

export function parseDurationMinutes(duration?: string | number): number {
  if (typeof duration === 'number') return duration;
  if (!duration || typeof duration !== 'string') return 30;
  const lower = duration.toLowerCase().trim();
  if (lower.includes('hour')) {
    const hours = parseFloat(lower);
    return isNaN(hours) ? 60 : Math.round(hours * 60);
  }
  const mins = parseInt(lower, 10);
  return isNaN(mins) ? 30 : mins;
}

export function formatDurationString(val: string | number): string {
  if (typeof val === 'number') {
    if (val === 60) return '1 Hour';
    if (val > 60 && val % 60 === 0) return `${val / 60} Hours`;
    return `${val} Minutes`;
  }
  const trimmed = String(val || '').trim();
  if (!trimmed) return '30 Minutes';
  if (/^\d+$/.test(trimmed)) {
    const mins = parseInt(trimmed, 10);
    if (mins === 60) return '1 Hour';
    if (mins > 60 && mins % 60 === 0) return `${mins / 60} Hours`;
    return `${mins} Minutes`;
  }
  return trimmed;
}

export function resolveImageUrl(
  url?: string | null,
  fallback = DEFAULT_SERVICE_IMAGE
): string {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;

  if (
    trimmed.includes('/default-client/test-shirt.jpg') ||
    trimmed.includes('test-shirt') ||
    trimmed.includes('default-client')
  ) {
    return fallback;
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `/${cleanPath}`;
}

export function getServicePrimaryImage(
  service?: Partial<Service> | null,
  fallback = DEFAULT_SERVICE_IMAGE
): string {
  if (!service) return fallback;
  const raw =
    (Array.isArray(service.images) && service.images[0]) ||
    service.image ||
    service.image_path ||
    '';
  return resolveImageUrl(raw, fallback);
}

export function normalizeService(s: any): Service {
  let parsedImages: string[] = [];
  if (Array.isArray(s.images) && s.images.length > 0) {
    parsedImages = s.images.filter(Boolean);
  } else if (typeof s.images === 'string' && s.images.trim()) {
    try {
      const parsed = JSON.parse(s.images);
      if (Array.isArray(parsed)) parsedImages = parsed.filter(Boolean);
      else if (typeof parsed === 'string' && parsed) parsedImages = [parsed];
    } catch {
      const trimmed = s.images.trim();
      if (
        trimmed.startsWith('http') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:') ||
        trimmed.startsWith('/')
      ) {
        parsedImages = [trimmed];
      } else {
        parsedImages = [];
      }
    }
  }

  let primaryCandidate = (
    parsedImages[0] ||
    s.image ||
    s.image_path ||
    (typeof s.images === 'string' &&
    (s.images.startsWith('http') || s.images.startsWith('data:'))
      ? s.images.trim()
      : '') ||
    ''
  );
  let primaryImage = typeof primaryCandidate === 'string' ? primaryCandidate.trim() : '';
  if (
    !primaryImage ||
    primaryImage.includes('test-shirt') ||
    primaryImage.includes('default-client')
  ) {
    primaryImage = DEFAULT_SERVICE_IMAGE;
  }

  if (parsedImages.length === 0 && primaryImage) {
    parsedImages = [primaryImage];
  }

  const cleanImages = parsedImages
    .slice(0, 5)
    .map(img => {
      if (typeof img === 'string') {
        const trimmed = img.trim();
        if (
          trimmed.includes('test-shirt') ||
          trimmed.includes('default-client') ||
          !trimmed
        ) {
          return DEFAULT_SERVICE_IMAGE;
        }
        return resolveImageUrl(trimmed, DEFAULT_SERVICE_IMAGE);
      }
      return '';
    })
    .filter(Boolean);

  const finalImages = cleanImages.length > 0 ? cleanImages : [primaryImage];
  const resolvedPrimary = finalImages[0] || primaryImage;

  const durationStr = formatDurationString(s.duration || s.duration_minutes || '30 Minutes');
  const durationMins = parseDurationMinutes(s.duration_minutes || s.duration || 30);

  return {
    ...s,
    id: String(s.id || `srv-${Date.now()}`),
    name: String(s.name || ''),
    category: String(s.category || 'General'),
    description: String(s.description || ''),
    price: Number(s.price || 0),
    duration: durationStr,
    duration_minutes: durationMins,
    images: finalImages,
    image: resolvedPrimary,
    image_path: resolvedPrimary,
    badge: s.badge ? String(s.badge).trim() : undefined,
  };
}

export function getStoredServices(): Service[] {
  if (memoryServicesCache !== null) {
    return memoryServicesCache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map(normalizeService);
        memoryServicesCache = normalized;
        return normalized;
      }
    }
  } catch {}
  return [];
}

export function saveStoredServices(services: Service[]) {
  const normalized = services.map(normalizeService);
  memoryServicesCache = normalized;
  try {
    const jsonStr = JSON.stringify(normalized);
    localStorage.setItem(STORAGE_KEY, jsonStr);
    localStorage.setItem(FALLBACK_STORAGE_KEY, jsonStr);
  } catch (e) {
    console.warn('Storage write notice (using in-memory services cache):', e);
  }
  window.dispatchEvent(new CustomEvent(SERVICES_UPDATED_EVENT, { detail: normalized }));
  window.dispatchEvent(new Event('storage'));
}

export async function fetchCatalogServices(): Promise<Service[]> {
  try {
    const res = await fetch(`/api/services?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data)) {
        const normalized = data.map(normalizeService);
        saveStoredServices(normalized);
        return normalized;
      } else if (data && Array.isArray(data.services)) {
        const normalized = data.services.map(normalizeService);
        saveStoredServices(normalized);
        return normalized;
      }
    }
  } catch (err) {
    console.warn('Live services fetch error:', err);
  }
  return getStoredServices();
}

export async function persistService(service: Service): Promise<Service[]> {
  const clean = normalizeService(service);
  const current = getStoredServices();
  const existingIdx = current.findIndex(s => s.id === clean.id);
  let updated: Service[];
  if (existingIdx >= 0) {
    updated = current.map(s => (s.id === clean.id ? clean : s));
  } else {
    updated = [clean, ...current];
  }
  saveStoredServices(updated);

  try {
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        id: clean.id,
        name: clean.name,
        category: clean.category,
        price: clean.price,
        duration: clean.duration_minutes || parseDurationMinutes(clean.duration),
        duration_minutes: clean.duration_minutes || parseDurationMinutes(clean.duration),
        description: clean.description,
        images: clean.images,
        image: clean.image,
        badge: clean.badge,
      }),
    });

    if (res.ok) {
      const data: any = await res.json();
      if (data.success && data.service) {
        const savedService = normalizeService(data.service);
        const latestCurrent = getStoredServices();
        const idx = latestCurrent.findIndex(s => s.id === savedService.id);
        if (idx >= 0) {
          updated = latestCurrent.map(s => (s.id === savedService.id ? savedService : s));
        } else {
          updated = [savedService, ...latestCurrent];
        }
        saveStoredServices(updated);
      }
    }
  } catch (e) {
    console.warn('Network service save notice (fallback active):', e);
  }

  return updated;
}

export async function removeService(serviceId: string): Promise<Service[]> {
  const current = getStoredServices();
  const updated = current.filter(s => s.id !== serviceId);
  saveStoredServices(updated);

  try {
    await fetch(`/api/services?id=${serviceId}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ id: serviceId }),
    });
  } catch (e) {
    console.warn('Network service delete notice:', e);
  }

  return updated;
}

export const FALLBACK_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23f4f4f5'/%3E%3Crect x='155' y='160' width='90' height='80' rx='6' fill='none' stroke='%23d4d4d8' stroke-width='2.5'/%3E%3Cpath d='M155 185h90' fill='none' stroke='%23d4d4d8' stroke-width='2.5'/%3E%3Cpath d='M200 160v-12M188 148h24' fill='none' stroke='%23d4d4d8' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E";

export function handleImageError(
  e: { currentTarget: HTMLImageElement }
): void {
  const img = e.currentTarget;
  if (!img.dataset.errored) {
    img.dataset.errored = '1';
    img.src = FALLBACK_PLACEHOLDER;
  }
}

// Backward compatibility aliases
export {
  getStoredServices as getStoredProducts,
  saveStoredServices as saveStoredProducts,
  fetchCatalogServices as fetchCatalogProducts,
  persistService as persistProduct,
  removeService as removeProduct,
  getServicePrimaryImage as getProductPrimaryImage,
};
