import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Phone,
  Clock,
  ArrowUpRight,
  ShoppingBag,
  Menu,
  X,
  Sparkles,
  Package,
} from 'lucide-react';
import { EditableImage } from './EditableImage';
import { CatalogEngine } from './CatalogEngine';
import { HeaderBagButton } from './HeaderBagButton';
import { openCartDrawer } from '../lib/cart';
import type { Product } from '../lib/types';
import { clientConfig } from '../config/client';
import { DEFAULT_BUSINESS_INFO } from '../lib/businessInfo';
import { fetchThemePayload } from '../lib/themeCache';
import { DEFAULT_HERO_IMAGE, optimizeUnsplashUrl, buildUnsplashSrcSet } from '../lib/imageOptimize';

// ─── Fallback image used when a service has no image ─────────────────────────
const SERVICE_IMAGE_FALLBACK =
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=75';

export interface ServiceItem {
  id?: string | number;
  name?: string;
  description?: string;
  price?: number | string;
  category?: string;
  image?: string;
  images?: string[];
  image_path?: string;
  duration?: string | number;
  duration_minutes?: number;
  badge?: string;
  featured?: boolean;
}

export interface BusinessInfo {
  name?: string;
  tagline?: string;
  promoText?: string;
  whatsapp?: string;
  phone?: string;
  currency?: string;
  currencySymbol?: string;
  address?: string;
  hours?: string;
  rating?: string;
  reviewCount?: string;
  mapsUrl?: string;
  imageSlots?: Record<string, string>;
  heroHeadline?: string;
  heroSubheadline?: string;
  aboutDescription?: string;
  ctaHeadline?: string;
  heroImage?: string;
  heroImage2?: string;
  heroImage3?: string;
  logo?: string;
}

export interface AIThemeProps {
  services?: ServiceItem[];
  products?: Product[];
  businessInfo?: Partial<BusinessInfo>;
  onOpenLightbox?: (product: Product, index?: number) => void;
}

function resolveServiceImage(service: ServiceItem): string {
  const raw =
    (Array.isArray(service.images) && service.images[0]) ||
    service.image ||
    service.image_path ||
    '';
  if (!raw || raw.includes('test-shirt') || raw.includes('default-client')) {
    return SERVICE_IMAGE_FALLBACK;
  }
  return raw;
}

function formatPrice(price: number | string | undefined, symbol: string): string {
  if (price === undefined || price === null || price === '') return '';
  const num = typeof price === 'number' ? price : parseFloat(String(price));
  if (isNaN(num)) return `${symbol}${price}`;
  return `${symbol}${num.toLocaleString()}`;
}

// ─── Memory-Safe Animated Social Proof Counter ─────────────────────────────────
interface AnimatedCounterProps {
  end: number | string;
  decimals?: number;
  duration?: number;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  end,
  decimals = 0,
  duration = 1200,
}) => {
  const numericEnd = useMemo(() => {
    if (typeof end === 'number') return end;
    const parsed = parseFloat(String(end).replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }, [end]);

  const shouldAnimate = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (window.innerWidth < 768) return false;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    return true;
  }, []);

  const [displayValue, setDisplayValue] = useState<number>(() =>
    shouldAnimate ? 0 : numericEnd
  );

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayValue(numericEnd);
      return;
    }

    let startTime: number | null = null;
    let frameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(easeOut * numericEnd);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(numericEnd);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [numericEnd, duration, shouldAnimate]);

  return <>{displayValue.toFixed(decimals)}</>;
};

// ─── Apple-Style Blur-Fade Scroll Reveal Wrapper ──────────────────────────────
const FadeInSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = domRef.current;
    if (!currentRef) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.02, rootMargin: '0px 0px 40px 0px' }
    );

    observer.observe(currentRef);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={domRef} className={`reveal-blur ${isVisible ? 'reveal-visible' : ''} ${className}`}>
      {children}
    </div>
  );
};

