export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock?: number;
  image?: string;
  image_path?: string;
  images?: string[];
  badge?: string;
  created_at?: string;
}

export interface CartItem extends Product {
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  createdAt?: string;
}
