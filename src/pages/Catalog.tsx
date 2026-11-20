import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Layers,
  ShieldCheck,
  Package,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { CatalogEngine } from '../components/CatalogEngine';
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

  const effectiveCurrency = businessInfo?.currencySymbol || clientConfig.currencySymbol || 'Rs.';

  return (
    <div className="min-h-screen bg-zinc-50/70 font-sans text-zinc-900 flex flex-col">
      {/* Top Storefront Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              title="Return to Booking Portal"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <Link to="/" className="font-bold text-base sm:text-lg tracking-tight text-zinc-900 flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span>{businessInfo?.name || clientConfig.businessName}</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                  Store
                </span>
              </Link>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2 sm:gap-3 text-xs font-semibold">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Appointment</span>
            </Link>
            <Link
              to="/services"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Services</span>
            </Link>
            <Link
              to="/admin"
              className="border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 px-3 py-1.5 rounded-lg text-zinc-700 transition-colors"
            >
              Operations
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Catalog View */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900 text-white p-6 sm:p-10 shadow-lg">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-emerald-400 backdrop-blur-xs border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Storefront & Product Catalog</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {businessInfo?.name || clientConfig.businessName} Collection
            </h1>
            <p className="text-sm text-zinc-300 leading-relaxed max-w-lg">
              {businessInfo?.tagline || clientConfig.tagline || 'Explore curated products and place your order directly with fast doorstep delivery.'}
            </p>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Catalog Engine */}
        <CatalogEngine
          currencySymbol={effectiveCurrency}
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

      {/* Fullscreen Lightbox Overlay */}
      {lightboxProduct && lightboxProduct.images.length > 0 && (
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
                className="absolute left-2 sm:left-4 z-20 w-11 h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl hover:scale-105"
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
                className="absolute right-2 sm:right-4 z-20 w-11 h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl hover:scale-105"
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
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
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
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200 py-6 mt-12 text-center text-xs text-zinc-500">
        <p>© {new Date().getFullYear()} {businessInfo?.name || clientConfig.businessName}. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Catalog;
