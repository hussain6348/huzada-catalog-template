import type { Product } from './types';
import { getAuthHeaders } from './auth';

export const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80';

const STORAGE_KEY = 'merchant_catalog_products';
export const CATALOG_UPDATED_EVENT = 'catalog_products_updated';
let memoryProductsCache: Product[] | null = null;

export function resolveImageUrl(
  url?: string | null,
  fallback = DEFAULT_FALLBACK_IMAGE
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

export function getProductPrimaryImage(
  product?: Partial<Product> | any,
  fallback = DEFAULT_FALLBACK_IMAGE
): string {
  if (!product) return fallback;
  const raw =
    (Array.isArray(product.images) && product.images[0]) ||
    product.image ||
    product.image_path ||
    '';
  return resolveImageUrl(raw, fallback);
}

export function normalizeProduct(p: any): Product {
  let parsedImages: string[] = [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    parsedImages = p.images.filter(Boolean).map(String);
  } else if (typeof p.images === 'string' && p.images.trim()) {
    try {
      const parsed = JSON.parse(p.images);
      if (Array.isArray(parsed)) parsedImages = parsed.filter(Boolean).map(String);
      else if (typeof parsed === 'string' && parsed) parsedImages = [parsed];
    } catch {
      const trimmed = p.images.trim();
      if (
        trimmed.startsWith('http') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:') ||
        trimmed.startsWith('/')
      ) {
        parsedImages = [trimmed];
      }
    }
  }

  const primaryCandidate =
    parsedImages[0] ||
    p.image ||
    p.image_path ||
    (typeof p.images === 'string' && (p.images.startsWith('http') || p.images.startsWith('data:'))
      ? p.images.trim()
      : '') ||
    '';

  let primaryImage = typeof primaryCandidate === 'string' ? primaryCandidate.trim() : '';
  if (
    !primaryImage ||
    primaryImage.includes('test-shirt') ||
    primaryImage.includes('default-client')
  ) {
    primaryImage = DEFAULT_FALLBACK_IMAGE;
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
          return DEFAULT_FALLBACK_IMAGE;
        }
        return resolveImageUrl(trimmed, DEFAULT_FALLBACK_IMAGE);
      }
      return '';
    })
    .filter(Boolean);

  const finalImages = cleanImages.length > 0 ? cleanImages : [primaryImage];
  const resolvedPrimary = finalImages[0] || primaryImage;

  return {
    id: String(p.id || `prod_${Date.now()}`),
    name: String(p.name || ''),
    category: String(p.category || 'General'),
    description: String(p.description || ''),
    price: Number(p.price || 0),
    images: finalImages,
    image: resolvedPrimary,
    image_path: resolvedPrimary,
    stock: typeof p.stock === 'number' ? p.stock : (Number(p.stock) || 10),
    badge: p.badge ? String(p.badge).trim() : undefined,
  };
}

export function getStoredProducts(): Product[] {
  if (memoryProductsCache !== null) {
    return memoryProductsCache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map(normalizeProduct);
        memoryProductsCache = normalized;
        return normalized;
      }
    }
  } catch {}
  return [];
}

export function saveStoredProducts(products: Product[]) {
  const normalized = Array.isArray(products) ? products.map(normalizeProduct) : [];
  memoryProductsCache = normalized;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('Storage write notice:', e);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT, { detail: normalized }));
  }
}

export async function fetchCatalogProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`/api/products?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data: any = await res.json();
      if (data && Array.isArray(data.products)) {
        const normalized = data.products.map(normalizeProduct);
        saveStoredProducts(normalized);
        return normalized;
      } else if (Array.isArray(data)) {
        const normalized = data.map(normalizeProduct);
        saveStoredProducts(normalized);
        return normalized;
      }
    }
  } catch (err) {
    console.warn('Live catalog fetch notice:', err);
  }
  return getStoredProducts();
}

export async function persistProduct(product: Product): Promise<Product[]> {
  const clean = normalizeProduct(product);
  const current = getStoredProducts();
  const existingIdx = current.findIndex(p => p.id === clean.id);
  let updated: Product[];
  if (existingIdx >= 0) {
    updated = current.map(p => (p.id === clean.id ? clean : p));
  } else {
    updated = [clean, ...current];
  }
  saveStoredProducts(updated);

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(clean),
    });

    if (res.ok) {
      const data: any = await res.json();
      if (data.success && data.product) {
        const savedProduct = normalizeProduct(data.product);
        const latestCurrent = getStoredProducts();
        const idx = latestCurrent.findIndex(p => p.id === savedProduct.id);
        if (idx >= 0) {
          updated = latestCurrent.map(p => (p.id === savedProduct.id ? savedProduct : p));
        } else {
          updated = [savedProduct, ...latestCurrent];
        }
        saveStoredProducts(updated);
      }
    }
  } catch (e) {
    console.warn('Network product save notice (optimistic active):', e);
  }

  return updated;
}

export async function removeProduct(productId: string): Promise<Product[]> {
  const current = getStoredProducts();
  const updated = current.filter(p => p.id !== productId);
  saveStoredProducts(updated);

  try {
    await fetch(`/api/products?id=${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });
  } catch (e) {
    console.warn('Network product delete notice:', e);
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

/**
 * Divides up to maxTotal (default 8) slots fairly across available categories using their latest items.
 * Handles 0, 1, and N categories, uneven category sizes, and never exceeds maxTotal.
 */
export function selectCategoryDividedProducts(products: Product[], maxTotal = 8): Product[] {
  if (!Array.isArray(products) || products.length === 0) return [];
  if (products.length <= maxTotal) {
    return products.slice(0, maxTotal);
  }

  const categoryMap = new Map<string, Product[]>();
  for (const p of products) {
    const cat = p.category?.trim() || 'General';
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }
    categoryMap.get(cat)!.push(p);
  }

  const categories = Array.from(categoryMap.keys());
  if (categories.length === 0) return [];
  if (categories.length === 1) {
    return (categoryMap.get(categories[0]) || []).slice(0, maxTotal);
  }

  const selected: Product[] = [];
  const pointers = new Map<string, number>();
  for (const cat of categories) pointers.set(cat, 0);

  let addedInRound = true;
  while (selected.length < maxTotal && addedInRound) {
    addedInRound = false;
    for (const cat of categories) {
      if (selected.length >= maxTotal) break;
      const catProducts = categoryMap.get(cat) || [];
      const ptr = pointers.get(cat) || 0;
      if (ptr < catProducts.length) {
        selected.push(catProducts[ptr]);
        pointers.set(cat, ptr + 1);
        addedInRound = true;
      }
    }
  }

  return selected;
}