// ─── Cache-Safe Frosted Glass Skeleton Loader ────────────────────────────────
const GlassImage = ({
  src,
  alt,
  className,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) {
      setIsLoaded(true);
    }
  }, []);

  return (
    <div className={`relative overflow-hidden ${className || ''}`} onClick={onClick}>
      {!isLoaded && (
        <div
          className="absolute inset-0 backdrop-blur-md animate-pulse z-0"
          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-text) 10%, transparent)' }}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-700 ease-out z-10 relative ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

export default function AITheme({
  services = [],
  products = [],
  businessInfo = {},
  onOpenLightbox,
}: AIThemeProps) {
  const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    PKR: 'Rs.',
    AED: 'AED ',
    CAD: '$',
    AUD: '$',
  };

  const currencyCode = businessInfo.currency || 'USD';
  const currencySymbol =
    businessInfo.currencySymbol ||
    CURRENCY_SYMBOLS[currencyCode] ||
    (currencyCode === 'PKR' ? 'Rs.' : '$');

  const biz = {
    name: businessInfo.name || DEFAULT_BUSINESS_INFO.name || clientConfig.businessName || 'Huzada Storefront',
    tagline: businessInfo.tagline || DEFAULT_BUSINESS_INFO.tagline || clientConfig.tagline || 'Curated Products & Premium Selection',
    whatsapp: businessInfo.whatsapp || DEFAULT_BUSINESS_INFO.whatsapp || clientConfig.whatsappNumber || '',
    phone: businessInfo.phone || DEFAULT_BUSINESS_INFO.phone || '+1 (409) 256-3597',
    currency: currencyCode,
    currencySymbol: currencySymbol,
    address: businessInfo.address || DEFAULT_BUSINESS_INFO.address || '811 6th St N #200, Texas City, TX 77590',
    hours: businessInfo.hours || DEFAULT_BUSINESS_INFO.hours || 'Mon–Sat, 9:00 AM – 6:00 PM',
    rating: businessInfo.rating || DEFAULT_BUSINESS_INFO.rating || '4.9',
    reviewCount: businessInfo.reviewCount || DEFAULT_BUSINESS_INFO.reviewCount || '48+',
    mapsUrl: businessInfo.mapsUrl || DEFAULT_BUSINESS_INFO.mapsUrl || 'https://maps.google.com/',
    imageSlots: businessInfo.imageSlots || {},
  };

  const promoText =
    businessInfo?.promoText !== undefined && businessInfo?.promoText !== ''
      ? businessInfo.promoText
      : (DEFAULT_BUSINESS_INFO.promoText || '⚡ CURATED STOREFRONT CATALOG • FAST DOORSTEP DELIVERY & SECURE DIRECT CHECKOUT ⚡');

  const safeServices = Array.isArray(services) ? services : [];
  const safeProducts = Array.isArray(products) ? products : [];

  const categories = useMemo(() => {
    const unique = Array.from(new Set(safeServices.map((s) => s.category).filter(Boolean)));
    return unique.length > 0 ? (unique as string[]) : [];
  }, [safeServices]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobileMenuOpen = isMenuOpen;
  const setIsMobileMenuOpen = setIsMenuOpen;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Close mobile navigation drawer on Escape key
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMenuOpen]);

  const [themeLogo, setThemeLogo] = useState<string | null>(null);
  const lastThemeFetchTime = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    const fetchHydratedData = async (forceRefresh = false) => {
      // 1. Throttle: Prevent DB spam from notification shade fidgeting
      const now = Date.now();
      if (now - lastThemeFetchTime.current < 30000) return; 
      lastThemeFetchTime.current = now;

      try {
        // 2. Coalesced mount fetch / fresh visibility resume fetch with NO CORS preflight penalties
        const raw = await fetchThemePayload(forceRefresh);
        
        // 3. Memory Leak Protection: Abort if unmounted
        if (!isMounted || !raw) return;
        
        // 4. Update existing state safely
        const themeData = raw?.data ? (Array.isArray(raw.data) ? raw.data[0] : raw.data) : (Array.isArray(raw) ? raw[0] : raw);
        if (themeData) {
          if (themeData.logo) setThemeLogo(themeData.logo);
          if (typeof document !== 'undefined') {
            if (themeData.primaryColor) {
              document.documentElement.style.setProperty('--theme-primary', themeData.primaryColor);
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
            let spiceColor = themeData.spiceColor;
            if (!spiceColor) {
              const primary = (themeData.primaryColor || '').toLowerCase().trim();
              const bg = (themeData.bgColor || '').toLowerCase().trim();
              spiceColor = '#ea580c';
              if (primary === '#10b981' || bg === '#09090b') {
                spiceColor = '#a855f7'; // Neon Midnight: Electric Ultraviolet
              } else if (primary === '#d97706' || bg === '#1c1917') {
                spiceColor = '#f43f5e'; // Luxury Amber: Crimson Ruby
              } else if (primary === '#0ea5e9' || bg === '#ffffff' || bg === '#f8fafc') {
                spiceColor = '#ea580c'; // Ocean Light: Deep Coral Sunset
              } else {
                const h = primary.replace('#', '');
                if (h.length === 6) {
                  const r = parseInt(h.slice(0, 2), 16) || 0;
                  const g = parseInt(h.slice(2, 4), 16) || 0;
                  const b = parseInt(h.slice(4, 6), 16) || 0;
                  if (g > r + 30 && g > b) spiceColor = '#a855f7';
                  else if (b > r + 30 && b > g) spiceColor = '#ea580c';
                  else if (r > b + 40 && g > b) spiceColor = '#f43f5e';
                }
              }
            }
            document.documentElement.style.setProperty('--theme-spice', spiceColor);
            document.documentElement.style.setProperty('--theme-spice-soft', `color-mix(in srgb, ${spiceColor} 14%, transparent)`);
          }
        }
      } catch (err) {
        console.warn('[WaaS] Hydration skipped:', err);
      }
    };

    // Initial fetch on mount
    fetchHydratedData();

    // BFCache Defeat: Listen for foreground return
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchHydratedData(true);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Strict Cleanup: Prevent memory leaks
    return () => {
      isMounted = false;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const activeLogo = themeLogo || businessInfo?.logo || businessInfo?.imageSlots?.logo;

  const defaultHero =
    biz.imageSlots?.hero || DEFAULT_HERO_IMAGE;

  const slideImages = [
    businessInfo?.heroImage?.trim() ? businessInfo.heroImage : defaultHero,
    businessInfo?.heroImage2?.trim()
      ? businessInfo.heroImage2
      : 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=75',
    businessInfo?.heroImage3?.trim()
      ? businessInfo.heroImage3
      : 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=75',
  ];

  const [hasIntersected, setHasIntersected] = useState(false);
  const [isHeroInView, setIsHeroInView] = useState(false);
  const [isDocHidden, setIsDocHidden] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.hidden) : false
  );
  const [showSecondarySlides, setShowSecondarySlides] = useState(false);
  const [isIntroAnimating, setIsIntroAnimating] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      setIsDocHidden(Boolean(document.hidden));
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsHeroInView(true);
      setHasIntersected(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsHeroInView(visible);
        if (visible) {
          setHasIntersected(true);
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!hasIntersected || isDocHidden) return;

    const secondaryTimer = setTimeout(() => {
      setShowSecondarySlides(true);
    }, 2800);

    const timer = setTimeout(() => {
      setIsIntroAnimating(false);
    }, 1500);

    return () => {
      clearTimeout(secondaryTimer);
      clearTimeout(timer);
    };
  }, [hasIntersected, isDocHidden]);

  useEffect(() => {
    if (!isHeroInView || isDocHidden) return;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setCurrentSlide((prev) => (prev + 1) % slideImages.length);
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [isHeroInView, isDocHidden, slideImages.length]);

  const filteredServices =
    selectedCategory === 'all'
      ? safeServices
      : safeServices.filter((s) => s.category === selectedCategory);

  const markImageFailed = (key: string) =>
    setFailedImages((prev) => ({ ...prev, [key]: true }));

  // ─── Event Bridge: Double-Dispatch on window and document ─────────────────
  const dispatchImageOpen = (src: string, alt: string) => {
    const payload = { src, alt, images: [src], name: alt };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-master-image', { detail: payload }));
    }
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('open-master-image', { detail: payload }));
    }
  };

  // ─── Apple TV 3D Kinetic Tilt Physics ───────────────────────────────────────
  const tiltRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tiltRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(tiltRafRef.current);
        tiltRafRef.current = null;
      }
    };
  }, []);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (typeof window === 'undefined') return;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canHover || prefersReducedMotion) return;

    const target = e.currentTarget;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (tiltRafRef.current !== null) {
      cancelAnimationFrame(tiltRafRef.current);
    }

    tiltRafRef.current = requestAnimationFrame(() => {
      tiltRafRef.current = null;
      const rect = target.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      target.style.setProperty('--mouse-x', `${x}px`);
      target.style.setProperty('--mouse-y', `${y}px`);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      target.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
    });
  };

  const handleCardMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    if (tiltRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(tiltRafRef.current);
      tiltRafRef.current = null;
    }
    e.currentTarget.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  };

  return (
    <>
      <div className={`min-h-[100dvh] flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)] selection:bg-[var(--theme-primary)] selection:text-[var(--theme-on-primary)] relative${isDocHidden ? ' waas-doc-hidden' : ''}`}>
      {/* ── Zero-Dependency CSS Layer ───────────────────────────────────────── */}
      <style>{`
        :root {
          --theme-primary: #0ea5e9;
          --theme-primary-hover: color-mix(in srgb, var(--theme-primary) 85%, #000000);
          --theme-accent: var(--theme-primary);
          --theme-accent-soft: color-mix(in srgb, var(--theme-primary) 14%, transparent);
          --theme-spice: #ea580c;
          --theme-spice-soft: color-mix(in srgb, var(--theme-spice) 14%, transparent);
          --theme-surface: color-mix(in srgb, var(--theme-text) 6%, var(--theme-bg));
          --theme-surface-subtle: color-mix(in srgb, var(--theme-text) 10%, var(--theme-bg));
          --theme-surface-translucent: color-mix(in srgb, var(--theme-bg) 88%, transparent);
          --theme-text-muted: color-mix(in srgb, var(--theme-text) 74%, transparent);
          --theme-text-subtle: color-mix(in srgb, var(--theme-text) 54%, transparent);
          --theme-on-primary: #ffffff;
          --theme-on-primary-muted: rgba(255, 255, 255, 0.75);
          --theme-on-primary-border: rgba(255, 255, 255, 0.22);
          --theme-border: color-mix(in srgb, var(--theme-text) 14%, transparent);
          --theme-border-strong: color-mix(in srgb, var(--theme-text) 24%, transparent);
          --theme-radius: 0.75rem;
          --theme-radius-inner: 0.5rem;
          --shading-base: var(--theme-text);
          --font-display: 'Cormorant Garamond', Georgia, serif;
          --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        html { scroll-padding-top: 80px; scroll-behavior: smooth; }

        body {
          font-family: var(--font-body);
        }

        .font-editorial { font-family: var(--font-display); }
        .headline-balance { text-wrap: balance; }

        @keyframes wavy-float {
          0% { transform: translateY(0px) rotate(0deg) scale(1); filter: drop-shadow(0 10px 15px rgba(0,0,0,0.1)); }
          50% { transform: translateY(-12px) rotate(2.5deg) scale(1.02); filter: drop-shadow(0 25px 35px rgba(0,0,0,0.25)); }
          100% { transform: translateY(0px) rotate(0deg) scale(1); filter: drop-shadow(0 10px 15px rgba(0,0,0,0.1)); }
        }
        .animate-wavy-float {
          animation: wavy-float 6s ease-in-out infinite;
          will-change: transform, filter;
          transform-origin: center;
        }

        /* 1. Hardware-Composited Scroll Reveal */
        .reveal-blur {
          opacity: 0;
          transform: translate3d(0, 14px, 0);
          transition: opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform;
          backface-visibility: hidden;
        }
        .reveal-visible {
          opacity: 1;
          transform: translate3d(0, 0, 0);
          will-change: auto;
        }

        /* 2. Linear Spotlight Card */
        .spotlight-card {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }
        .spotlight-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
            600px circle at var(--mouse-x, 0) var(--mouse-y, 0),
            color-mix(in srgb, var(--theme-primary) 15%, transparent),
            transparent 40%
          );
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
          pointer-events: none;
        }
        @media (hover: hover) and (pointer: fine) {
          .spotlight-card:hover::before {
            opacity: 1;
          }
        }

        /* ── Strict Prefers-Reduced-Motion Guardrail ── */
        @media (prefers-reduced-motion: reduce) {
          .reveal-blur {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
          .animate-float,
          .animate-wavy-float,
          .animate-float-gentle,
          .animate-float-subtle,
          .animate-float-micro,
          .animate-shimmer,
          .animate-text-shimmer,
          .hero-headline-shading,
          .animate-marquee,
          .aurora-blob,
          .btn-radar::after {
            animation: none !important;
            animation-play-state: paused !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* ── True Glassmorphic Sticky Header & Marquee Wrapper ──────────────── */}
      <div
        className="sticky top-0 z-40 w-full border-b transition-colors transform-gpu relative"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--theme-bg) 94%, transparent)',
          borderColor: 'color-mix(in srgb, var(--theme-spice) 22%, color-mix(in srgb, var(--theme-text) 10%, transparent))'
        }}
      >
        {/* Subtle luminous Spice Accent hairline strip */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px] pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--theme-spice) 35%, transparent) 20%, color-mix(in srgb, var(--theme-spice) 50%, transparent) 50%, color-mix(in srgb, var(--theme-spice) 35%, transparent) 80%, transparent 100%)',
          }}
        />
        {/* ── Top-Level Marquee Announcement Bar (Isolated from backdrop-filter) ── */}
        <div
          className="w-full overflow-hidden py-2 border-b select-none relative [contain:layout_paint]"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--theme-text) 6%, var(--theme-bg))',
            color: 'var(--theme-text)',
            borderColor: 'color-mix(in srgb, var(--theme-text) 10%, transparent)'
          }}
        >
          <div className="animate-marquee whitespace-nowrap">
            <div className="flex items-center shrink-0">
              <span className="mx-6 text-xs sm:text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
              <span className="mx-6 text-xs sm:text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
            </div>
            <div className="flex items-center shrink-0" aria-hidden="true">
              <span className="mx-6 text-xs sm:text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
              <span className="mx-6 text-xs sm:text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
            </div>
          </div>
        </div>

        {/* ── Navigation Bar ──────────────────────────────────────────────────── */}
        <header className="min-h-16 py-2.5 relative flex items-center md:backdrop-blur-md">
          <div className="w-full max-w-7xl mx-auto px-4 min-h-16 flex items-center justify-between gap-2 sm:gap-3">
            {/* Left: Logo + Business Name (flex-1 with min-w-0 flex container) */}
            <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
              {activeLogo && (
                <img 
                  src={activeLogo} 
                  alt="Logo" 
                  decoding="async"
                  className="w-8 h-8 md:w-10 md:h-10 rounded-[var(--theme-radius)] object-cover shrink-0 aspect-square"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="block whitespace-normal break-words [overflow-wrap:anywhere] leading-snug py-0.5 line-clamp-2 text-sm sm:text-base md:text-lg font-bold text-[var(--theme-text)]">
                  {biz.name}
                </span>
              </div>
            </div>

            {/* Center: Desktop Navigation (Hidden on mobile) */}
            <nav className="hidden lg:flex items-center justify-center gap-7 flex-none">
              <a href="#catalog" className="text-sm font-semibold text-[var(--theme-text)] opacity-90 hover:opacity-100 transition-opacity flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-[var(--theme-primary)]" />
                <span>Store Catalog</span>
              </a>
              <a href="#about" className="text-sm font-medium text-[var(--theme-text)] opacity-80 hover:opacity-100 transition-opacity">About</a>
              <a href="#contact" className="text-sm font-medium text-[var(--theme-text)] opacity-80 hover:opacity-100 transition-opacity">Contact</a>
            </nav>

            {/* Right: CTA Button & Mobile Hamburger Toggle */}
            <div className="shrink-0 lg:flex-1 flex items-center justify-end gap-2 sm:gap-2.5">
              <HeaderBagButton
                onClick={() => {
                  setIsMenuOpen(false);
                  openCartDrawer();
                }}
              />

              {/* Mobile Hamburger Toggle Button */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="shrink-0 lg:hidden relative z-50 p-2 rounded-lg text-[var(--theme-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none cursor-pointer"
                aria-label="Toggle navigation menu"
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? (
                  <X className="w-6 h-6 shrink-0" />
                ) : (
                  <Menu className="w-6 h-6 shrink-0" />
                )}
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile Dropdown Drawer (Escaped from sticky & backdrop-blur wrapper) */}
      {isMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 h-[100dvh] w-full backdrop-blur-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in fade-in duration-200"
          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-bg) 98%, transparent)' }}
        >
          <div
            className="flex items-center justify-between pb-4 border-b gap-3"
            style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
          >
            <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
              {activeLogo && (
                <img 
                  src={activeLogo} 
                  alt="Logo" 
                  className="w-8 h-8 rounded-[var(--theme-radius)] object-cover shrink-0 aspect-square"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="block whitespace-normal break-words [overflow-wrap:anywhere] leading-snug py-0.5 line-clamp-2 text-sm sm:text-base font-bold text-[var(--theme-text)]">
                  {biz.name}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="shrink-0 p-2 rounded-lg text-[var(--theme-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="w-6 h-6 shrink-0" />
            </button>
          </div>

          <div className="flex-1 py-6 flex flex-col justify-center space-y-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-muted)]">
              Storefront Navigation
            </div>
            <nav className="flex flex-col space-y-4">
              <a
                href="#catalog"
                onClick={() => setIsMenuOpen(false)}
                className="text-xl font-semibold text-[var(--theme-text)] hover:text-[var(--theme-primary)] transition-colors py-2 border-b flex items-center justify-between"
                style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-[var(--theme-primary)]" />
                  <span>Store Catalog</span>
                </span>
                <ArrowUpRight className="w-5 h-5 opacity-60" />
              </a>
              <a
                href="#about"
                onClick={() => setIsMenuOpen(false)}
                className="text-xl font-semibold text-[var(--theme-text)] hover:text-[var(--theme-primary)] transition-colors py-2 border-b flex items-center justify-between"
                style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
              >
                <span>About Us</span>
                <ArrowUpRight className="w-5 h-5 opacity-60" />
              </a>
              <a
                href="#contact"
                onClick={() => setIsMenuOpen(false)}
                className="text-xl font-semibold text-[var(--theme-text)] hover:text-[var(--theme-primary)] transition-colors py-2 flex items-center justify-between"
              >
                <span>Contact & Inquiries</span>
                <ArrowUpRight className="w-5 h-5 opacity-60" />
              </a>
            </nav>

            <div className="pt-4 space-y-3">
              <HeaderBagButton
                className="w-full justify-center !py-3.5 !text-base"
                onClick={() => {
                  setIsMenuOpen(false);
                  openCartDrawer();
                }}
              />

              {biz.phone && (
                <a
                  href={`tel:${biz.phone.replace(/\s+/g, '')}`}
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl border border-[var(--theme-border-strong)] text-[var(--theme-text)] font-semibold text-sm hover:border-[var(--theme-text)] transition-colors cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call {biz.phone}</span>
                </a>
              )}
            </div>
          </div>

          <div
            className="pt-4 pb-2 text-xs text-[var(--theme-text-subtle)] text-center border-t"
            style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 15%, transparent)' }}
          >
            <p>{biz.address}</p>
            <p className="mt-1">{biz.hours}</p>
          </div>
        </div>
      )}

      <main id="top" className="flex-grow flex flex-col">
        {/* ── Hero Section (Weightless Editorial Floating Plane with Sculpted Rounded Bottom) ────── */}
        <section
          className="relative w-full overflow-hidden rounded-b-[28px] sm:rounded-b-[36px] min-h-[380px] sm:min-h-[460px] lg:min-h-[540px] flex items-center border-b"
          style={{
            borderColor: 'color-mix(in srgb, var(--theme-spice) 25%, color-mix(in srgb, var(--theme-border) 40%, transparent))',
            boxShadow: '0 24px 60px -15px rgba(0,0,0,0.5), 0 0 0 1px color-mix(in srgb, var(--theme-spice) 12%, transparent)',
            '--shading-base': '#ffffff',
          } as React.CSSProperties}
        >
          {/* Full-Bleed Slideshow Background Layer */}
          <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0">
            {/* Themed gradient & aurora fallback layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-surface)] to-[var(--theme-bg)] z-0" />

            {/* HARDWARE-ACCELERATED NEON PATTERN (Desktop only to keep 360px scroll lightweight) */}
            <div
              className="hidden md:block absolute inset-0 pointer-events-none z-0"
              style={{
                backgroundImage: `radial-gradient(color-mix(in srgb, var(--theme-primary) 70%, transparent) 2px, transparent 2px)`,
                backgroundSize: '32px 32px',
                transform: 'translateZ(0)',
                opacity: 0.35,
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
              }}
            />

            {/* Aurora Glow Blobs */}
            <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none z-0">
              <div className="aurora-blob bg-[var(--theme-primary)] w-[30rem] h-[30rem] -top-32 -left-32 opacity-25"></div>
              <div
                className="aurora-blob bg-[var(--theme-primary)] w-[30rem] h-[30rem] top-32 -right-32 opacity-20"
                style={{ animationDelay: '2s' }}
              ></div>
            </div>

            {/* Slideshow Images with Smooth Transitions and Gentle Drift */}
            {slideImages.map((src, index) => {
              if (index > 0 && !showSecondarySlides && currentSlide !== index) {
                return null;
              }
              const isCurrent = currentSlide === index;
              const slideSrc = optimizeUnsplashUrl(src, index === 0 ? 960 : 800, 75);
              const slideSrcSet =
                index === 0 ? buildUnsplashSrcSet(src, [640, 1080], 75) : undefined;
              return (
                <img
                  key={index}
                  src={slideSrc}
                  srcSet={slideSrcSet}
                  sizes={slideSrcSet ? '100vw' : undefined}
                  alt={`${biz.name} visual ${index + 1}`}
                  draggable={false}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding={index === 0 ? 'sync' : 'async'}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out transform-gpu [backface-visibility:hidden] md:motion-safe:scale-[1.03] select-none ${
                    isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                />
              );
            })}
          </div>

          {/* Silky Edge-Free Readability Scrim (Multi-stop depth for bulletproof contrast across all presets) */}
          <div className="absolute inset-0 pointer-events-none z-[1] bg-gradient-to-t from-black/95 via-black/75 via-50% to-black/25 md:bg-gradient-to-r md:from-black/90 md:via-black/65 md:via-50% md:to-transparent" />
          <div
            className="hidden md:block absolute inset-0 pointer-events-none z-[1]"
            style={{
              background: 'radial-gradient(ellipse 65% 75% at 20% 45%, rgba(0,0,0,0.68) 0%, transparent 80%)',
            }}
          />

          {/* Weightless Floating Left-Aligned Content Stage (No bulky frosted box) */}
          <div className="relative z-10 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-18">
            <div
              ref={heroRef}
              className="w-full max-w-xl lg:max-w-2xl py-2 sm:py-4"
            >
              {/* Slim Glass Trust Pill with Crisp Spice Rim */}
              <div
                className="inline-flex flex-wrap items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium bg-black/55 md:bg-white/10 md:backdrop-blur-sm text-white/95 shadow-sm border"
                style={{
                  borderColor: 'color-mix(in srgb, var(--theme-spice) 35%, rgba(255,255,255,0.25))',
                  boxShadow: '0 0 12px color-mix(in srgb, var(--theme-spice) 12%, transparent)',
                }}
              >
                <span>{biz.address.split(',').slice(-2).join(',').trim()}</span>
                <span aria-hidden="true" className="text-white/50">·</span>
                <span className="tabular-nums font-semibold text-white flex items-center gap-1">
                  <AnimatedCounter end={biz.rating} decimals={1} />
                  <span style={{ color: 'var(--theme-spice)' }}>★</span>
                  <span>Rated</span>
                </span>
              </div>

              {/* Crisp Editorial Headline with Visible Transparent Color Shading & Subtle Spice Atmospheric Depth */}
              <h1 className="font-editorial headline-balance hero-headline-depth mt-4 text-[clamp(2.1rem,4.2vw,3.6rem)] font-semibold leading-[1.08] tracking-tight whitespace-normal break-words [overflow-wrap:anywhere]">
                <span className="hero-headline-shading">
                  {businessInfo?.heroHeadline || DEFAULT_BUSINESS_INFO.heroHeadline || biz.tagline}
                </span>
              </h1>

              {/* Clean Luminous Subheadline with Restored Optical Shading */}
              <p
                className="hero-subheadline-depth mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-white/90 whitespace-normal break-words [overflow-wrap:anywhere]"
                style={{
                  textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.65)',
                }}
              >
                {businessInfo?.heroSubheadline || DEFAULT_BUSINESS_INFO.heroSubheadline ||
                  'Explore our handpicked catalog of premium items with transparent pricing, instant web order placement, and direct doorstep delivery.'}
              </p>

              {/* Sleek Side-by-Side CTAs & Contact Meta */}
              <div className="mt-7 pt-5 border-t border-white/15">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {/* High-Contrast Primary Pill Button */}
                  <a
                    href="#catalog"
                    className="inline-flex min-h-[46px] sm:min-h-[48px] items-center justify-center gap-2.5 rounded-full bg-[var(--theme-primary)] px-6 sm:px-7 py-2.5 sm:py-3 text-sm font-semibold text-[var(--theme-on-primary)] whitespace-nowrap shrink-0 transition-[transform,filter,box-shadow] duration-200 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer shadow-lg hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)]"
                  >
                    <ShoppingBag className="h-4 w-4 shrink-0 text-[var(--theme-on-primary)]" stroke="currentColor" aria-hidden="true" />
                    <span>Explore Catalog</span>
                  </a>

                  {/* Translucent Secondary Glass Pill Button */}
                  <a
                    href="#contact"
                    className="inline-flex min-h-[46px] sm:min-h-[48px] items-center justify-center gap-2 rounded-full bg-black/45 md:bg-white/10 md:backdrop-blur-sm border border-white/25 px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-[transform,background-color,border-color] duration-200 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <span>Contact &amp; Inquiries</span>
                  </a>
                </div>

                {/* Subtitle Contact & Hours Meta */}
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70 tabular-nums">
                  <span>{biz.address}</span>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <a
                    href={`tel:${biz.phone.replace(/\s+/g, '')}`}
                    className="font-medium text-white/90 hover:text-white transition-colors"
                  >
                    {biz.phone}
                  </a>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span>{biz.hours}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Slide Indicator & Fullscreen Trigger (Compact Glass Pill in bottom-right corner) */}
          {slideImages.length > 1 && (
            <div
              className="absolute bottom-4 right-4 sm:bottom-6 sm:right-8 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/65 md:bg-black/40 md:backdrop-blur-md border shadow-lg"
              style={{
                borderColor: 'color-mix(in srgb, var(--theme-spice) 30%, rgba(255,255,255,0.2))',
              }}
            >
              {slideImages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Go to visual slide ${idx + 1}`}
                  className={`h-1.5 w-5 origin-center rounded-full transition-[transform,background-color,opacity] duration-300 cursor-pointer ${
                    currentSlide === idx
                      ? 'scale-x-100 bg-[var(--theme-primary)]'
                      : 'scale-x-[0.35] bg-white/50 hover:bg-white'
                  }`}
                />
              ))}
              <button
                type="button"
                onClick={() => dispatchImageOpen(slideImages[currentSlide], `${biz.name} Studio Visual`)}
                aria-label="Expand image"
                className="ml-1 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="View image full size"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>

        {/* ── Trust Strip (Canvas Layer beneath Full-Bleed Hero) ────────────── */}
        <div className="w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <FadeInSection>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 lg:gap-5">
              {[
                {
                  value: (
                    <>
                      <AnimatedCounter end={biz.rating} decimals={1} />
                      <span className="text-base sm:text-lg font-normal opacity-70 ml-1">/ 5.0</span>
                    </>
                  ),
                  label: 'Client Rating',
                  detail: (
                    <>
                      <AnimatedCounter end={biz.reviewCount} decimals={0} />+ Verified Reviews
                    </>
                  ),
                },
                {
                  value: (
                    <>
                      <AnimatedCounter end={safeProducts.length > 0 ? safeProducts.length : 12} decimals={0} />+
                    </>
                  ),
                  label: safeProducts.length > 0 ? 'Catalog Products' : 'Curated Items',
                  detail: 'Instant Web Checkout & Fast Delivery',
                },
                {
                  value: biz.currency,
                  label: 'Transparent Rates',
                  detail: 'Instant web orders & doorstep delivery',
                },
                {
                  value: biz.hours.split(',')[0] || 'Mon–Sat',
                  label: 'Operating Hours',
                  detail: biz.hours,
                },
              ].map((metric, mIdx) => (
                <div
                  key={mIdx}
                  className="group relative rounded-2xl border p-5 sm:p-6 md:backdrop-blur-md trust-card-surface motion-safe:animate-float-subtle md:motion-safe:hover:-translate-y-0.5 transition-[box-shadow,border-color] duration-200 flex flex-col justify-between"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--theme-surface) 88%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--theme-spice) 20%, color-mix(in srgb, var(--theme-border) 60%, transparent))',
                    animationDelay: `${mIdx * 0.75}s`,
                  }}
                >
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-[var(--theme-primary)]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--theme-spice)' }} />
                      {metric.label}
                    </p>
                    <div
                      className="font-editorial text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums mt-1.5 flex items-baseline gap-1 motion-safe:animate-float-micro metric-headline-depth"
                      style={{ animationDelay: `${mIdx * 0.75 + 0.35}s` }}
                    >
                      <span className="hero-headline-shading">
                        {metric.value}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[var(--theme-text-muted)] leading-relaxed tabular-nums">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>

        {/* ── Storefront Catalog & Product Section ───────────────────────────── */}
        <section
          id="catalog"
          className="scroll-mt-28 sm:scroll-mt-32 border-t border-[var(--theme-border)] py-16 lg:py-24 bg-[var(--theme-surface)]"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8 space-y-8">
            <FadeInSection>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2.5 shadow-xs border"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--theme-spice) 12%, var(--theme-surface-translucent))',
                      color: 'var(--theme-spice)',
                      borderColor: 'color-mix(in srgb, var(--theme-spice) 30%, transparent)',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Storefront Product Catalog</span>
                  </div>
                  <h2 className="font-editorial headline-balance text-3xl font-semibold tracking-tight text-[var(--theme-text)] sm:text-4xl">
                    Featured Products &amp; Collections
                  </h2>
                  <p className="mt-2 text-base leading-relaxed text-[var(--theme-text-muted)]">
                    Explore our curated collection with real-time search, multi-image carousel &amp; lightbox previews, and direct web checkout.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/catalog"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--theme-radius-inner)] bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold shadow-xs hover:shadow-md transition-[transform,background-color,box-shadow] active:scale-95"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>View All Products</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </FadeInSection>

            {/* Real Catalog Engine Mounted Visibly with 8-Product Category-Divided Split */}
            <div className="pt-2">
              <CatalogEngine
                products={safeProducts.length > 0 ? safeProducts : undefined}
                currencySymbol={currencySymbol}
                onOpenLightbox={onOpenLightbox}
                layoutMode="home-preview"
                maxProducts={8}
              />
            </div>
          </div>
        </section>

        {/* ── Storefront Marquee Ticker ──────────────────────────────────────── */}
        <div className="border-y border-[var(--theme-border)] bg-[var(--theme-surface)] py-3.5 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap" aria-hidden="true">
            {(() => {
              const tickerItems =
                Array.isArray(safeProducts) && safeProducts.length > 0
                  ? safeProducts
                  : [
                      { name: 'Curated Premium Collections' },
                      { name: 'Fast Doorstep Delivery' },
                      { name: 'Instant Web Checkout' },
                      { name: '100% Quality Guaranteed' },
                      { name: 'Cash on Delivery & Secure Pay' },
                      { name: 'Verified Merchant Storefront' },
                    ];
              return (
                <>
                  <div className="flex items-center shrink-0">
                    {tickerItems.map((item: any, i: number) => (
                      <span key={`m1-${item?.id || i}`} className="mx-6 text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-muted)] flex items-center">
                        <span>{item?.name || 'Featured Product'}</span>
                        {item?.price !== undefined && (
                          <span className="ml-2 font-mono font-bold text-[var(--theme-primary)]">
                            · {formatPrice(item.price, biz.currencySymbol)}
                          </span>
                        )}
                        <span className="mx-4 text-[var(--theme-primary)] opacity-40">✦</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center shrink-0" aria-hidden="true">
                    {tickerItems.map((item: any, i: number) => (
                      <span key={`m2-${item?.id || i}`} className="mx-6 text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-muted)] flex items-center">
                        <span>{item?.name || 'Featured Product'}</span>
                        {item?.price !== undefined && (
                          <span className="ml-2 font-mono font-bold text-[var(--theme-primary)]">
                            · {formatPrice(item.price, biz.currencySymbol)}
                          </span>
                        )}
                        <span className="mx-4 text-[var(--theme-primary)] opacity-40">✦</span>
                      </span>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* ── About Section ─────────────────────────────────────────────────── */}
        <section
          id="about"
          className="scroll-mt-28 sm:scroll-mt-32 border-t border-[var(--theme-border)] bg-[var(--theme-surface)] py-16 lg:py-24"
        >
          <FadeInSection>
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
                <div className="lg:col-span-5">
                  <div
                    className="relative overflow-hidden rounded-3xl border bg-[var(--theme-surface-subtle)] motion-safe:animate-float-gentle motion-safe:hover:-translate-y-1 transition-[box-shadow,border-color] duration-300 group"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--theme-border) 45%, transparent)',
                      boxShadow: '0 24px 60px -15px rgba(0,0,0,0.48), 0 0 0 1px color-mix(in srgb, var(--theme-spice) 12%, transparent)',
                    }}
                  >
                    <EditableImage
                      slot="about"
                      src={biz.imageSlots?.about}
                      alt={`${biz.name} studio`}
                      className="aspect-[3/4] w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.02]"
                    />
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <p className="text-xs font-medium text-[var(--theme-text-muted)]">About Our Storefront</p>
                  <h2 className="font-editorial headline-balance mt-3 text-3xl font-semibold tracking-tight text-[var(--theme-text)] sm:text-4xl whitespace-normal break-words [overflow-wrap:anywhere]">
                    {biz.name}
                  </h2>
                  <p className="mt-5 text-base leading-relaxed text-[var(--theme-text-muted)]">
                    {businessInfo?.aboutDescription || DEFAULT_BUSINESS_INFO.aboutDescription || `${biz.tagline} We combine years of specialized craft with dedicated personal attention to deliver an unhurried, exceptional client experience.`}
                  </p>
                  <div className="mt-8 divide-y divide-[var(--theme-border)] border-y border-[var(--theme-border)]">
                    {[
                      (
                        <>
                          <AnimatedCounter end={biz.reviewCount} decimals={0} />+ Satisfied Customers &amp; Orders
                        </>
                      ),
                      `Transparent pricing in ${biz.currency} with zero hidden fees`,
                      `${safeProducts.length > 0 ? safeProducts.length + ' catalog items' : 'Curated products'} available for direct web checkout`,
                    ].map((point, idx) => (
                      <div key={idx} className="flex items-baseline gap-4 py-3.5 text-sm text-[var(--theme-text)]">
                        <span className="text-xs font-semibold text-[var(--theme-primary)] tabular-nums shrink-0">
                          0{idx + 1}.
                        </span>
                        <span className="font-medium">{point}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <a
                      href="#catalog"
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[var(--theme-radius)] bg-[var(--theme-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--theme-on-primary)] whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[var(--theme-primary-hover)] active:scale-[0.99] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)]"
                    >
                      <ShoppingBag className="h-4 w-4 shrink-0 text-[var(--theme-on-primary)]" stroke="currentColor" aria-hidden="true" />
                      <span>Explore Catalog</span>
                    </a>

                    <a
                      href={`tel:${biz.phone.replace(/\s+/g, '')}`}
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[var(--theme-radius)] border border-[var(--theme-border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--theme-text)] whitespace-nowrap shrink-0 transition-colors duration-150 hover:border-[var(--theme-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)]"
                    >
                      <Phone className="h-4 w-4 shrink-0 text-[var(--theme-primary)]" stroke="currentColor" aria-hidden="true" />
                      <span className="tabular-nums">Call {biz.phone}</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </section>

        {/* ── Contact / Direct Support Banner ─────────────────────────────── */}
        <section
          id="contact"
          className="scroll-mt-28 sm:scroll-mt-32 bg-[var(--theme-primary)] text-[var(--theme-on-primary)] py-16 lg:py-20 tracking-[0.01em]"
        >
          <FadeInSection>
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-7">
                  <p className="text-xs font-medium text-[var(--theme-on-primary)] opacity-80">Direct Storefront Assistance</p>
                  <h2 className="font-editorial headline-balance mt-2 text-3xl font-semibold text-[var(--theme-on-primary)] sm:text-4xl">
                    {businessInfo?.ctaHeadline || DEFAULT_BUSINESS_INFO.ctaHeadline || 'Ready to Explore Our Catalog?'}
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--theme-on-primary-muted)]">
                    Browse our full collection online with fast doorstep delivery, or reach out directly for custom orders, wholesale inquiries, and dedicated customer support.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <a
                      href="#catalog"
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--theme-radius)] bg-[var(--theme-on-primary)] px-6 py-3 text-sm font-semibold text-[var(--theme-primary)] whitespace-nowrap shrink-0 hover:brightness-110 active:scale-95 transition-[transform,filter] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-on-primary)]"
                    >
                      <ShoppingBag className="h-4 w-4 shrink-0 text-[var(--theme-primary)]" stroke="currentColor" aria-hidden="true" />
                      <span>Browse Store Catalog</span>
                    </a>

                    <a
                      href={`tel:${biz.phone.replace(/\s+/g, '')}`}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--theme-radius)] border border-[var(--theme-on-primary-border)] px-6 py-3 text-sm font-semibold text-[var(--theme-on-primary)] whitespace-nowrap shrink-0 transition-colors duration-150 hover:border-[var(--theme-on-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)]"
                    >
                      <Phone className="h-4 w-4 shrink-0 text-[var(--theme-on-primary)]" stroke="currentColor" aria-hidden="true" />
                      <span>Call {biz.phone}</span>
                    </a>
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className="divide-y divide-[var(--theme-on-primary-border)] rounded-[var(--theme-radius)] border border-[var(--theme-on-primary-border)] p-6 sm:p-8">
                    <div className="pb-5">
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--theme-on-primary)]">
                        <MapPin className="h-4 w-4 shrink-0 text-[var(--theme-on-primary)]" stroke="currentColor" aria-hidden="true" />
                        <span>Location</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--theme-on-primary)]">
                        {biz.address}
                      </p>
                    </div>

                    <div className="py-5">
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--theme-on-primary)]">
                        <Phone className="h-4 w-4 shrink-0 text-[var(--theme-on-primary)]" stroke="currentColor" aria-hidden="true" />
                        <span>Direct Contact</span>
                      </div>
                      <p className="mt-2 text-sm tabular-nums">
                        <a
                          href={`tel:${biz.phone.replace(/\s+/g, '')}`}
                          className="font-medium text-[var(--theme-on-primary)] hover:underline transition-colors"
                        >
                          {biz.phone}
                        </a>
                      </p>
                    </div>

                    <div className="pt-5">
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--theme-on-primary)]">
                        <Clock className="h-4 w-4 shrink-0 text-[var(--theme-on-primary)]" stroke="currentColor" aria-hidden="true" />
                        <span>Operating Hours</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--theme-on-primary)] tabular-nums">
                        {biz.hours}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--theme-border)] bg-[var(--theme-surface)] py-10 pb-24 mt-auto print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-center lg:px-8">
          <div className="min-w-0 max-w-full">
            <a href="#top" className="font-editorial text-lg sm:text-xl font-semibold text-[var(--theme-text)] whitespace-normal break-words [overflow-wrap:anywhere] block">
              {biz.name}
            </a>
            <p className="mt-1 text-xs text-[var(--theme-text-muted)] tabular-nums whitespace-normal break-words [overflow-wrap:anywhere]">
              {biz.address} · {biz.phone}
            </p>
          </div>

          <nav aria-label="Footer Navigation" className="flex flex-wrap items-center gap-6 text-xs font-medium text-[var(--theme-text-muted)]">
            {[
              { label: 'Catalog', href: '#catalog' },
              { label: 'About', href: '#about' },
              { label: 'Contact', href: '#contact' },
            ].map((link) => (
              <a key={link.href} href={link.href} className="whitespace-nowrap transition-colors hover:text-[var(--theme-text)]">
                {link.label}
              </a>
            ))}
          </nav>

          <p className="text-xs text-[var(--theme-text-subtle)] tabular-nums whitespace-normal break-words [overflow-wrap:anywhere]">
            &copy; {new Date().getFullYear()} {biz.name}. All rights reserved.
          </p>
        </div>

        <div className="w-full shrink-0 relative z-10 flex justify-center pt-8 mt-6 border-t border-[var(--theme-border)]">
          <a 
            href="https://huzada.com" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="Powered by Huzada Tech"
            className="group relative isolation-isolate flex items-center gap-1.5 md:gap-2 text-[var(--theme-text)] opacity-30 hover:opacity-100 transition-opacity duration-500 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-text)] rounded-sm before:absolute before:inset-[-12px] before:content-['']"
          >
            {/* LHS: ASYNC JPEG WITH WEBKIT BLEND ISOLATION */}
            <div className="shrink-0 transform-gpu group-hover:scale-110 transition-transform duration-500 flex items-center justify-center">
              <img 
                src="/huzadalogo.jpeg" 
                alt="Huzada Tech Logo" 
                width="20"
                height="20"
                loading="lazy"
                decoding="async"
                className="w-4 h-4 md:w-5 md:h-5 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen" 
              />
            </div>
            {/* RHS: AGENCY TEXT with leading-none for optical centering */}
            <span className="text-[9px] md:text-[10px] font-bold tracking-[0.25em] leading-none whitespace-nowrap">
              POWERED BY HUZADA TECH
            </span>
          </a>
        </div>
      </footer>
    </div>

    {/* NEW FLOATING CALL BUTTON - TAILWIND SPECIFICITY OVERRIDE */}
    {businessInfo?.phone && (
      <a
        href={`tel:${(businessInfo?.phone || '').toString().replace(/[^0-9+]/g, '')}`}
        className="!fixed !bottom-8 !right-6 md:!bottom-10 md:!right-8 !left-auto !m-0 !z-40 flex items-center justify-center w-14 h-14 bg-[var(--theme-primary)] text-[var(--theme-bg)] rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:brightness-110 active:scale-95 transition-[transform,filter] duration-300 btn-radar isolate touch-manipulation cursor-pointer"
        aria-label="Call Us"
      >
        <Phone className="w-6 h-6 text-[var(--theme-bg)]" />
      </a>
    )}
  </>
  );
}
