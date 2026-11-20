import React, { useEffect } from 'react';
import type { Product } from '../lib/types';
import { X, Plus } from 'lucide-react';
import { clientConfig } from '../config/client';
import { getProductPrimaryImage, handleImageError } from '../lib/products';

export interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  currencySymbol?: string;
  onClose: () => void;
  onAddToCart?: (product: Product) => void;
}

export function ProductModal({
  product,
  isOpen,
  currencySymbol,
  onClose,
  onAddToCart,
}: ProductModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const imgSrc = getProductPrimaryImage(product);
  const effectiveCurrency = currencySymbol || clientConfig.currencySymbol || 'Rs.';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans animate-in fade-in duration-200">
      {/* Elevated Glassmorphic Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Modal Container with 3D Pop-in */}
        <div className="relative w-full max-w-lg bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] shadow-2xl overflow-hidden p-6 space-y-4 text-[var(--theme-text)] animate-in zoom-in-95 duration-200 ease-out">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer z-10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="aspect-[4/3] rounded-[var(--theme-radius-inner)] overflow-hidden bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] relative shadow-inner">
            <img
              src={imgSrc}
              alt={product.name}
              referrerPolicy="no-referrer"
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              onError={handleImageError}
            />
            {product.badge && (
              <span className="absolute top-3 left-3 bg-[var(--theme-surface-translucent)] backdrop-blur-md text-[var(--theme-text)] text-[11px] font-semibold px-2.5 py-0.5 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] shadow-xs">
                {product.badge}
              </span>
            )}
          </div>

          <div>
            <span className="text-[11px] font-mono uppercase text-[var(--theme-text-subtle)] tracking-wider">
              {product.category || 'General'}
            </span>
            <h3 className="text-xl font-bold text-[var(--theme-text)] mt-1 font-editorial">
              {product.name}
            </h3>
            <p className="text-sm text-[var(--theme-text-muted)] mt-2 leading-relaxed">
              {product.description || 'Quality product tailored to your standards.'}
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--theme-border)] flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--theme-text-subtle)] block uppercase font-mono tracking-wider">Price</span>
              <span className="text-xl font-bold text-[var(--theme-text)] tabular-nums font-mono">
                {effectiveCurrency} {product.price.toLocaleString()}
              </span>
            </div>

            {onAddToCart && (
              <button
                type="button"
                onClick={() => {
                  onAddToCart(product);
                  onClose();
                }}
                className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold px-5 py-2.5 rounded-[var(--theme-radius-inner)] transition-all cursor-pointer flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Bag</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductModal;
