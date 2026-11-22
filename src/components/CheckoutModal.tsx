import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Copy,
  Check,
  Clock,
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
  const [copiedId, setCopiedId] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const effectiveCurrency = currencySymbol || clientConfig.currencySymbol || 'Rs.';

  // Lock background body scroll while modal is active
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleClose = () => {
    if (confirmedOrder) {
      if (onComplete) onComplete();
      setConfirmedOrder(null);
    }
    setError(null);
    setTouchedFields({});
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, confirmedOrder]);

  const handleCopyOrderId = () => {
    if (!confirmedOrder?.id || typeof navigator === 'undefined') return;
    try {
      navigator.clipboard?.writeText(confirmedOrder.id).then(() => {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      }).catch(() => {});
    } catch {
      // Ignore clipboard permission issues
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    const trimmedNotes = notes.trim();

    setTouchedFields({ name: true, phone: true, address: true });

    if (!items || items.length === 0) {
      setError('Your shopping bag is empty.');
      return;
    }

    if (!trimmedName) {
      setError('Please provide your full name for order delivery.');
      return;
    }

    if (!trimmedPhone || trimmedPhone.replace(/[^0-9]/g, '').length < 7) {
      setError('Please provide a valid contact phone number (at least 7 digits) for courier coordination.');
      return;
    }

    if (!trimmedAddress || trimmedAddress.length < 5) {
      setError('Please provide a complete delivery address (street, area, city).');
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

  const modalContent = (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in duration-200 font-sans text-[var(--theme-text)]">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--theme-surface)] rounded-[var(--theme-radius)] w-full max-w-lg shadow-2xl border border-[var(--theme-border)] overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200 ease-out"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[var(--theme-border)] flex items-center justify-between bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[var(--theme-on-primary)]" />
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">
                {confirmedOrder ? 'Order Confirmed' : 'Checkout & Place Order'}
              </h2>
            </div>
            <p className="text-xs text-[var(--theme-on-primary-muted)] mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--theme-on-primary)]" />
              Direct Storefront Order · Doorstep Delivery
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-[var(--theme-on-primary-muted)] hover:text-[var(--theme-on-primary)] p-1.5 rounded-lg transition-colors hover:bg-[var(--theme-on-primary-border)] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedOrder ? (
          /* Order Confirmed Screen (Pure Web Checkout - No WhatsApp) */
          <div className="p-6 sm:p-8 text-center space-y-6 overflow-y-auto">
            <div className="w-16 h-16 bg-[var(--theme-surface-subtle)] text-[var(--theme-primary)] border border-[var(--theme-border)] rounded-full flex items-center justify-center mx-auto shadow-md btn-radar">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-[var(--theme-text)] font-editorial">
                Your Order has been Received!
              </h3>
              <p className="text-xs sm:text-sm text-[var(--theme-text-muted)] max-w-sm mx-auto leading-relaxed">
                Thank you, <span className="font-semibold text-[var(--theme-text)]">{name}</span>. Your order reference ID is:
              </p>
              <div className="inline-flex items-center gap-2 bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1.5 rounded-[var(--theme-radius-inner)] shadow-xs">
                <span className="font-bold text-sm sm:text-base text-[var(--theme-text)] font-mono tracking-wider">
                  {confirmedOrder.id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyOrderId}
                  className="p-1 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface)] transition-colors cursor-pointer"
                  title="Copy Order ID"
                >
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] rounded-[var(--theme-radius-inner)] p-4 text-left space-y-2.5 text-xs text-[var(--theme-text-muted)] shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--theme-border)]">
                <span className="font-semibold text-[var(--theme-text)]">Total Payable on Delivery</span>
                <span className="font-bold text-base text-[var(--theme-text)] tabular-nums font-mono">
                  {effectiveCurrency} {total.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Recipient:</span>
                <span className="font-medium text-[var(--theme-text)]">{name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Phone:</span>
                <span className="font-medium text-[var(--theme-text)] font-mono">{phone}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="shrink-0">Delivery Address:</span>
                <span className="font-medium text-[var(--theme-text)] text-right break-words max-w-[65%]">
                  {address}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[var(--theme-border)] text-[11px]">
                <span className="flex items-center gap-1 text-[var(--theme-primary)] font-medium">
                  <Clock className="w-3 h-3" />
                  <span>Estimated Delivery</span>
                </span>
                <span className="font-medium text-[var(--theme-text)]">2–4 Business Days</span>
              </div>
              {notes && (
                <div className="flex items-start justify-between gap-4 pt-1 border-t border-[var(--theme-border)]">
                  <span className="shrink-0">Notes:</span>
                  <span className="font-medium text-[var(--theme-text)] text-right">{notes}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold py-3 px-4 rounded-[var(--theme-radius-inner)] text-xs sm:text-sm transition-colors cursor-pointer shadow-md active:scale-95"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Form & Order Summary */
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
            {error && (
              <div className="p-3 text-xs text-red-700 bg-red-50 rounded-[var(--theme-radius-inner)] border border-red-200 flex items-center gap-2">
                <span>{error}</span>
              </div>
            )}

            {/* Order Review with Thumbnails */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-subtle)] font-mono">
                <span>
                  Order Summary ({(items || []).reduce((s, i) => s + (i.quantity || 1), 0)} items)
                </span>
                <span className="text-[var(--theme-text-muted)] font-normal">Cash on Delivery</span>
              </div>

              <div className="bg-[var(--theme-surface-subtle)] rounded-[var(--theme-radius-inner)] p-3 border border-[var(--theme-border)] max-h-36 overflow-y-auto divide-y divide-[var(--theme-border)]">
                {!items || items.length === 0 ? (
                  <p className="text-xs text-[var(--theme-text-muted)] py-3 text-center">Your bag is empty.</p>
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
                            className="w-10 h-10 aspect-square rounded-[calc(var(--theme-radius-inner)-2px)] object-cover bg-[var(--theme-surface)] shrink-0 border border-[var(--theme-border)]"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--theme-text)] text-xs truncate">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-[var(--theme-text-muted)] font-mono">
                              {effectiveCurrency} {item.price.toLocaleString()} ×{' '}
                              {item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-xs text-[var(--theme-text)] tabular-nums shrink-0 font-mono">
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
                <label className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[var(--theme-text-subtle)]" />
                    Full Name <span className="text-red-500">*</span>
                  </span>
                  {touchedFields.name && !name.trim() && (
                    <span className="text-[11px] text-red-500 font-mono">Required</span>
                  )}
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  className={`w-full bg-[var(--theme-surface)] border rounded-[var(--theme-radius-inner)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] transition-colors ${
                    touchedFields.name && !name.trim() ? 'border-red-400' : 'border-[var(--theme-border)]'
                  }`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouchedFields((prev) => ({ ...prev, name: true }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[var(--theme-text-subtle)]" />
                    Phone Number <span className="text-red-500">*</span>
                  </span>
                  {touchedFields.phone && (!phone.trim() || phone.replace(/[^0-9]/g, '').length < 7) && (
                    <span className="text-[11px] text-red-500 font-mono">Valid phone required</span>
                  )}
                </label>
                <input
                  required
                  type="tel"
                  placeholder="e.g. +1 555 123 4567 or 0300 1234567"
                  className={`w-full bg-[var(--theme-surface)] border rounded-[var(--theme-radius-inner)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] transition-colors ${
                    touchedFields.phone && (!phone.trim() || phone.replace(/[^0-9]/g, '').length < 7)
                      ? 'border-red-400'
                      : 'border-[var(--theme-border)]'
                  }`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setTouchedFields((prev) => ({ ...prev, phone: true }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[var(--theme-text-subtle)]" />
                    Complete Delivery Address <span className="text-red-500">*</span>
                  </span>
                  {touchedFields.address && (!address.trim() || address.trim().length < 5) && (
                    <span className="text-[11px] text-red-500 font-mono">Address required</span>
                  )}
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="House/Apartment #, Street, Area / Sector, City"
                  className={`w-full bg-[var(--theme-surface)] border rounded-[var(--theme-radius-inner)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] transition-colors resize-none ${
                    touchedFields.address && (!address.trim() || address.trim().length < 5)
                      ? 'border-red-400'
                      : 'border-[var(--theme-border)]'
                  }`}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onBlur={() => setTouchedFields((prev) => ({ ...prev, address: true }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--theme-text-muted)] mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--theme-text-subtle)]" />
                  Delivery Notes{' '}
                  <span className="text-[var(--theme-text-subtle)] text-[11px] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Leave package with front desk or call upon arrival"
                  className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-[var(--theme-radius-inner)] px-3.5 py-2 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] transition-colors"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Delivery Badge */}
            <div className="bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] rounded-[var(--theme-radius-inner)] p-3 flex items-center justify-between text-xs text-[var(--theme-text)]">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
                <span>Standard Doorstep Delivery</span>
              </div>
              <span className="font-semibold text-[var(--theme-primary)]">Free</span>
            </div>

            {/* Footer Summary & Action */}
            <div className="pt-2 border-t border-[var(--theme-border)] space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs sm:text-sm font-medium text-[var(--theme-text-muted)]">Total Due on Arrival:</span>
                <span className="text-lg sm:text-xl font-bold text-[var(--theme-text)] tabular-nums font-mono">
                  {effectiveCurrency} {total.toLocaleString()}
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || !items || items.length === 0}
                className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-[var(--theme-on-primary)] font-semibold py-3.5 px-4 rounded-[var(--theme-radius-inner)] flex items-center justify-between shadow-lg transition-all text-xs sm:text-sm group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 sm:w-5 h-4 sm:h-5 text-[var(--theme-on-primary)]" />
                  <span>
                    {loading ? 'Submitting Order...' : 'Confirm & Place Order'}
                  </span>
                </div>
                {loading ? (
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="bg-[var(--theme-on-primary-border)] text-[var(--theme-on-primary)] px-2.5 py-0.5 rounded-[var(--theme-radius-inner)] text-xs font-medium tabular-nums font-mono">
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

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default CheckoutModal;
