import React, { useState, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Phone,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { Admin } from './pages/Admin';
import Services from './pages/Services';
import { Catalog } from './pages/Catalog';
import { AdminLogin } from './components/AdminLogin';
import BookingForm from './components/BookingForm';
import EditableImage from './components/EditableImage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { clientConfig } from './config/client';

import AITheme from './components/AITheme';

import { isAuthenticated, AUTH_CHANGE_EVENT } from './lib/auth';
import { getStoredBusinessInfo, fetchBusinessInfo, BUSINESS_INFO_UPDATED_EVENT } from './lib/businessInfo';
import type { BusinessInfo, Service, Product } from './lib/types';

export const FALLBACK_SERVICES: Service[] = [];

const EMPTY_BUSINESS_INFO: BusinessInfo = {
  name: '',
  tagline: '',
  whatsapp: '',
  phone: '',
  currency: '',
  currencySymbol: '',
  address: '',
  hours: '',
  rating: '',
  reviewCount: '',
  imageSlots: {},
};

function PublicBookingPortal() {
  const [selectedService, setSelectedService] = useState<any>(null);
  const [detailsService, setDetailsService] = useState<any>(null);
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

  // 1. THE HYDRATION MANDATE: businessInfo initialized with schema-exact empty fallback
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(EMPTY_BUSINESS_INFO);

  // 4. THE GLOBAL BRIDGE: activeThemeId state for storefront synchronization
  const [activeThemeId, setActiveThemeId] = useState<string>('1');

  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PKR: 'Rs.', AED: 'AED ', CAD: '$', AUD: '$' };

  const formatBusinessInfo = (storedBiz: Partial<BusinessInfo>): BusinessInfo => {
    const effectiveCode = storedBiz.currency || currencyCode || 'USD';
    const effectiveSym = storedBiz.currencySymbol || symbols[effectiveCode] || currencySymbol || '$';

    return {
      ...storedBiz,
      name: storedBiz.name || clientConfig.businessName || 'Huzada Booking',
      tagline: storedBiz.tagline || clientConfig.tagline || 'Professional Appointments Tailored to You',
      whatsapp: storedBiz.whatsapp || clientConfig.whatsappNumber,
      currency: effectiveCode,
      currencySymbol: effectiveSym,
      promoText: storedBiz.promoText,
      logo: storedBiz.logo || storedBiz.imageSlots?.logo,
      imageSlots: {
        ...(storedBiz.imageSlots || {}),
      },
      heroHeadline: storedBiz.heroHeadline,
      heroSubheadline: storedBiz.heroSubheadline,
      aboutDescription: storedBiz.aboutDescription,
      ctaHeadline: storedBiz.ctaHeadline,
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
        const res = await fetch(`/api/business-info?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.businessInfo && isMounted.current) {
            setBusinessInfo(formatBusinessInfo(data.businessInfo));
            return;
          }
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
        const res = await fetch(`/api/theme?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const raw = await res.json();
          const themeData = raw?.data ? (Array.isArray(raw.data) ? raw.data[0] : raw.data) : (Array.isArray(raw) ? raw[0] : raw);
          if (themeData && typeof document !== 'undefined' && isMounted.current) {
            if (themeData.primaryColor) document.documentElement.style.setProperty('--theme-primary', themeData.primaryColor);
            if (themeData.bgColor) document.documentElement.style.setProperty('--theme-bg', themeData.bgColor);
            if (themeData.textColor) document.documentElement.style.setProperty('--theme-text', themeData.textColor);
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
        const res = await fetch(`/api/theme?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const raw = await res.json();
          const themeData = raw?.data ? (Array.isArray(raw.data) ? raw.data[0] : raw.data) : (Array.isArray(raw) ? raw[0] : raw);
          if (themeData && typeof document !== 'undefined') {
            if (themeData.primaryColor) document.documentElement.style.setProperty('--theme-primary', themeData.primaryColor);
            if (themeData.bgColor) document.documentElement.style.setProperty('--theme-bg', themeData.bgColor);
            if (themeData.textColor) document.documentElement.style.setProperty('--theme-text', themeData.textColor);
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
    import('./components/AITheme')
      .then((mod) => {
        const comp = mod.default;
        if (comp && typeof comp === 'function') {
          const str = comp.toString();
          if (str.length > 80 && !str.includes('return null') && !str.includes('returnnull')) {
            setIsSkinActive(true);
          }
        }
      })
      .catch(() => {});
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
      .then(res => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
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

  // Background hydration of catalog products with cache: 'no-store'
  useEffect(() => {
    fetch(`/api/products?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: any) => {
        if (isMounted.current) {
          const items = Array.isArray(data?.products)
            ? data.products
            : (Array.isArray(data) ? data : []);
          setProducts(items);
        }
      })
      .catch(() => {});
  }, []);

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

  // Listen for AITheme booking trigger events
  useEffect(() => {
    const handleBookingEvent = (e: Event) => {
      const ce = e as CustomEvent;
      const detail = ce.detail;

      let requestedName = '';
      if (typeof detail === 'string') {
        requestedName = detail;
      } else if (detail && typeof detail === 'object') {
        requestedName = detail.service || detail.serviceName || detail.name || detail.id || '';
      }

      const activeList = Array.isArray(services) && services.length > 0 ? services : [];

      if (!requestedName) {
        setSelectedService(activeList[0] || {
          id: `custom-${Date.now()}`,
          name: 'General Consultation',
          price: 0,
          duration: '30 mins',
          duration_minutes: 30,
        });
        return;
      }

      const matched = activeList.find((s: any) =>
        s.id?.toLowerCase() === requestedName.toLowerCase() ||
        s.name?.toLowerCase().includes(requestedName.toLowerCase()) ||
        requestedName.toLowerCase().includes(s.name?.toLowerCase())
      );

      setSelectedService(matched || {
        id: `custom-${Date.now()}`,
        name: requestedName,
        price: (detail && typeof detail === 'object' && detail.price) ? Number(detail.price) : 0,
        duration_minutes: 30,
      });
    };

    // Declarative attribute fallback: <button data-waas-book="Service Name">
    const handleDeclarativeClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-waas-book]') as HTMLElement | null;
      if (target) {
        e.preventDefault();
        const serviceName = target.getAttribute('data-waas-book') || target.innerText.trim();
        window.dispatchEvent(
          new CustomEvent('open-master-booking', { detail: { service: serviceName } })
        );
      }
    };

    const handleDetailsEvent = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.service) {
        setDetailsService(ce.detail.service);
      }
    };

    const handleImageEvent = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail) {
        setLightboxItem({
          name: ce.detail.alt || ce.detail.name || 'Service Photo',
          images: ce.detail.images || (ce.detail.src ? [ce.detail.src] : []),
        });
        setCurrentImageIndex(0);
      }
    };

    window.addEventListener('open-master-booking', handleBookingEvent);
    window.addEventListener('open-master-details', handleDetailsEvent);
    window.addEventListener('open-master-image', handleImageEvent);
    document.addEventListener('open-master-booking', handleBookingEvent);
    document.addEventListener('open-master-details', handleDetailsEvent);
    document.addEventListener('open-master-image', handleImageEvent);
    document.addEventListener('click', handleDeclarativeClick);

    return () => {
      window.removeEventListener('open-master-booking', handleBookingEvent);
      window.removeEventListener('open-master-details', handleDetailsEvent);
      window.removeEventListener('open-master-image', handleImageEvent);
      document.removeEventListener('open-master-booking', handleBookingEvent);
      document.removeEventListener('open-master-details', handleDetailsEvent);
      document.removeEventListener('open-master-image', handleImageEvent);
      document.removeEventListener('click', handleDeclarativeClick);
    };
  }, [services]);


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
    <div className="min-h-[100dvh] flex flex-col bg-[var(--theme-bg)] font-sans text-[var(--theme-text)] selection:bg-[var(--theme-primary)] selection:text-[var(--theme-bg)] relative overflow-x-clip">
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




      {/* High-Fidelity Interactive Lightbox Overlay */}
      {lightboxItem && (
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
                  {(lightboxItem.duration || lightboxItem.duration_minutes) && (
                    <span> · {/^\d+$/.test(String(lightboxItem.duration ?? '').trim()) ? `${lightboxItem.duration} mins` : String(lightboxItem.duration || `${lightboxItem.duration_minutes} mins`)}</span>
                  )}
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
        </div>
      )}



      {/* Booking Form Modal Overlay */}
      {detailsService && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pt-[100px] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDetailsService(null)}>
          <div
            className="rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] relative border bg-[var(--theme-bg)] text-[var(--theme-text)]"
            style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Clean Header Bar */}
            <div
              className="px-6 py-5 border-b flex items-center justify-between bg-[var(--theme-bg)] shrink-0"
              style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border text-[var(--theme-primary)]"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)'
                  }}
                >
                  {detailsService.category || "Service Details"}
                </span>
              </div>
              <button
                onClick={() => setDetailsService(null)}
                className="p-2 rounded-full hover:brightness-110 active:scale-95 transition-all cursor-pointer text-[var(--theme-text)]"
                style={{ backgroundColor: 'color-mix(in srgb, var(--theme-text) 10%, transparent)' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[var(--theme-primary)]"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            {/* Scrollable Reading Body */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 bg-[var(--theme-bg)]">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[var(--theme-text)] mb-3">{detailsService.name}</h2>
                <div
                  className="flex items-center gap-4 text-sm pb-4 border-b"
                  style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
                >
                    <div
                      className="flex items-center gap-1.5 font-mono font-medium px-3 py-1 rounded-lg text-[var(--theme-primary)] min-w-0 break-words"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' }}
                    >
                      <Clock size={16} className="text-[var(--theme-primary)] shrink-0" stroke="currentColor" /> {/^\d+$/.test(String(detailsService.duration ?? '').trim()) ? `${detailsService.duration} mins` : String(detailsService.duration || (detailsService.duration_minutes ? `${detailsService.duration_minutes} mins` : '30 mins'))}
                    </div>
                  <div className="font-mono font-bold text-xl text-[var(--theme-text)]">
                    {businessInfo?.currencySymbol || effectiveCurrencySymbol}{detailsService?.price}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-[var(--theme-text)] opacity-70">Complete Description & Details</h3>
                <div
                  className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-sm sm:text-base p-5 rounded-2xl border shadow-inner text-[var(--theme-text)]"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--theme-text) 5%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)'
                  }}
                >
                  {detailsService.description || "Professional appointment session tailored to your schedule."}
                </div>
              </div>
            </div>
            {/* Footer Action */}
            <div
              className="p-5 sm:p-6 bg-[var(--theme-bg)] border-t shrink-0 flex gap-3"
              style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
            >
              <button
                onClick={() => setDetailsService(null)}
                className="flex-1 font-bold py-3.5 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer text-[var(--theme-text)]"
                style={{ backgroundColor: 'color-mix(in srgb, var(--theme-text) 10%, transparent)' }}
              >
                Close
              </button>
              <button
                onClick={() => { setSelectedService(detailsService); setDetailsService(null); }}
                className="flex-[2] bg-[var(--theme-primary)] text-[var(--theme-bg)] font-bold py-3.5 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg hover:shadow-xl cursor-pointer flex justify-center items-center gap-2"
              >
                Book This Service ({businessInfo?.currencySymbol || effectiveCurrencySymbol}{detailsService?.price})
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedService && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pt-[100px] overflow-y-auto">
          <div className="relative w-full max-w-xl my-8">
            <BookingForm
              service={selectedService}
              businessInfo={businessInfo}
              onClose={() => setSelectedService(null)}
            />
          </div>
        </div>
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

    const fetchHydratedData = async () => {
      // 1. Throttle: Prevent DB spam from notification shade fidgeting
      const now = Date.now();
      if (now - lastFetchTime.current < 30000) return; 
      lastFetchTime.current = now;

      try {
        // 2. Native fetch with NO CORS preflight penalties
        const res = await fetch(`/api/theme?t=${Date.now()}`, { cache: 'no-store' });
        const raw = await res.json();
        
        // 3. Memory Leak Protection: Abort if unmounted
        if (!isMounted) return;
        
        // 4. Update existing state safely
        const themeData = raw?.data ? (Array.isArray(raw.data) ? raw.data[0] : raw.data) : (Array.isArray(raw) ? raw[0] : raw);
        if (typeof document !== 'undefined' && themeData) {
          if (themeData.primaryColor) document.documentElement.style.setProperty('--theme-primary', themeData.primaryColor);
          if (themeData.bgColor) document.documentElement.style.setProperty('--theme-bg', themeData.bgColor);
          if (themeData.textColor) document.documentElement.style.setProperty('--theme-text', themeData.textColor);
        }
      } catch (err) {
        console.error("Hydration failed", err);
      }
    };

    // Initial fetch on mount
    fetchHydratedData();

    // BFCache Defeat: Listen for foreground return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchHydratedData();
      }
    };

    const handleGlobalThemeUpdate = () => {
      fetchHydratedData();
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
    <Routes>
      <Route path="/" element={<PublicBookingPortal />} />
      <Route path="/services" element={<Services />} />
      <Route path="/catalog" element={<Catalog />} />
      <Route path="/admin" element={<ProtectedAdminRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


