import React from 'react';
import { Plus, Minus, Check } from 'lucide-react';
import type { Product, CartItem } from '../lib/types';
import { clientConfig } from '../config/client';
import { getProductPrimaryImage, handleImageError } from '../lib/products';

export interface ProductCardProps {
  product: Product;
  inCart?: CartItem;
  onAddToCart: () => void;
  onUpdateQuantity: (delta: number) => void;
  onSelect: () => void;
}

export function ProductCard({
  product,
  inCart,
  onAddToCart,
  onUpdateQuantity,
  onSelect,
}: ProductCardProps) {
  const imageUrl = getProductPrimaryImage(product);

  return (
    <div className="group bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between hover:border-zinc-300">
      {/* Top Image Container */}
      <div
        onClick={onSelect}
        className="relative aspect-4/3 overflow-hidden bg-zinc-100 cursor-pointer"
      >
        <img
          src={imageUrl}
          alt={product.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={handleImageError}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Badge */}
        {product.badge && (
          <span className="absolute top-3 left-3 bg-zinc-900/90 backdrop-blur-xs text-white text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-md shadow-xs">
            {product.badge}
          </span>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
      </div>

      {/* Product Details */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase text-zinc-400 font-medium tracking-wide">
              {product.category || 'General'}
            </span>
            {product.stock !== undefined && product.stock <= 5 && (
              <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                Only {product.stock} left
              </span>
            )}
          </div>
          <h3
            onClick={onSelect}
            className="font-semibold text-sm text-zinc-900 line-clamp-1 hover:text-emerald-700 cursor-pointer transition-colors"
          >
            {product.name}
          </h3>
          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Price & Action Row */}
        <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-zinc-400 block font-mono uppercase">Price</span>
            <span className="text-sm font-bold text-zinc-900 font-mono tabular-nums">
              {clientConfig.currencySymbol} {product.price.toLocaleString()}
            </span>
          </div>

          {/* Cart Control */}
          {inCart && inCart.quantity > 0 ? (
            <div className="flex items-center gap-1.5 bg-zinc-900 text-white rounded-xl p-1 shadow-xs">
              <button
                type="button"
                onClick={() => onUpdateQuantity(-1)}
                className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs tabular-nums font-semibold px-1">
                {inCart.quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(1)}
                className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAddToCart}
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add to Bag</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
