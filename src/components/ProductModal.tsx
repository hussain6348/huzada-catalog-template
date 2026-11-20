import React from 'react';
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
  if (!isOpen || !product) return null;

  const imgSrc = getProductPrimaryImage(product);
  const effectiveCurrency = currencySymbol || clientConfig.currencySymbol || 'Rs.';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] shadow-2xl overflow-hidden p-6 space-y-4 text-[var(--theme-text)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="aspect-[4/3] rounded-[var(--theme-radius-inner)] overflow-hidden bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)]">
            <img
              src={imgSrc}
              alt={product.name}
              referrerPolicy="no-referrer"
              loading="lazy"
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
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
                className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold px-4 py-2.5 rounded-[var(--theme-radius-inner)] transition-colors cursor-pointer flex items-center gap-2 shadow-sm active:scale-95"
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
