import type { Product } from './types';
import { getAuthHeaders } from './auth';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Minimalist Steel Water Bottle',
    description: 'Double-wall vacuum insulated flask with matte textured finish (750ml).',
    price: 1250,
    category: 'Lifestyle',
    images: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
      'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
      'https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
    stock: 18,
    badge: 'Popular',
  },
  {
    id: 'prod-2',
    name: 'Walnut Desktop Organizer',
    description: 'Precision milled solid walnut tray for pens, phone, and desktop cables.',
    price: 1850,
    category: 'Workspace',
    images: [
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
    stock: 9,
  },
  {
    id: 'prod-3',
    name: 'Matte Ceramic Pour-Over Mug',
    description: 'Artisanal stoneware ceramic mug with ergonomic unglazed clay base (320ml).',
    price: 950,
    category: 'Lifestyle',
    images: [
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
    stock: 24,
  },
  {
    id: 'prod-4',
    name: 'Padded Keyboard Wrist Rest',
    description: 'High-density memory foam wrist rest with anti-fray stitched fabric rim.',
    price: 1400,
    category: 'Workspace',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    stock: 12,
  },
  {
    id: 'prod-5',
    name: 'Anodized Brass Rollerball Pen',
    description: 'Balanced solid brass casing engineered for ultra-smooth fluid ink delivery.',
    price: 850,
    category: 'Accessories',
    images: [
      'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80',
    stock: 35,
  },
  {
    id: 'prod-6',
    name: 'Felt Desk Pad Protector',
    description: 'Premium wool blend desk pad with non-slip natural rubber backing (80x40cm).',
    price: 1650,
    category: 'Workspace',
    images: [
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
    stock: 15,
  },
];

const STORAGE_KEY = 'merchant_catalog_products';
export const CATALOG_UPDATED_EVENT = 'catalog_products_updated';

function normalizeProduct(p: any): Product {
  let parsedImages: string[] = [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    parsedImages = p.images.filter(Boolean);
  } else if (typeof p.images === 'string' && p.images.trim()) {
    try {
      const parsed = JSON.parse(p.images);
      if (Array.isArray(parsed)) parsedImages = parsed.filter(Boolean);
    } catch {
      parsedImages = [];
    }
  }

  const primaryImage = (parsedImages[0] || p.image || p.image_path || '') as string;
  if (parsedImages.length === 0 && primaryImage) {
    parsedImages = [primaryImage];
  }

  return {
    ...p,
    id: String(p.id),
    name: String(p.name || ''),
    category: String(p.category || 'General'),
    description: String(p.description || ''),
    price: Number(p.price || 0),
    images: parsedImages.slice(0, 5),
    image: primaryImage,
    image_path: primaryImage,
    stock: p.stock ?? 10,
  };
}

export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeProduct);
      }
    }
  } catch {}
  return INITIAL_PRODUCTS;
}

export function saveStoredProducts(products: Product[]) {
  try {
    const normalized = products.map(normalizeProduct);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT, { detail: normalized }));
  } catch (e) {
    console.error('Storage write error:', e);
  }
}

export async function fetchCatalogProducts(): Promise<Product[]> {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        const normalized = data.products.map(normalizeProduct);
        saveStoredProducts(normalized);
        return normalized;
      }
    }
  } catch {}
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
    console.warn('Network product save notice (fallback active):', e);
  }

  return updated;
}

export async function removeProduct(productId: string): Promise<Product[]> {
  const current = getStoredProducts();
  const updated = current.filter(p => p.id !== productId);
  saveStoredProducts(updated);

  try {
    await fetch(`/api/products?id=${productId}`, {
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
