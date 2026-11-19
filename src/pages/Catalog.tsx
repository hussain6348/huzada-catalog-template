import { useState } from 'react';
import { Package, ShoppingBag, Plus, Minus, ArrowRight } from 'lucide-react';
import { CheckoutModal } from '../components/CheckoutModal';
import { clientConfig } from '../config/client';
import type { CartItem, Product } from '../lib/types';

const products: Product[] = [
  { id: '1', name: 'Everyday Bottle', description: 'A reusable bottle.', price: 1250, category: 'Lifestyle', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&q=80' },
  { id: '2', name: 'Desk Organizer', description: 'Keep essentials neat.', price: 1850, category: 'Workspace', image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&q=80' }
];

export function Catalog() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (p: Product) => setCart(c => c.find(i => i.id === p.id) ? c.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i) : [...c, { ...p, quantity: 1 }]);
  const changeQty = (id: string, d: number) => setCart(c => c.map(i => i.id === id ? { ...i, quantity: i.quantity + d } : i).filter(i => i.quantity > 0));

  return (
    <div className="min-h-screen">
      <header className="bg-white p-4 shadow-sm flex justify-between items-center">
        <h1 className="font-bold text-xl flex items-center gap-2"><Package className="text-[var(--theme-primary)]" stroke="currentColor" /> {clientConfig.businessName}</h1>
        <button onClick={() => setIsCheckoutOpen(true)} className="flex items-center gap-2 bg-[var(--theme-primary)] text-[var(--theme-bg)] hover:brightness-110 active:scale-95 transition-all px-4 py-2 rounded-lg font-bold"><ShoppingBag size={18} className="text-[var(--theme-bg)]" stroke="currentColor" /> Bag: {itemCount}</button>
      </header>
      <main className="p-4 grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto mt-8">
        {products.map(p => {
          const inCart = cart.find(i => i.id === p.id);
          return (
            <div key={p.id} className="border rounded-xl bg-white overflow-hidden shadow-sm">
              <img src={p.image} className="w-full h-48 object-cover" />
              <div className="p-4">
                <div className="flex justify-between font-bold"><span>{p.name}</span><span className="text-[var(--theme-primary)]">Rs. {p.price}</span></div>
                {inCart ? 
                  <div className="mt-4 flex items-center justify-between p-2 rounded-lg border" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' }}><span className="font-bold text-sm text-[var(--theme-primary)]">In bag</span><div className="flex gap-3 items-center"><button onClick={() => changeQty(p.id, -1)} className="bg-white p-1 rounded shadow-sm hover:scale-110 transition-transform"><Minus size={16}/></button><span className="font-bold">{inCart.quantity}</span><button onClick={() => changeQty(p.id, 1)} className="bg-[var(--theme-primary)] text-[var(--theme-bg)] hover:brightness-110 active:scale-95 transition-all p-1 rounded"><Plus size={16} className="text-[var(--theme-bg)]" stroke="currentColor" /></button></div></div> 
                  : <button onClick={() => addToCart(p)} className="mt-4 w-full bg-slate-100 hover:bg-slate-200 py-2 rounded-lg font-bold text-sm">Add to bag</button>}
              </div>
            </div>
          )
        })}
      </main>
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} items={cart} total={total} onComplete={() => setCart([])} />
    </div>
  )
}
