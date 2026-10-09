import React from 'react';
import type { Product } from '../lib/types';
import { X, Plus } from 'lucide-react';

const CURRENCY_SYMBOL = 'Rs.';

export interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: Product) => void;
}

export function ProductModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ProductModalProps) {
  if (!isOpen || !product) return null;

  const imgSrc =
    product.images?.[0] ||
    product.image ||
    product.image_path ||
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-zinc-900/60 backdrop-blur-xs transition-opacity"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden p-6 space-y-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="aspect-4/3 rounded-xl overflow-hidden bg-zinc-100 border border-neutral-200">
            <img
              src={imgSrc}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={() => {
                console.error('Modal image load failed for:', imgSrc);
              }}
            />
          </div>

          <div>
            <span className="text-[11px] font-mono uppercase text-zinc-400 tracking-wider">
              {product.category}
            </span>
            <h3 className="text-lg font-bold text-zinc-900 mt-1">
              {product.name}
            </h3>
            <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
              {product.description}
            </p>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-400 block uppercase font-mono">Price</span>
              <span className="text-lg font-bold text-zinc-900 tabular-nums">
                {CURRENCY_SYMBOL} {product.price.toLocaleString()}
              </span>
            </div>

            {onAddToCart && (
              <button
                onClick={() => {
                  onAddToCart(product);
                  onClose();
                }}
                className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-2"
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
