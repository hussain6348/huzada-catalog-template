import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, Route, Routes, Link } from 'react-router-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { clientConfig } from './config/client';

import AITheme from './components/AITheme';

const Admin = React.lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Catalog = React.lazy(() => import('./pages/Catalog').then(m => ({ default: m.Catalog })));
const AdminLogin = React.lazy(() => import('./components/AdminLogin').then(m => ({ default: m.AdminLogin })));

import { isAuthenticated, AUTH_CHANGE_EVENT } from './lib/auth';
import { getStoredBusinessInfo, fetchBusinessInfo, DEFAULT_BUSINESS_INFO, BUSINESS_INFO_UPDATED_EVENT } from './lib/businessInfo';
import { fetchProductsPayload } from './lib/products';
import { parseJsonResponse } from './lib/safeJson';
import { fetchThemePayload } from './lib/themeCache';
import type { BusinessInfo, Service, Product } from './lib/types';

export const FALLBACK_SERVICES: Service[] = [];

export function determineSpiceColor(primaryColor?: string, bgColor?: string): string {
  const primary = (primaryColor || '').toLowerCase().trim();
  const bg = (bgColor || '').toLowerCase().trim();

  // 1. Exact preset: Neon Midnight (#10b981 emerald on #09090b obsidian)
  if (primary === '#10b981' || bg === '#09090b') {
    return '#a855f7'; // Neon Midnight: Electric Ultraviolet
  }

  // 2. Exact preset: Luxury Amber (#d97706 amber on #1c1917 espresso)
  if (primary === '#d97706' || bg === '#1c1917') {
    return '#f43f5e'; // Luxury Amber: Crimson Ruby
  }

  // 3. Exact preset: Ocean Light (#0ea5e9 sky blue on #ffffff / #f8fafc canvas)
  if (primary === '#0ea5e9' || bg === '#ffffff' || bg === '#f8fafc') {
    return '#ea580c'; // Ocean Light: Deep Coral Sunset
  }

  // 4. Perceptual hue check for custom themes:
  const hex = primary.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    if (g > r + 30 && g > b) return '#a855f7';
    if (b > r + 30 && b > g) return '#ea580c';
    if (r > b + 40 && g > b) return '#f43f5e';
  }

  return '#ea580c';
}

function applyThemeCss(themeData: any) {
  if (!themeData || typeof document === 'undefined') return;
  if (themeData.primaryColor) {
    document.documentElement.style.setProperty('--theme-primary', themeData.primaryColor);
    // Dynamic perceived luminance check to guarantee high-contrast button text
    const hex = String(themeData.primaryColor).replace('#', '').trim();
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) || 0;
      const g = parseInt(hex.slice(2, 4), 16) || 0;
      const b = parseInt(hex.slice(4, 6), 16) || 0;
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      document.documentElement.style.setProperty('--theme-on-primary', luminance > 0.65 ? '#0f172a' : '#ffffff');
    }
  }
  if (themeData.bgColor) document.documentElement.style.setProperty('--theme-bg', themeData.bgColor);
  if (themeData.textColor) document.documentElement.style.setProperty('--theme-text', themeData.textColor);

  // 4th Spice Accent synchronization (scoped to product badges)
  const spiceColor = themeData.spiceColor || determineSpiceColor(themeData.primaryColor, themeData.bgColor);
  document.documentElement.style.setProperty('--theme-spice', spiceColor);
  document.documentElement.style.setProperty('--theme-spice-soft', `color-mix(in srgb, ${spiceColor} 14%, transparent)`);
}

