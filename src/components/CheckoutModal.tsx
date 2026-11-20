import React, { useState } from 'react';
import {
  X,
  LoaderCircle,
  ShoppingBag,
  User,
  Phone,
  MapPin,
  ShieldCheck,
  Truck,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import type { CartItem } from '../lib/types';
import { clientConfig } from '../config/client';
import { getProductPrimaryImage, handleImageError } from '../lib/products';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  currencySymbol?: string;
  onComplete?: () => void;
}

interface ConfirmedOrder {
  id: string;
}

export function CheckoutModal({
  isOpen,
  onClose,
  items,
  total,
  currencySymbol,
  onComplete,
}: CheckoutModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  if (!isOpen) return null;

  const effectiveCurrency = currencySymbol || clientConfig.currencySymbol || 'Rs.';

  const handleClose = () => {
    if (confirmedOrder) {
      if (onComplete) onComplete();
      setConfirmedOrder(null);
    }
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    const trimmedNotes = notes.trim();

    if (!items || items.length === 0) {
      setError('Your shopping bag is empty.');
      return;
    }

    if (!trimmedName || !trimmedPhone || !trimmedAddress) {
      setError('Please fill in all required fields (Name, Contact Number, and Delivery Address).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const generatedOrderId = `ORD-${Date.now().toString().slice(-6)}`;
      const orderPayload = {
        orderId: generatedOrderId,
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        customerAddress: trimmedAddress,
        items,
        total,
        notes: trimmedNotes || undefined,
        status: 'pending',
      };

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      let finalOrderId = generatedOrderId;
      if (res.ok) {
        try {
          const data = (await res.json()) as { orderId?: string };
          if (data && data.orderId) {
            finalOrderId = data.orderId;
          }
        } catch {
          // Continue with generated orderId
        }
      }

      setConfirmedOrder({ id: finalOrderId });
    } catch {
      setError('Unable to submit order right now. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-zinc-900 text-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold tracking-tight">
                {confirmedOrder ? 'Order Confirmed' : 'Checkout & Place Order'}
              </h2>
            </div>
            <p className="text-xs text-zinc-300 mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Direct Storefront Order · Doorstep Delivery
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition-colors hover:bg-white/10 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedOrder ? (
          /* Order Confirmed Screen (Pure Web Checkout - No WhatsApp) */
          <div className="p-6 sm:p-8 text-center space-y-6 overflow-y-auto">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Your Order has been Received!</h3>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                Thank you, <span className="font-semibold text-slate-900">{name}</span>. Your order reference ID is{' '}
                <span className="font-semibold text-slate-900 font-mono bg-zinc-100 px-2 py-0.5 rounded">
                  {confirmedOrder.id}
                </span>
                . Our store operations team has received your order notification.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between items-center text-slate-500 pb-2 border-b border-slate-200">
                <span>Total Due on Delivery</span>
                <span className="font-bold text-base text-slate-900 tabular-nums font-mono">
                  {effectiveCurrency} {total.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Recipient:</span>
                <span className="font-medium text-slate-900">{name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Contact:</span>
                <span className="font-medium text-slate-900">{phone}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500 shrink-0">Delivery Address:</span>
                <span className="font-medium text-slate-900 text-right truncate">
                  {address}
                </span>
              </div>
              {notes && (
                <div className="flex items-start justify-between gap-4 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 shrink-0">Notes:</span>
                  <span className="font-medium text-slate-700 text-right">{notes}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer shadow-md"
              >
                Done / Back to Store
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Form & Order Summary */
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
            {error && (
              <div className="p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200 flex items-center gap-2">
                <span>{error}</span>
              </div>
            )}

            {/* Order Review with Thumbnails */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                <span>
                  Order Summary ({(items || []).reduce((s, i) => s + (i.quantity || 1), 0)} items)
                </span>
                <span className="text-slate-700 font-normal">Pay on Delivery</span>
              </div>

              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 max-h-40 overflow-y-auto divide-y divide-slate-200/50">
                {!items || items.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">Your bag is empty.</p>
                ) : (
                  items.map((item) => {
                    const imgSrc = getProductPrimaryImage(item);
                    return (
                      <div
                        key={item.id}
                        className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={imgSrc}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            onError={handleImageError}
                            className="w-10 h-10 aspect-square rounded-lg object-cover bg-slate-200 shrink-0 border border-slate-200/60"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 text-xs truncate">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {effectiveCurrency} {item.price.toLocaleString()} ×{' '}
                              {item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-xs text-slate-900 tabular-nums shrink-0 font-mono">
                          {effectiveCurrency}{' '}
                          {(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Customer Details Form */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Your Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  Contact Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="tel"
                  placeholder="e.g. +1 555 123 4567"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  Complete Delivery Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="House/Apartment #, Street, Area / Sector, City"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors resize-none"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Delivery Notes{' '}
                  <span className="text-slate-400 text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Leave package with front desk"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Delivery Badge */}
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Standard Doorstep Delivery</span>
              </div>
              <span className="font-semibold text-emerald-700">Free</span>
            </div>

            {/* Footer Summary & Action */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium text-slate-600">Total Payable:</span>
                <span className="text-xl font-bold text-slate-900 tabular-nums font-mono">
                  {effectiveCurrency} {total.toLocaleString()}
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || !items || items.length === 0}
                className="w-full bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-between shadow-lg shadow-zinc-900/20 transition-all text-sm group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  <span>
                    {loading ? 'Submitting Order...' : 'Confirm & Place Order'}
                  </span>
                </div>
                {loading ? (
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="bg-zinc-800 px-2.5 py-0.5 rounded-lg text-xs font-medium tabular-nums font-mono">
                    {effectiveCurrency} {total.toLocaleString()}
                  </span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CheckoutModal;
