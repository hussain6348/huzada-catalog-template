import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { CatalogEngine } from '../components/CatalogEngine';
import { HeaderBagButton } from '../components/HeaderBagButton';
import { clientConfig } from '../config/client';
import { getStoredBusinessInfo, fetchBusinessInfo, BUSINESS_INFO_UPDATED_EVENT } from '../lib/businessInfo';
import type { BusinessInfo, Product } from '../lib/types';

export function Catalog() {
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => getStoredBusinessInfo());
  const [lightboxProduct, setLightboxProduct] = useState<{
    name: string;
    category?: string;
    price: number;
    images: string[];
    index: number;
  } | null>(null);

  useEffect(() => {
    fetchBusinessInfo().then((info) => {
      if (info) setBusinessInfo(info);
    });

    const handleUpdate = (e: any) => {
      if (e?.detail) setBusinessInfo(e.detail);
    };
    window.addEventListener(BUSINESS_INFO_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(BUSINESS_INFO_UPDATED_EVENT, handleUpdate);
  }, []);

  // Listen for custom open lightbox events from cards
  useEffect(() => {
    const handleOpenLightbox = (e: any) => {
      const { product, index } = e.detail || {};
      if (product) {
        const fallbackImgs = (product.image ? [product.image] : [product.image_path]).filter((img: any): img is string => typeof img === 'string' && Boolean(img));
        const imgs = Array.isArray(product.images) && product.images.length > 0
          ? product.images
          : fallbackImgs;
        setLightboxProduct({
          name: product.name,
          category: product.category,
          price: product.price,
          images: imgs.length > 0 ? imgs : [],
          index: index || 0,
        });
      }
    };

    window.addEventListener('huzada_open_lightbox', handleOpenLightbox);
    return () => window.removeEventListener('huzada_open_lightbox', handleOpenLightbox);
  }, []);

  // Lock background body scroll while lightbox is active
  useEffect(() => {
    if (!lightboxProduct || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [lightboxProduct]);

  // Lightbox keyboard navigation (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!lightboxProduct) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxProduct(null);
      } else if (e.key === 'ArrowLeft' && lightboxProduct.images.length > 1) {
        setLightboxProduct((prev) =>
          prev
            ? {
                ...prev,
                index: prev.index === 0 ? prev.images.length - 1 : prev.index - 1,
              }
            : null
        );
      } else if (e.key === 'ArrowRight' && lightboxProduct.images.length > 1) {
        setLightboxProduct((prev) =>
          prev
            ? {
                ...prev,
                index: prev.index === prev.images.length - 1 ? 0 : prev.index + 1,
              }
            : null
        );
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [lightboxProduct]);

  const effectiveCurrency = businessInfo?.currencySymbol || clientConfig.currencySymbol || 'Rs.';

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] font-sans text-[var(--theme-text)] flex flex-col">
      {/* Top Storefront Header */}
      <header className="sticky top-0 z-40 bg-[var(--theme-surface-translucent)] backdrop-blur-md border-b border-[var(--theme-border)] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Link
              to="/"
              className="p-2 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer shrink-0"
              title="Return to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0 truncate">
              <Link to="/" className="font-bold text-sm sm:text-base md:text-lg tracking-tight text-[var(--theme-text)] flex items-center gap-1.5 sm:gap-2 hover:opacity-85 transition-opacity truncate">
                <span className="truncate">{businessInfo?.name || clientConfig.businessName}</span>
                <span className="text-[10px] sm:text-[11px] font-mono font-medium px-1.5 sm:px-2 py-0.5 rounded-full bg-[var(--theme-surface-subtle)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] shrink-0 hidden xs:inline-block">
                  Store
                </span>
              </Link>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2 sm:gap-3 text-xs font-semibold shrink-0">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 border border-[var(--theme-border)] hover:border-[var(--theme-border-strong)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-subtle)] px-2.5 sm:px-3 py-1.5 rounded-[var(--theme-radius-inner)] text-[var(--theme-text)] transition-colors shadow-2xs cursor-pointer font-medium"
            >
              <span className="hidden sm:inline">Storefront </span>Home
            </Link>
            <HeaderBagButton />
          </nav>
        </div>
      </header>

      {/* Main Catalog View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Collection Banner */}
        <div className="relative overflow-hidden rounded-[var(--theme-radius)] bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] p-6 sm:p-8 shadow-xs">
          <div className="relative z-10 max-w-3xl space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-xs"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--theme-spice) 12%, var(--theme-surface-translucent))',
                  color: 'var(--theme-spice)',
                  borderColor: 'color-mix(in srgb, var(--theme-spice) 30%, transparent)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Complete Collection</span>
              </div>
              <div className="text-[11px] font-mono text-[var(--theme-text-subtle)]">
                <Link to="/" className="hover:text-[var(--theme-text)] transition-colors">Home</Link>
                <span className="mx-1.5 opacity-50">/</span>
                <span className="text-[var(--theme-text)] font-medium">Category Catalog</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--theme-text)] font-editorial">
              {businessInfo?.name || clientConfig.businessName} Catalog
            </h1>
            <p className="text-xs sm:text-sm text-[var(--theme-text-muted)] leading-relaxed max-w-2xl">
              {businessInfo?.tagline || clientConfig.tagline || 'Explore curated products and place your order directly with fast doorstep delivery.'}
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-[var(--theme-primary)] opacity-5 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* All Products Catalog Engine: Category Tab Sidebar + Paginated Right Pane (16 items/page) */}
        <CatalogEngine
          currencySymbol={effectiveCurrency}
          layoutMode="all-products"
          pageSize={16}
          onOpenLightbox={(prod, idx) => {
            const fallbackImgs = (prod.image ? [prod.image] : [prod.image_path]).filter((img: any): img is string => typeof img === 'string' && Boolean(img));
            const imgs = Array.isArray(prod.images) && prod.images.length > 0
              ? prod.images
              : fallbackImgs;
            setLightboxProduct({
              name: prod.name,
              category: prod.category,
              price: prod.price,
              images: imgs.length > 0 ? imgs : [],
              index: idx || 0,
            });
          }}
        />
      </main>

      {/* Fullscreen Lightbox Overlay (Portaled to document.body) */}
      {lightboxProduct && lightboxProduct.images.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
          onClick={() => setLightboxProduct(null)}
        >
          <div
            className="w-full max-w-6xl flex items-center justify-between text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                {lightboxProduct.name}
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {lightboxProduct.category} · {effectiveCurrency} {lightboxProduct.price.toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLightboxProduct(null)}
              className="w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="relative flex-1 w-full max-w-6xl flex items-center justify-center my-2"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxProduct.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxProduct((prev) =>
                    prev
                      ? {
                          ...prev,
                          index: prev.index === 0 ? prev.images.length - 1 : prev.index - 1,
                        }
                      : null
                  );
                }}
                className="absolute left-2 sm:left-4 z-20 w-11 h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center transition-[transform,background-color] cursor-pointer shadow-xl hover:scale-105"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="relative max-h-[72vh] max-w-full flex items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/80 bg-black/40 shadow-2xl">
              <img
                src={lightboxProduct.images[lightboxProduct.index] || lightboxProduct.images[0]}
                alt={lightboxProduct.name}
                className="max-h-[72vh] max-w-[85vw] sm:max-w-4xl object-contain rounded-xl select-none"
              />
            </div>

            {lightboxProduct.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxProduct((prev) =>
                    prev
                      ? {
                          ...prev,
                          index:
                            prev.index === prev.images.length - 1 ? 0 : prev.index + 1,
                        }
                      : null
                  );
                }}
                className="absolute right-2 sm:right-4 z-20 w-11 h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center transition-[transform,background-color] cursor-pointer shadow-xl hover:scale-105"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          <div
            className="w-full max-w-6xl flex flex-col items-center gap-2.5 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxProduct.images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto max-w-md py-1 px-2 no-scrollbar">
                {lightboxProduct.images.map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    type="button"
                    onClick={() =>
                      setLightboxProduct((prev) => (prev ? { ...prev, index: i } : null))
                    }
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-[transform,opacity,border-color] cursor-pointer shrink-0 ${
                      i === lightboxProduct.index
                        ? 'border-white scale-105 ring-2 ring-white/30'
                        : 'border-zinc-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="bg-zinc-900/90 border border-white/10 px-3.5 py-1 rounded-full text-xs font-mono text-zinc-300">
              {lightboxProduct.index + 1} / {lightboxProduct.images.length}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Footer */}
      <footer className="bg-[var(--theme-surface)] border-t border-[var(--theme-border)] py-6 mt-12 text-center text-xs text-[var(--theme-text-muted)]">
        <p>© {new Date().getFullYear()} {businessInfo?.name || clientConfig.businessName}. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Catalog;