function PublicStorefrontPortal() {
  const [lightboxItem, setLightboxItem] = useState<any | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [products, setProducts] = useState<Product[]>([]);

  const [currencyCode, setCurrencyCode] = useState(() => {
    try {
      return localStorage.getItem('waas_store_currency') || 'USD';
    } catch {
      return 'USD';
    }
  });

  const [currencySymbol, setCurrencySymbol] = useState(() => {
    try {
      const code = localStorage.getItem('waas_store_currency') || 'USD';
      const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PKR: 'Rs.', AED: 'AED ', CAD: '$', AUD: '$' };
      return symbols[code] || '$';
    } catch {
      return '$';
    }
  });

  useEffect(() => {
    const updateCurrency = () => {
      try {
        const code = localStorage.getItem('waas_store_currency') || 'USD';
        const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PKR: 'Rs.', AED: 'AED ', CAD: '$', AUD: '$' };
        setCurrencyCode(code);
        setCurrencySymbol(symbols[code] || '$');
      } catch {
        setCurrencyCode('USD');
        setCurrencySymbol('$');
      }
    };
    updateCurrency();
    window.addEventListener('storage', updateCurrency);
    return () => window.removeEventListener('storage', updateCurrency);
  }, []);

  // 1. THE HYDRATION MANDATE: businessInfo initialized immediately from stored/initial data for zero-flicker frame-0 paint
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => {
    const initialBiz = getStoredBusinessInfo();
    return {
      ...DEFAULT_BUSINESS_INFO,
      ...initialBiz,
      promoText: initialBiz.promoText !== undefined ? initialBiz.promoText : DEFAULT_BUSINESS_INFO.promoText,
      imageSlots: {
        ...(DEFAULT_BUSINESS_INFO.imageSlots || {}),
        ...(initialBiz.imageSlots || {}),
      },
    };
  });

  // 4. THE GLOBAL BRIDGE: activeThemeId state for storefront synchronization
  const [activeThemeId, setActiveThemeId] = useState<string>('1');

  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PKR: 'Rs.', AED: 'AED ', CAD: '$', AUD: '$' };

  const formatBusinessInfo = (storedBiz: Partial<BusinessInfo>): BusinessInfo => {
    const effectiveCode = storedBiz.currency || DEFAULT_BUSINESS_INFO.currency || currencyCode || 'USD';
    const effectiveSym = storedBiz.currencySymbol || symbols[effectiveCode] || DEFAULT_BUSINESS_INFO.currencySymbol || currencySymbol || '$';

    return {
      ...DEFAULT_BUSINESS_INFO,
      ...storedBiz,
      name: storedBiz.name || DEFAULT_BUSINESS_INFO.name || clientConfig.businessName || 'Huzada Storefront',
      tagline: storedBiz.tagline || DEFAULT_BUSINESS_INFO.tagline || clientConfig.tagline || 'Curated Products & Premium Selection',
      whatsapp: storedBiz.whatsapp || DEFAULT_BUSINESS_INFO.whatsapp || clientConfig.whatsappNumber,
      phone: storedBiz.phone || DEFAULT_BUSINESS_INFO.phone || '',
      currency: effectiveCode,
      currencySymbol: effectiveSym,
      address: storedBiz.address || DEFAULT_BUSINESS_INFO.address || '',
      hours: storedBiz.hours || DEFAULT_BUSINESS_INFO.hours || '',
      rating: storedBiz.rating || DEFAULT_BUSINESS_INFO.rating || '',
      reviewCount: storedBiz.reviewCount || DEFAULT_BUSINESS_INFO.reviewCount || '',
      mapsUrl: storedBiz.mapsUrl || DEFAULT_BUSINESS_INFO.mapsUrl || '',
      promoText: storedBiz.promoText !== undefined ? storedBiz.promoText : DEFAULT_BUSINESS_INFO.promoText,
      logo: storedBiz.logo || storedBiz.imageSlots?.logo,
      imageSlots: {
        ...(DEFAULT_BUSINESS_INFO.imageSlots || {}),
        ...(storedBiz.imageSlots || {}),
      },
      heroHeadline: storedBiz.heroHeadline !== undefined && storedBiz.heroHeadline !== '' ? storedBiz.heroHeadline : DEFAULT_BUSINESS_INFO.heroHeadline,
      heroSubheadline: storedBiz.heroSubheadline !== undefined && storedBiz.heroSubheadline !== '' ? storedBiz.heroSubheadline : DEFAULT_BUSINESS_INFO.heroSubheadline,
      aboutDescription: storedBiz.aboutDescription !== undefined && storedBiz.aboutDescription !== '' ? storedBiz.aboutDescription : DEFAULT_BUSINESS_INFO.aboutDescription,
      ctaHeadline: storedBiz.ctaHeadline !== undefined && storedBiz.ctaHeadline !== '' ? storedBiz.ctaHeadline : DEFAULT_BUSINESS_INFO.ctaHeadline,
      heroImage: storedBiz.heroImage || storedBiz.imageSlots?.hero || '',
      heroImage2: storedBiz.heroImage2 || storedBiz.imageSlots?.hero2 || '',
      heroImage3: storedBiz.heroImage3 || storedBiz.imageSlots?.hero3 || '',
    };
  };

  // 3. THE ASYNC FETCH & DOUBLE-READ GUARD + MOUNT CLEANUP
  const hasFetched = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;

    if (hasFetched.current) return;
    hasFetched.current = true;

    const loadBusinessInfo = async () => {
      try {
        const earlyPromise = typeof window !== 'undefined' ? (window as any).__WAAS_BIZ_PROMISE__ : null;
        if (earlyPromise && typeof window !== 'undefined') {
          delete (window as any).__WAAS_BIZ_PROMISE__;
        }
        const res = earlyPromise
          ? await earlyPromise
          : await fetch(`/api/business-info?t=${Date.now()}`, { cache: 'no-store' });
        const data = await parseJsonResponse(res);
        if (data?.success && data?.businessInfo && isMounted.current) {
          setBusinessInfo(formatBusinessInfo(data.businessInfo));
          return;
        }
        const remoteData = await fetchBusinessInfo();
        if (isMounted.current) {
          setBusinessInfo(formatBusinessInfo(remoteData || getStoredBusinessInfo()));
        }
      } catch (err) {
        console.warn('[WaaS] Business info hydration failed, applying fallback:', err);
        // 4. THE FALLBACK GATE: If error thrown, update with getStoredBusinessInfo()
        if (isMounted.current) {
          setBusinessInfo(formatBusinessInfo(getStoredBusinessInfo()));
        }
      }
    };

    loadBusinessInfo();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Initial background hydration for theme CSS variables (Single-Mount Animation Shield: no setActiveThemeId call)
  useEffect(() => {
    const hydrateThemeCss = async () => {
      try {
        const raw = await fetchThemePayload();
        if (raw) {
          const themeData = raw?.data ? (Array.isArray(raw.data) ? raw.data[0] : raw.data) : (Array.isArray(raw) ? raw[0] : raw);
          if (themeData && isMounted.current) {
            applyThemeCss(themeData);
          }
        }
      } catch (err) {
        console.warn('[WaaS] Failed to hydrate theme CSS variables:', err);
      }
    };

    hydrateThemeCss();
  }, []);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<BusinessInfo>;
      if (custom.detail && isMounted.current) {
        setBusinessInfo(formatBusinessInfo(custom.detail));
      }
    };
    window.addEventListener(BUSINESS_INFO_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(BUSINESS_INFO_UPDATED_EVENT, handleUpdate);
  }, [currencyCode, currencySymbol]);

  // Synchronize document title with active business name & tagline
  useEffect(() => {
    if (typeof document !== 'undefined' && businessInfo.name && businessInfo.name.trim() !== '') {
      document.title = businessInfo.tagline
        ? `${businessInfo.name} | ${businessInfo.tagline}`
        : businessInfo.name;
    }
  }, [businessInfo.name, businessInfo.tagline]);

  // 4. THE GLOBAL BRIDGE - LISTENER (STOREFRONT): Instant two-way synchronization
  useEffect(() => {
    const handleThemeUpdated = async (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const verifiedId = customEvent.detail ? String(customEvent.detail) : '1';

      if (isMounted.current) {
        setActiveThemeId(verifiedId);
      }

      // Re-fetch theme data to update document CSS variables dynamically without page refresh
      try {
        const raw = await fetchThemePayload(true);
        if (raw) {
          const themeData = raw?.data ? (Array.isArray(raw.data) ? raw.data[0] : raw.data) : (Array.isArray(raw) ? raw[0] : raw);
          if (themeData) {
            applyThemeCss(themeData);
          }
        }
      } catch (err) {
        console.warn('[WaaS] Failed to update theme CSS variables on event:', err);
      }
    };

    window.addEventListener('WAAS_THEME_UPDATED', handleThemeUpdated);
    return () => {
      window.removeEventListener('WAAS_THEME_UPDATED', handleThemeUpdated);
    };
  }, []);

  const [isSkinActive, setIsSkinActive] = useState<boolean>(false);
  const themeContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if AITheme module is a populated theme rather than an empty null placeholder
    if (AITheme && typeof AITheme === 'function') {
      const str = AITheme.toString();
      if (str.length > 80 && !str.includes('return null') && !str.includes('returnnull')) {
        setIsSkinActive(true);
      }
    }
  }, []);

  useEffect(() => {
    const el = themeContainerRef.current;
    if (!el) return;

    const checkContent = () => {
      if (el.childElementCount > 0) {
        setIsSkinActive(true);
      }
    };

    checkContent();
    const observer = new MutationObserver(checkContent);
    observer.observe(el, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    // Background hydration from API with cache-busting and no-store
    fetch(`/api/services?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => parseJsonResponse(res))
      .then((data: any) => {
        if (isMounted.current && Array.isArray(data)) {
          setServices(
            data.map((s: any) => ({
              ...s,
              images: Array.isArray(s.images) && s.images.length > 0
                ? s.images
                : (s.image ? [s.image] : []),
              duration_minutes: parseInt(String(s.duration || s.duration_minutes || 30), 10) || 30,
              duration: String(s.duration ?? (s.duration_minutes ? `${s.duration_minutes} mins` : '30 mins')),
            }))
          );
        }
      })
      .catch(() => {
        // On network error or non-200 response, preserve existing state—do NOT wipe real loaded services to [] or load localStorage mock ghosts
      });
  }, []);

  // Background hydration of catalog products with coalesced no-store fetch
  useEffect(() => {
    fetchProductsPayload()
      .then((res) => {
        if (isMounted.current && res?.ok && res.data) {
          const items = Array.isArray(res.data?.products)
            ? res.data.products
            : (Array.isArray(res.data) ? res.data : []);
          setProducts(items);
        }
      })
      .catch(() => {});
  }, []);

  // Lock background body scroll while lightbox is active
  useEffect(() => {
    if (!lightboxItem || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [lightboxItem]);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightboxItem) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxItem(null);
      } else if (e.key === 'ArrowLeft' && lightboxItem.images?.length > 1) {
        setCurrentImageIndex(prev =>
          prev === 0 ? lightboxItem.images.length - 1 : prev - 1
        );
      } else if (e.key === 'ArrowRight' && lightboxItem.images?.length > 1) {
        setCurrentImageIndex(prev =>
          prev === lightboxItem.images.length - 1 ? 0 : prev + 1
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem]);

  // Listen for image lightbox trigger events
  useEffect(() => {
    const handleImageEvent = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail) {
        setLightboxItem({
          name: ce.detail.alt || ce.detail.name || 'Storefront Photo',
          images: ce.detail.images || (ce.detail.src ? [ce.detail.src] : []),
        });
        setCurrentImageIndex(0);
      }
    };

    window.addEventListener('open-master-image', handleImageEvent);
    document.addEventListener('open-master-image', handleImageEvent);

    return () => {
      window.removeEventListener('open-master-image', handleImageEvent);
      document.removeEventListener('open-master-image', handleImageEvent);
    };
  }, []);


  const handleOpenLightbox = (srv: any) => {
    const imgs = Array.isArray(srv.images) && srv.images.length > 0
      ? srv.images
      : (srv.image ? [srv.image] : (srv.image_path ? [srv.image_path] : []));
    setLightboxItem({ ...srv, images: imgs });
    setCurrentImageIndex(0);
  };

  const handleProductLightbox = (prod: any, idx = 0) => {
    const imgs = Array.isArray(prod?.images) && prod.images.length > 0
      ? prod.images
      : (prod?.image ? [prod.image] : (prod?.image_path ? [prod.image_path] : []));
    setLightboxItem({ ...prod, images: imgs });
    setCurrentImageIndex(idx || 0);
  };

  useEffect(() => {
    const handleCustomLightbox = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail) {
        const target = ce.detail.product || ce.detail.item || ce.detail;
        handleProductLightbox(target, ce.detail.index || 0);
      }
    };
    window.addEventListener('huzada_open_lightbox', handleCustomLightbox);
    return () => window.removeEventListener('huzada_open_lightbox', handleCustomLightbox);
  }, []);

  const effectiveCurrencyCode = businessInfo.currency || currencyCode || 'USD';
  const effectiveCurrencySymbol = businessInfo.currencySymbol || symbols[effectiveCurrencyCode] || currencySymbol || '$';

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--theme-bg)] font-sans text-[var(--theme-text)] selection:bg-[var(--theme-primary)] selection:text-[var(--theme-bg)] relative">
      {/* WaaS Master Theme Storefront */}
      <ErrorBoundary fallback={null}>
        <AITheme
          key={activeThemeId}
          services={services}
          products={products}
          onOpenLightbox={handleProductLightbox}
          businessInfo={businessInfo}
        />
      </ErrorBoundary>




      {/* High-Fidelity Interactive Lightbox Overlay (Portaled to document.body) */}
      {lightboxItem && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
          onClick={() => setLightboxItem(null)}
        >
          {/* Top Bar */}
          <div
            className="w-full max-w-6xl flex items-center justify-between text-white z-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">
                  {lightboxItem.name}
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-0.5 min-w-0 break-words">
                  {lightboxItem.category ? `${lightboxItem.category} · ` : ''}
                  {businessInfo?.currencySymbol || effectiveCurrencySymbol}{lightboxItem.price}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setLightboxItem(null)}
              className="w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close gallery (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Centered Image Stage */}
          <div
            className="relative flex-1 w-full max-w-6xl flex items-center justify-center my-2 sm:my-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Left navigation arrow */}
            {lightboxItem.images && lightboxItem.images.length > 1 && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setCurrentImageIndex(prev =>
                    prev === 0 ? lightboxItem.images.length - 1 : prev - 1
                  );
                }}
                className="absolute left-2 sm:left-4 z-20 w-11 h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl hover:scale-105"
                title="Previous image (Left Arrow)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Scaled Image */}
            <div className="relative max-h-[72vh] max-w-full flex items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/80 bg-black/40 shadow-2xl">
              <img
                src={lightboxItem.images[currentImageIndex] || lightboxItem.images[0]}
                alt={`${lightboxItem.name} photo ${currentImageIndex + 1}`}
                className="max-h-[72vh] max-w-[85vw] sm:max-w-4xl object-contain rounded-xl select-none"
              />
            </div>

            {/* Right navigation arrow */}
            {lightboxItem.images && lightboxItem.images.length > 1 && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setCurrentImageIndex(prev =>
                    prev === lightboxItem.images.length - 1 ? 0 : prev + 1
                  );
                }}
                className="absolute right-2 sm:right-4 z-20 w-11 h-11 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl hover:scale-105"
                title="Next image (Right Arrow)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Bar: Thumbnails & Counter */}
          <div
            className="w-full max-w-6xl flex flex-col items-center gap-2.5 z-10"
            onClick={e => e.stopPropagation()}
          >
            {lightboxItem.images && lightboxItem.images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto max-w-md py-1 px-2 no-scrollbar">
                {lightboxItem.images.map((img: string, i: number) => (
                  <button
                    key={`${img}-${i}`}
                    type="button"
                    onClick={() => setCurrentImageIndex(i)}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                      i === currentImageIndex
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
              {currentImageIndex + 1} / {lightboxItem.images?.length || 1}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

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
  const lastFetchTime = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    const fetchHydratedData = async (forceRefresh = false) => {
      // 1. Throttle: Prevent DB spam from notification shade fidgeting
      const now = Date.now();
      if (now - lastFetchTime.current < 30000) return; 
      lastFetchTime.current = now;

      try {
        // 2. Coalesced mount fetch / fresh visibility resume fetch with NO CORS preflight penalties
        const raw = await fetchThemePayload(forceRefresh);
        
        // 3. Memory Leak Protection: Abort if unmounted
        if (!isMounted || !raw) return;
        
        // 4. Update existing state safely
        const themeData = raw?.data ? (Array.isArray(raw.data) ? raw.data[0] : raw.data) : (Array.isArray(raw) ? raw[0] : raw);
        if (themeData) {
          applyThemeCss(themeData);
        }
      } catch (err) {
        console.warn('[WaaS] Hydration skipped:', err);
      }
    };

    // Initial fetch on mount
    fetchHydratedData();

    // BFCache Defeat: Listen for foreground return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchHydratedData(true);
      }
    };

    const handleGlobalThemeUpdate = () => {
      fetchHydratedData(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('WAAS_THEME_UPDATED', handleGlobalThemeUpdate);

    // Strict Cleanup: Prevent memory leaks
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('WAAS_THEME_UPDATED', handleGlobalThemeUpdate);
    };
  }, []);

  return (
    <React.Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<PublicStorefrontPortal />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/services" element={<Navigate to="/catalog" replace />} />
        <Route path="/admin" element={<ProtectedAdminRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  );
}


