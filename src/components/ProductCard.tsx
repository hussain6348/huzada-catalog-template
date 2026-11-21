import React, { useState } from 'react';
import type { Product, CartItem } from '../lib/types';
import { Plus, Minus, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { clientConfig } from '../config/client';
import { getProductPrimaryImage, resolveImageUrl, handleImageError } from '../lib/products';

export interface ProductCardProps {
  product: Product;
  inCart?: CartItem;
  currencySymbol?: string;
  onAddToCart: () => void;
  onUpdateQuantity: (delta: number) => void;
  onSelect?: () => void;
  onOpenLightbox?: (product: Product, index?: number) => void;
}

export function ProductCard({
  product,
  inCart,
  currencySymbol,
  onAddToCart,
  onUpdateQuantity,
  onSelect,
  onOpenLightbox,
}: ProductCardProps) {
  const primaryImg = getProductPrimaryImage(product);
  const rawImages =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images.filter(Boolean).map((img) => resolveImageUrl(img))
      : [primaryImg];
  const images = rawImages.length > 0 ? rawImages : [primaryImg];

  const [activeImgIdx, setActiveImgIdx] = useState(0);

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImgIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImgIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleThumbnailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenLightbox) {
      onOpenLightbox(product, activeImgIdx);
    } else {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('huzada_open_lightbox', {
            detail: { product, index: activeImgIdx },
          })
        );
      }
    }
  };

  // ─── Apple TV 3D Kinetic Tilt Physics ───────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined') return;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canHover || prefersReducedMotion) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    e.currentTarget.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    e.currentTarget.style.setProperty('--mouse-x', `-500px`);
    e.currentTarget.style.setProperty('--mouse-y', `-500px`);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches || e.touches.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--mouse-x', `-500px`);
    e.currentTarget.style.setProperty('--mouse-y', `-500px`);
  };

  const currentImg = images[activeImgIdx] || primaryImg;
  const effectiveCurrency = currencySymbol || clientConfig.currencySymbol || 'Rs.';

  return (
    <div
      onClick={onSelect}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="group bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] overflow-hidden flex flex-col h-full hover:border-[var(--theme-primary)] transition-all duration-200 ease-out shadow-xs hover:shadow-xl hover:shadow-[color-mix(in_srgb,var(--theme-primary)_12%,transparent)] cursor-pointer text-[var(--theme-text)] spotlight-card card-3d relative select-none"
    >
      {/* Product Image with Hover Zoom & Carousel - Click to open Lightbox */}
      <div
        onClick={handleThumbnailClick}
        className="relative aspect-[4/3] overflow-hidden bg-[var(--theme-surface-subtle)] cursor-pointer"
        title="Click to view full-screen photo gallery"
      >
        <img
          src={currentImg}
          alt={product.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-500 ease-out"
          onError={handleImageError}
        />

        {product.badge && (
          <span className="card-3d-leaf absolute top-3 left-3 bg-[var(--theme-surface-translucent)] backdrop-blur-md text-[var(--theme-text)] text-[11px] font-semibold px-2.5 py-0.5 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] shadow-xs z-10">
            {product.badge}
          </span>
        )}

        <span className="card-3d-leaf absolute bottom-3 right-3 bg-[var(--theme-surface-translucent)] backdrop-blur-md text-[var(--theme-text-muted)] text-[11px] font-mono px-2 py-0.5 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] z-10 shadow-xs">
          {product.category || 'General'}
        </span>

        {/* View gallery hover affordance */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center pointer-events-none">
          <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 bg-[var(--theme-primary)] text-[var(--theme-on-primary)] text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5 shadow-md">
            <Maximize2 className="w-3 h-3" />
            <span>View Gallery</span>
          </span>
        </div>

        {/* Multi-Image Controls & Indicators */}
        {images.length > 1 && (
          <>
            <span className="card-3d-leaf absolute top-3 right-3 bg-[var(--theme-surface-translucent)] backdrop-blur-md text-[var(--theme-text)] border border-[var(--theme-border)] text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--theme-radius-inner)] z-10 shadow-xs">
              {activeImgIdx + 1}/{images.length}
            </span>

            <button
              type="button"
              onClick={prevImage}
              aria-label="Previous image"
              className="card-3d-leaf absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--theme-surface-translucent)] hover:bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] shadow-md opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer z-10 hover:scale-110 active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={nextImage}
              aria-label="Next image"
              className="card-3d-leaf absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--theme-surface-translucent)] hover:bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] shadow-md opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer z-10 hover:scale-110 active:scale-95"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div className="card-3d-leaf absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 bg-[var(--theme-surface-translucent)] backdrop-blur-md border border-[var(--theme-border)] px-2 py-1 rounded-full shadow-xs">
              {images.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImgIdx(i);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    activeImgIdx === i ? 'w-3.5 bg-[var(--theme-primary)]' : 'w-1.5 bg-[var(--theme-border-strong)] hover:bg-[var(--theme-text-muted)]'
                  }`}
                  aria-label={`View photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Card Content with 3D Leaf Depth */}
      <div className="card-3d-leaf p-4 sm:p-5 flex-1 flex flex-col justify-between bg-[var(--theme-surface)]">
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-[var(--theme-text)] group-hover:text-[var(--theme-primary)] transition-colors duration-200 line-clamp-1">
            {product.name}
          </h3>
          <p className="text-xs text-[var(--theme-text-muted)] line-clamp-2 mt-1.5 leading-relaxed min-h-[2.25rem]">
            {product.description || 'Quality product tailored to your standards.'}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--theme-border)] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] text-[var(--theme-text-subtle)] block uppercase font-mono tracking-wider">Price</span>
            <span className="text-sm sm:text-base font-bold text-[var(--theme-text)] tabular-nums font-mono truncate block">
              {effectiveCurrency} {product.price.toLocaleString()}
            </span>
          </div>

          <div className="shrink-0">
            {inCart ? (
              <div className="flex items-center gap-1.5 bg-[var(--theme-surface-subtle)] p-1 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] shadow-xs">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUpdateQuantity(-1); }}
                  className="w-6 h-6 rounded-[calc(var(--theme-radius-inner)-2px)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-subtle)] text-[var(--theme-text)] border border-[var(--theme-border)] flex items-center justify-center transition-all cursor-pointer active:scale-90"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-semibold font-mono tabular-nums px-1.5 text-[var(--theme-text)]">
                  {inCart.quantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUpdateQuantity(1); }}
                  className="w-6 h-6 rounded-[calc(var(--theme-radius-inner)-2px)] bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] flex items-center justify-center transition-all cursor-pointer active:scale-90"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
                className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold px-3.5 py-2 rounded-[var(--theme-radius-inner)] transition-all duration-150 cursor-pointer flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Bag</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
