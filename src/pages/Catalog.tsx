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
        <h1 className="font-bold text-xl flex items-center gap-2"><Package/> {clientConfig.businessName}</h1>
        <button
          onClick={() => setIsCheckoutOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm"
        >
          <ShoppingBag size={18} className="text-emerald-400" />
          <span>Bag ({itemCount})</span>
          {itemCount > 0 && (
            <span className="border-l border-slate-700 pl-2 font-semibold tabular-nums text-emerald-300">
              Rs. {total.toLocaleString()}
            </span>
          )}
        </button>
      </header>
      <main className="p-4 grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto mt-8 pb-20 sm:pb-8">
        {products.map(p => {
          const inCart = cart.find(i => i.id === p.id);
          return (
            <div key={p.id} className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <img
                src={p.image}
                alt={p.name}
                referrerPolicy="no-referrer"
                className="w-full h-52 object-cover bg-slate-100"
              />
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">{p.category}</span>
                    <h2 className="font-semibold text-slate-900">{p.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                  </div>
                  <span className="text-slate-900 font-bold tabular-nums">Rs. {p.price.toLocaleString()}</span>
                </div>
                {inCart ? (
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                    <span className="font-medium text-xs text-slate-600 pl-1">In bag ({inCart.quantity})</span>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => changeQty(p.id, -1)} className="bg-white hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 shadow-xs text-slate-700 transition-colors">
                        <Minus size={14} />
                      </button>
                      <span className="font-bold text-xs tabular-nums px-1">{inCart.quantity}</span>
                      <button onClick={() => changeQty(p.id, 1)} className="bg-slate-900 hover:bg-slate-800 text-white p-1.5 rounded-lg shadow-xs transition-colors">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(p)}
                    className="w-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 py-2.5 rounded-xl font-medium text-xs transition-colors"
                  >
                    Add to bag
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Mobile Floating Checkout Trigger */}
      {itemCount > 0 && !isCheckoutOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-sm mx-auto z-30 sm:hidden">
          <button
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full bg-slate-900 text-white font-medium py-3 px-4 rounded-2xl shadow-xl flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-2 text-xs">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              <span>Checkout ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
            </div>
            <span className="text-xs font-bold tabular-nums text-emerald-300">
              Rs. {total.toLocaleString()} →
            </span>
          </button>
        </div>
      )}
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} items={cart} total={total} onComplete={() => setCart([])} />
    </div>
  )
}
