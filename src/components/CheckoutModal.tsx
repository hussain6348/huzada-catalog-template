import { useState } from 'react';
import { X, LoaderCircle } from 'lucide-react';
import { clientConfig } from '../config/client';
import type { CartItem } from '../lib/types';

export function CheckoutModal({ isOpen, onClose, items, total, onComplete }: any) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/order', { method: 'POST', body: JSON.stringify({ customerName: name, customerPhone: phone, customerAddress: address, items, total }) });
      const data = await res.json();
      const msg = `Order ID: ${data.orderId || 'PENDING'}\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\n\nTotal: Rs.${total}`;
      const waUrl = `https://wa.me/${clientConfig.whatsappNumber}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      onComplete();
      onClose();
    } catch {
      setError("Error saving order. Please check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-600 p-4 text-white flex justify-between font-bold"><h2>Checkout</h2><button onClick={onClose}><X/></button></div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <div className="p-2 text-sm text-red-600 bg-red-50 rounded border border-red-200">{error}</div>}
          <input required placeholder="Name" className="w-full border p-2 rounded" value={name} onChange={e => setName(e.target.value)} />
          <input required placeholder="WhatsApp Number" className="w-full border p-2 rounded" value={phone} onChange={e => setPhone(e.target.value)} />
          <textarea required placeholder="Address" className="w-full border p-2 rounded" value={address} onChange={e => setAddress(e.target.value)} />
          <button disabled={loading} className="w-full bg-blue-600 text-white font-bold p-3 rounded flex justify-center">{loading ? <LoaderCircle className="animate-spin"/> : 'Order on WhatsApp'}</button>
        </form>
      </div>
    </div>
  )
}
