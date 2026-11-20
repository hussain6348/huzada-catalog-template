export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  duration_minutes?: number;
  category?: string;
  images: string[];
  imageUrls?: string[];
  image?: string;
  image_path?: string;
  badge?: string;
  featured?: boolean;
}

export interface ServiceFormData {
  name: string;
  category: string;
  customCategory?: string;
  price: number;
  duration: string;
  description: string;
  images: string[];
  badge: string;
}

export interface ServiceInput {
  name: string;
  category: string;
  price: number;
  duration: string;
  description?: string;
  images?: string[];
  badge?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  image?: string;
  image_path?: string;
  stock?: number;
  badge?: string;
  duration?: string;
  featured?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';
export type AppointmentStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceName: string;
  date: string;
  bookingDate?: string;
  time?: string;
  bookingTime?: string;
  duration?: string;
  notes?: string;
  price?: number;
  total?: number;
  status: AppointmentStatus;
  createdAt: string;
}

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

// ─── WaaS Master Theme Types ─────────────────────────────────────────────────

export type ImageSlot = 'logo' | 'hero' | 'about' | 'promo' | 'hero2' | 'hero3';

export type ImageSlotMap = Partial<Record<ImageSlot, string>>;

export interface BusinessInfo {
  name: string;
  tagline: string;
  whatsapp: string;
  phone?: string;
  currency: string;
  currencySymbol: string;
  address?: string;
  hours?: string;
  rating?: string;
  reviewCount?: string;
  mapsUrl?: string;
  imageSlots?: Record<string, string>;
  logo?: string;
  promoText?: string;
  heroHeadline?: string;
  heroSubheadline?: string;
  aboutDescription?: string;
  ctaHeadline?: string;
  heroImage?: string;
  heroImage2?: string;
  heroImage3?: string;
}
