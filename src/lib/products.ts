import React from 'react';
import type { Product } from './types';

export const CATALOG_UPDATED_EVENT = 'catalog:updated';
export const RELIABLE_PLACEHOLDER =
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80';

export const INITIAL_SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    name: 'Classic Vintage Denim Jacket',
    description: 'Heavyweight premium denim jacket with timeless cut and buttoned chest pockets.',
    category: 'Apparel',
    price: 4500,
    stock: 12,
    badge: 'Popular',
    image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&q=80'],
  },
  {
    id: 'prod-002',
    name: 'Heavyweight Minimalist Tee',
    description: '240 GSM 100% combed cotton basic t-shirt with ribbed collar and relaxed fit.',
    category: 'Apparel',
    price: 1850,
    stock: 25,
    badge: 'Bestseller',
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'],
  },
  {
    id: 'prod-003',
    name: 'Full-Grain Leather Bi-Fold Wallet',
    description: 'Handcrafted genuine leather wallet with 8 card slots, currency divider, and RFID shield.',
    category: 'Accessories',
    price: 2400,
    stock: 15,
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80'],
  },
  {
    id: 'prod-004',
    name: 'Matte Black Chrono Watch',
    description: 'Sleek analog dial with stainless steel mesh strap, quartz movement, and 50m water resistance.',
    category: 'Watches',
    price: 6800,
    stock: 8,
    badge: 'Limited',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80'],
  },
  {
    id: 'prod-005',
    name: 'Rugged Canvas Travel Duffel',
    description: 'Water-resistant waxed canvas weekender bag with reinforced leather handles and luggage strap.',
    category: 'Bags',
    price: 5200,
    stock: 10,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'],
  },
  {
    id: 'prod-006',
    name: 'Polarized Vintage Acetate Shades',
    description: 'UV400 protective polarized sunglasses with lightweight amber acetate frame.',
    category: 'Accessories',
    price: 2950,
    stock: 18,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80'],
  },
];

export function getProductPrimaryImage(
  product?: { image?: string; image_path?: string; images?: string[] } | null
): string {
  if (!product) return RELIABLE_PLACEHOLDER;
  const primary =
    product.image ||
    product.image_path ||
    (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : '');

  const cleaned = String(primary || '').trim();
  if (
    !cleaned ||
    cleaned.includes('test-shirt') ||
    cleaned.includes('default-client')
  ) {
    return RELIABLE_PLACEHOLDER;
  }
  return cleaned;
}

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  if (target.src !== RELIABLE_PLACEHOLDER) {
    target.src = RELIABLE_PLACEHOLDER;
  }
}

export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem('huzada_catalog_products');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse cached products from localStorage', err);
  }
  return INITIAL_SAMPLE_PRODUCTS;
}

export function setStoredProducts(products: Product[]): void {
  try {
    localStorage.setItem('huzada_catalog_products', JSON.stringify(products));
    window.dispatchEvent(
      new CustomEvent(CATALOG_UPDATED_EVENT, { detail: products })
    );
  } catch (err) {
    console.warn('Failed to save products to localStorage', err);
  }
}

export async function fetchCatalogProducts(): Promise<Product[]> {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.products) && data.products.length > 0) {
        setStoredProducts(data.products);
        return data.products;
      }
    }
  } catch (err) {
    console.warn('Network error fetching catalog products, using stored products', err);
  }
  return getStoredProducts();
}

export async function saveProductApi(
  product: Partial<Product>,
  token?: string
): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/products', {
      method: 'POST',
      headers,
      body: JSON.stringify(product),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const current = getStoredProducts();
      const updatedProduct = data.product || product;
      const index = current.findIndex((p) => p.id === updatedProduct.id);
      let updatedList: Product[];
      if (index >= 0) {
        updatedList = [...current];
        updatedList[index] = { ...updatedList[index], ...updatedProduct };
      } else {
        updatedList = [updatedProduct, ...current];
      }
      setStoredProducts(updatedList);
      return { success: true, product: updatedProduct };
    }
    return { success: false, error: data.error || 'Failed to save product' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

export async function deleteProductApi(
  id: string,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const current = getStoredProducts();
      const updatedList = current.filter((p) => p.id !== id);
      setStoredProducts(updatedList);
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to delete product' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}
