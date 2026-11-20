// ==========================================
// E-COMMERCE & STOREFRONT DATA TYPES
// ==========================================

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  image?: string;
  image_path?: string;
  images: string[];
  stock: number;
  badge?: string;
  isFeatured?: boolean;
  createdAt?: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  description?: string;
  image?: string;
  image_path?: string;
  images?: string[];
  stock?: number;
  badge?: string;
  compareAtPrice?: number;
  product?: Product;
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// ==========================================
// STOREFRONT PROFILE & THEME CONFIGURATION
// ==========================================

export interface BusinessInfo {
  name?: string;
  tagline?: string;
  whatsapp?: string;
  phone?: string;
  currency?: string;
  currencySymbol?: string;
  address?: string;
  hours?: string;
  rating?: string;
  reviewCount?: string;
  mapsUrl?: string;
  promoText?: string;
  imageSlots?: Record<string, string>;
  heroHeadline?: string;
  heroSubheadline?: string;
  aboutDescription?: string;
  ctaHeadline?: string;
  heroImage?: string;
  heroImage2?: string;
  heroImage3?: string;
  logo?: string;
}

// ==========================================
// STOREFRONT CUSTOM SERVICES & SPECIAL OFFERS
// ==========================================

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration?: string | number;
  duration_minutes?: number;
  category: string;
  badge?: string;
  image?: string;
  images?: string[];
  imageUrls?: string[];
  image_path?: string;
  is_active?: boolean;
}
