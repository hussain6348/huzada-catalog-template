import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '../lib/types';
import {
  X,
  Plus,
  Minus,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Package,
} from 'lucide-react';
import { clientConfig } from '../config/client';
import { getProductPrimaryImage, resolveImageUrl, handleImageError } from '../lib/products';

export interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  currencySymbol?: string;
  onClose: () => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
  onOpenLightbox?: (product: Product, index?: number) => void;
}

export function ProductModal({
  product,
  isOpen,
  currencySymbol,
  onClose,
  onAddToCart,
  onOpenLightbox,
}: ProductModalProps) {
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  // Reset image index and quantity whenever a new product is opened
  useEffect(() => {
    if (product) {
      setSelectedImgIdx(0);
      setQuantity(1);
      setIsAdded(false);
    }
  }, [product?.id]);

  // Lock background body scroll while modal is active
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Keyboard navigation: Escape closes, Left/Right browses gallery
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const primaryImg = getProductPrimaryImage(product);
  const rawImages =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images.filter(Boolean).map((img) => resolveImageUrl(img))
      : [primaryImg];
  const images = rawImages.length > 0 ? rawImages : [primaryImg];

  const currentImg = images[selectedImgIdx] || primaryImg;
  const effectiveCurrency = currencySymbol || clientConfig.currencySymbol || 'Rs.';
  const totalPrice = (product.price || 0) * quantity;

  const handlePrevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImgIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImgIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleAddToCart = () => {
    if (!onAddToCart) return;
    setIsAdded(true);
    onAddToCart(product, quantity);
    setTimeout(() => {
      setIsAdded(false);
      onClose();
    }, 450);
  };

  const handleExpandPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenLightbox) {
      onOpenLightbox(product, selectedImgIdx);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('huzada_open_lightbox', {
          detail: { product, index: selectedImgIdx },
        })
      );
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans animate-in fade-in duration-200">
      {/* Elevated Glassmorphic Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
      />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
        {/* Modal Container with 3D Pop-in */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 text-[var(--theme-text)] animate-in zoom-in-95 duration-200 ease-out my-auto max-h-[92vh] flex flex-col"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer z-20"
            aria-label="Close product details"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="overflow-y-auto space-y-4 pr-0.5">
            {/* Interactive Image Stage */}
            <div className="space-y-2">
              <div
                onClick={handleExpandPhoto}
                className="group relative aspect-[4/3] rounded-[var(--theme-radius-inner)] overflow-hidden bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] shadow-inner cursor-pointer"
                title="Click to view full-screen gallery"
              >
                <img
                  src={currentImg}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={handleImageError}
                />

                {/* Badge */}
                {product.badge && (
                  <span
                    className="absolute top-3 left-3 backdrop-blur-md text-[11px] font-bold px-2.5 py-0.5 rounded-[var(--theme-radius-inner)] border shadow-xs z-10 shrink-0 max-w-fit truncate flex items-center gap-1.5"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--theme-spice) 14%, var(--theme-surface-translucent))',
                      borderColor: 'color-mix(in srgb, var(--theme-spice) 35%, transparent)',
                      color: 'var(--theme-spice)',
                      boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-spice) 18%, transparent)',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: 'var(--theme-spice)' }}
                    />
                    <span className="truncate">{product.badge}</span>
                  </span>
                )}

                {/* Expand Pill */}
                <div className="absolute top-3 right-12 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="bg-[var(--theme-surface-translucent)] backdrop-blur-md text-[var(--theme-text)] text-[10px] font-mono px-2 py-0.5 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] flex items-center gap-1 shadow-xs">
                    <Maximize2 className="w-3 h-3" />
                    <span>Zoom</span>
                  </span>
                </div>

                {/* Carousel Controls (when multiple photos exist) */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevImg}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--theme-surface-translucent)] hover:bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] shadow-md flex items-center justify-center transition-all cursor-pointer z-10 hover:scale-105 active:scale-95"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextImg}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--theme-surface-translucent)] hover:bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] shadow-md flex items-center justify-center transition-all cursor-pointer z-10 hover:scale-105 active:scale-95"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails Row (when multiple photos exist) */}
              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
                  {images.map((img, idx) => (
                    <button
                      key={`${img}-${idx}`}
                      type="button"
                      onClick={() => setSelectedImgIdx(idx)}
                      className={`w-12 h-12 rounded-[calc(var(--theme-radius-inner)-2px)] overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                        selectedImgIdx === idx
                          ? 'border-[var(--theme-primary)] scale-105 shadow-xs'
                          : 'border-[var(--theme-border)] opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <span className="text-[10px] font-mono text-[var(--theme-text-subtle)] ml-auto pr-1">
                    {selectedImgIdx + 1} of {images.length}
                  </span>
                </div>
              )}
            </div>

            {/* Product Meta & Description */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase text-[var(--theme-text-subtle)] tracking-wider">
                  {product.category || 'General'}
                </span>
                <span className="text-[var(--theme-border-strong)]">·</span>
                <span className="text-[11px] font-mono text-[var(--theme-primary)] flex items-center gap-1 font-medium">
                  <Package className="w-3 h-3" />
                  <span>In Stock</span>
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--theme-text)] font-editorial tracking-tight">
                {product.name}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--theme-text-muted)] leading-relaxed pt-1">
                {product.description || 'Quality product tailored to your standards with prompt fulfillment.'}
              </p>
            </div>
          </div>

          {/* Pricing, Quantity Stepper & Add to Bag Footer */}
          <div className="pt-3 border-t border-[var(--theme-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div>
              <span className="text-[10px] text-[var(--theme-text-subtle)] block uppercase font-mono tracking-wider">
                Unit Price
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-bold text-[var(--theme-text)] tabular-nums font-mono">
                  {effectiveCurrency} {product.price.toLocaleString()}
                </span>
                {quantity > 1 && (
                  <span className="text-xs font-mono text-[var(--theme-text-muted)]">
                    (Total: {effectiveCurrency} {totalPrice.toLocaleString()})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Quantity Stepper */}
              <div className="flex items-center gap-1 bg-[var(--theme-surface-subtle)] p-1 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] shadow-xs">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-7 h-7 rounded-[calc(var(--theme-radius-inner)-2px)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-subtle)] text-[var(--theme-text)] border border-[var(--theme-border)] flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-90"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-7 text-center text-xs font-semibold font-mono tabular-nums text-[var(--theme-text)]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  className="w-7 h-7 rounded-[calc(var(--theme-radius-inner)-2px)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-subtle)] text-[var(--theme-text)] border border-[var(--theme-border)] flex items-center justify-center transition-all cursor-pointer active:scale-90"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Add to Bag Action */}
              {onAddToCart && (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isAdded}
                  className="flex-1 sm:flex-initial bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold px-5 py-2.5 rounded-[var(--theme-radius-inner)] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95 disabled:opacity-90"
                >
                  {isAdded ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Added to Bag!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add to Bag</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default ProductModal;
