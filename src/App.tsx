import React, { useState, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CatalogEngine } from './components/CatalogEngine';
import { Admin } from './pages/Admin';
import { AdminLogin } from './components/AdminLogin';
import { isAuthenticated, AUTH_CHANGE_EVENT } from './lib/auth';
import type { Product } from './lib/types';
import { clientConfig } from './config/client';
import { resolveImageUrl, getProductPrimaryImage } from './lib/products';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

function ProtectedAdminRoute() {
  const [authed, setAuthed] = useState(() => isAuthenticated());

  useEffect(() => {
    const handleAuthChange = () => {
      setAuthed(isAuthenticated());
    };
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
  }, []);

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return <Admin onLogout={() => setAuthed(false)} />;
}

export default function App() {
  const [lightboxItem, setLightboxItem] = useState<Product | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  // Global event listener for custom lightbox triggers
  useEffect(() => {
    const handleCustomOpen = (e: any) => {
      if (e.detail?.product) {
        setLightboxItem(e.detail.product);
        setCurrentImageIndex(e.detail.index || 0);
      }
    };
    window.addEventListener('huzada_open_lightbox', handleCustomOpen);
    return () => window.removeEventListener('huzada_open_lightbox', handleCustomOpen);
  }, []);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightboxItem) return;

    const images = getLightboxImages(lightboxItem);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxItem(null);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem]);

  const getLightboxImages = (prod: Product | null): string[] => {
    if (!prod) return [];
    const primary = getProductPrimaryImage(prod);
    const rawList =
      Array.isArray(prod.images) && prod.images.length > 0
        ? prod.images.filter(Boolean).map((img) => resolveImageUrl(img))
        : [primary];
    return rawList.length > 0 ? rawList : [primary];
  };

  const handleOpenLightbox = (product: Product, index: number = 0) => {
    setLightboxItem(product);
    setCurrentImageIndex(index);
  };

  const currentImages = lightboxItem ? getLightboxImages(lightboxItem) : [];

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <div className="min-h-screen bg-zinc-100/50 py-12 px-4 relative">
              <CatalogEngine onOpenLightbox={handleOpenLightbox} />
            </div>
          }
        />
        <Route path="/admin" element={<ProtectedAdminRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* High-Fidelity Interactive Lightbox Overlay */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
          onClick={() => setLightboxItem(null)}
        >
          {/* Top Bar */}
          <div
            className="w-full max-w-6xl flex items-center justify-between text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">
                  {lightboxItem.name}
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  {lightboxItem.category} · {clientConfig.currencySymbol}{' '}
                  {lightboxItem.price.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setLightboxItem(null)}
              className="w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close gallery (Esc)"
              aria-label="Close lightbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Centered Image Stage */}
          <div
            className="relative flex-1 w-full max-w-6xl flex items-center justify-center my-2 sm:my-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Navigation Arrow */}
            {currentImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev === 0 ? currentImages.length - 1 : prev - 1
                  );
                }}
                className="absolute left-2 sm:left-4 z-20 w-11 h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl hover:scale-105"
                title="Previous photo (Left Arrow)"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Scaled Active Image */}
            <div className="relative max-h-[72vh] max-w-full flex items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/80 bg-black/40 shadow-2xl">
              <img
                src={currentImages[currentImageIndex] || currentImages[0]}
                alt={`${lightboxItem.name} photo ${currentImageIndex + 1}`}
                className="max-h-[72vh] max-w-[85vw] sm:max-w-4xl object-contain rounded-xl select-none"
              />
            </div>

            {/* Right Navigation Arrow */}
            {currentImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev === currentImages.length - 1 ? 0 : prev + 1
                  );
                }}
                className="absolute right-2 sm:right-4 z-20 w-11 h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl hover:scale-105"
                title="Next photo (Right Arrow)"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Bar: Thumbnails & Subtle Counter */}
          <div
            className="w-full max-w-6xl flex flex-col items-center gap-2.5 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {currentImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto max-w-md py-1 px-2 no-scrollbar">
                {currentImages.map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    type="button"
                    onClick={() => setCurrentImageIndex(i)}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                      i === currentImageIndex
                        ? 'border-white scale-105 ring-2 ring-white/30'
                        : 'border-zinc-800 opacity-60 hover:opacity-100'
                    }`}
                    aria-label={`Go to photo ${i + 1}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="bg-zinc-900/90 border border-white/10 px-3.5 py-1 rounded-full text-xs font-mono text-zinc-300">
              {currentImageIndex + 1} / {currentImages.length || 1}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
