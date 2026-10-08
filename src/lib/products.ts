import type { Product } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Minimalist Steel Water Bottle',
    description: 'Double-wall vacuum insulated flask with matte textured finish (750ml).',
    price: 1250,
    category: 'Lifestyle',
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
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
    stock: 9,
  },
  {
    id: 'prod-3',
    name: 'Matte Ceramic Pour-Over Mug',
    description: 'Artisanal stoneware ceramic mug with ergonomic unglazed clay base (320ml).',
    price: 950,
    category: 'Lifestyle',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
    stock: 24,
  },
  {
    id: 'prod-4',
    name: 'Padded Keyboard Wrist Rest',
    description: 'High-density memory foam wrist rest with anti-fray stitched fabric rim.',
    price: 1400,
    category: 'Workspace',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    stock: 12,
  },
  {
    id: 'prod-5',
    name: 'Anodized Brass Rollerball Pen',
    description: 'Balanced solid brass casing engineered for ultra-smooth fluid ink delivery.',
    price: 850,
    category: 'Accessories',
    image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80',
    stock: 35,
  },
  {
    id: 'prod-6',
    name: 'Felt Desk Pad Protector',
    description: 'Premium wool blend desk pad with non-slip natural rubber backing (80x40cm).',
    price: 1650,
    category: 'Workspace',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
    stock: 15,
  },
];

const STORAGE_KEY = 'merchant_catalog_products';
export const CATALOG_UPDATED_EVENT = 'catalog_products_updated';

export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return INITIAL_PRODUCTS;
}

export function saveStoredProducts(products: Product[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT, { detail: products }));
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
        saveStoredProducts(data.products);
        return data.products;
      }
    }
  } catch {}
  return getStoredProducts();
}

export async function persistProduct(product: Product): Promise<Product[]> {
  const current = getStoredProducts();
  const existingIdx = current.findIndex(p => p.id === product.id);
  let updated: Product[];
  if (existingIdx >= 0) {
    updated = current.map(p => (p.id === product.id ? product : p));
  } else {
    updated = [product, ...current];
  }
  saveStoredProducts(updated);

  try {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
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
    });
  } catch (e) {
    console.warn('Network product delete notice:', e);
  }

  return updated;
}
