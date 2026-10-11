import React, { useState } from 'react';
import type { Product, CartItem } from '../lib/types';
import { Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';

const CURRENCY_SYMBOL = 'Rs.';

export interface ProductCardProps {
  product: Product;
  inCart?: CartItem;
  onAddToCart: () => void;
  onUpdateQuantity: (delta: number) => void;
  onSelect?: () => void;
}

export function ProductCard({
  product,
  inCart,
  onAddToCart,
  onUpdateQuantity,
  onSelect,
}: ProductCardProps) {
  const defaultPlaceholder = "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80";
  const primaryImg = product.images?.[0] || product.image || product.image_path || defaultPlaceholder;
  const images = (Array.isArray(product.images) && product.images.length > 0)
    ? product.images.filter(Boolean)
    : [primaryImg];

  const [activeImgIdx, setActiveImgIdx] = useState(0);

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImgIdx(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImgIdx(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const currentImg = images[activeImgIdx] || primaryImg;

  return (
    <div
      onClick={onSelect}
      className="group bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col hover:border-zinc-300 transition-all shadow-2xs hover:shadow-sm"
    >
      {/* Product Image with Hover Zoom & Carousel */}
      <div className="relative aspect-4/3 overflow-hidden bg-zinc-100">
        <img
          src={currentImg}
          alt={product.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          onError={() => {
            console.error('Product image load failed for URL:', currentImg);
          }}
        />

        {product.badge && (
          <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-zinc-900 text-[11px] font-semibold px-2 py-0.5 rounded shadow-xs z-10">
            {product.badge}
          </span>
        )}

        <span className="absolute bottom-3 right-3 bg-zinc-900/80 backdrop-blur-xs text-white text-[11px] font-mono px-2 py-0.5 rounded z-10">
          {product.category}
        </span>

        {/* Multi-Image Controls & Indicators */}
        {images.length > 1 && (
          <>
            <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded z-10">
              {activeImgIdx + 1}/{images.length}
            </span>

            <button
              onClick={prevImage}
              aria-label="Previous image"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 hover:bg-white text-zinc-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-10"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={nextImage}
              aria-label="Next image"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 hover:bg-white text-zinc-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-10"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 bg-black/40 backdrop-blur-xs px-2 py-1 rounded-full">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImgIdx(i);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    activeImgIdx === i ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`View photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h3 className="font-semibold text-sm text-zinc-900 group-hover:text-zinc-700 transition-colors">
            {product.name}
          </h3>
          <p className="text-xs text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400 block uppercase font-mono">Price</span>
            <span className="text-sm font-bold text-zinc-900 tabular-nums">
              {CURRENCY_SYMBOL} {product.price.toLocaleString()}
            </span>
          </div>

          {inCart ? (
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateQuantity(-1); }}
                className="w-6 h-6 rounded bg-white hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-semibold font-mono tabular-nums px-1.5">
                {inCart.quantity}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateQuantity(1); }}
                className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
              className="bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-800 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Bag</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
