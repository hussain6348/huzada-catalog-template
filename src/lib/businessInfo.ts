import type { BusinessInfo } from './types';
import { getAuthHeaders } from './auth';

// ─── Event Keys ───────────────────────────────────────────────────────────────
export const BUSINESS_INFO_UPDATED_EVENT = 'waas-business-info-updated';
export const IMAGE_SLOT_UPDATED_EVENT = 'waas-update-slot-image';

// ─── Default business info (WaaS platform defaults) ──────────────────────────
export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  name: 'Huzada Booking',
  tagline: 'Professional Appointments Tailored to You',
  whatsapp: '923322264855',
  phone: '+1 (409) 256-3597',
  currency: 'USD',
  currencySymbol: '$',
  address: '811 6th St N #200, Texas City, TX 77590',
  hours: 'Mon–Sat, 9:00 AM – 6:00 PM',
  rating: '4.9',
  reviewCount: '48+',
  mapsUrl: 'https://maps.google.com/',
  imageSlots: {},
  promoText: '',
  heroHeadline: '',
  heroSubheadline: '',
  aboutDescription: '',
  ctaHeadline: '',
  heroImage: '',
  heroImage2: '',
  heroImage3: '',
};

const STORAGE_KEY = 'waas_business_info';
const IMAGE_SLOTS_KEY = 'waas_image_slots';

// ─── Image Slot Persistence ───────────────────────────────────────────────────

export function getStoredImageSlots(): Record<string, string> {
  try {
    const raw = localStorage.getItem(IMAGE_SLOTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveImageSlot(slot: string, url: string): void {
  const current = getStoredImageSlots();
  current[slot] = url;
  try {
    localStorage.setItem(IMAGE_SLOTS_KEY, JSON.stringify(current));
    localStorage.setItem(`waas_img_${slot}`, url);
  } catch {}
  // Dispatch the universal slot update event so EditableImage reacts instantly
  window.dispatchEvent(
    new CustomEvent(IMAGE_SLOT_UPDATED_EVENT, { detail: { slot, url } })
  );
}

// ─── Business Info Persistence ───────────────────────────────────────────────

export function getStoredBusinessInfo(): BusinessInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BusinessInfo>;
      const slots = getStoredImageSlots();
      return {
        ...DEFAULT_BUSINESS_INFO,
        ...parsed,
        promoText: parsed.promoText !== undefined ? parsed.promoText : DEFAULT_BUSINESS_INFO.promoText,
        imageSlots: { ...DEFAULT_BUSINESS_INFO.imageSlots, ...parsed.imageSlots, ...slots },
      };
    }
  } catch {}
  const slots = getStoredImageSlots();
  return { ...DEFAULT_BUSINESS_INFO, imageSlots: { ...DEFAULT_BUSINESS_INFO.imageSlots, ...slots } };
}

export function saveBusinessInfo(info: BusinessInfo): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch (e) {
    console.warn('[WaaS] Business info storage write failed (using in-memory):', e);
  }
  window.dispatchEvent(new CustomEvent(BUSINESS_INFO_UPDATED_EVENT, { detail: info }));
}

// ─── Remote Fetch (Turso via API) ────────────────────────────────────────────

export async function fetchBusinessInfo(): Promise<BusinessInfo> {
  try {
    const res = await fetch('/api/business-info', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.businessInfo) {
        const merged: BusinessInfo = {
          ...DEFAULT_BUSINESS_INFO,
          ...data.businessInfo,
          promoText: data.businessInfo.promoText !== undefined ? data.businessInfo.promoText : DEFAULT_BUSINESS_INFO.promoText,
          imageSlots: {
            ...DEFAULT_BUSINESS_INFO.imageSlots,
            ...(data.businessInfo.imageSlots || {}),
            ...getStoredImageSlots(), // local overrides always win
          },
        };
        saveBusinessInfo(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('[WaaS] Business info fetch failed, using stored:', err);
  }
  return getStoredBusinessInfo();
}

export async function persistBusinessInfo(info: BusinessInfo): Promise<void> {
  saveBusinessInfo(info);
  try {
    await fetch('/api/business-info', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(info),
    });
  } catch (err) {
    console.warn('[WaaS] Business info remote save failed (local save preserved):', err);
  }
}
