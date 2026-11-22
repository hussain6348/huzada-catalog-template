import type { CartItem } from './types';

export const CART_STORAGE_KEY = 'waas_catalog_cart';
export const CART_UPDATED_EVENT = 'huzada_cart_updated';
export const OPEN_CART_EVENT = 'huzada_open_cart';

let inMemoryCart: CartItem[] = [];

/**
 * Safely retrieves stored cart items from localStorage with in-memory fallback.
 * Strictly wrapped in try/catch to protect iframe / restricted browser environments.
 */
export function getStoredCart(): CartItem[] {
  if (typeof window === 'undefined') return inMemoryCart;
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return inMemoryCart;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryCart = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn('[WaaS Cart] Failed to read cart storage, using in-memory:', err);
  }
  return inMemoryCart;
}

/**
 * Safely persists cart items to localStorage and dispatches a unified CART_UPDATED_EVENT.
 */
export function saveStoredCart(items: CartItem[]): void {
  const safeItems = Array.isArray(items) ? items : [];
  inMemoryCart = safeItems;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(safeItems));
    } catch (err) {
      console.warn('[WaaS Cart] Failed to persist cart storage:', err);
    }
    const count = safeItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const total = safeItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    window.dispatchEvent(
      new CustomEvent(CART_UPDATED_EVENT, {
        detail: { items: safeItems, count, total },
      })
    );
  }
}

/**
 * Dispatches an event to open the slide-over bag drawer across the storefront.
 */
export function openCartDrawer(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_CART_EVENT));
  }
}

/**
 * Calculates total item count across all line items in the cart.
 */
export function calculateCartCount(items: CartItem[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
}

/**
 * Calculates total currency amount across all line items in the cart.
 */
export function calculateCartTotal(items: CartItem[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
}
