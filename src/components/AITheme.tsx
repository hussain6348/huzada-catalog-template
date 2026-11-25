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

// ─── Fallback image used when a service has no image ─────────────────────────
const SERVICE_IMAGE_FALLBACK =
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80';

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

  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
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
  }, [numericEnd, duration]);

  return <>{displayValue.toFixed(decimals)}</>;
};

// ─── Apple-Style Blur-Fade Scroll Reveal Wrapper ──────────────────────────────
const FadeInSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = domRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setVisible(true);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
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

  const [isThemeReady, setIsThemeReady] = useState(false);
  const [themeLogo, setThemeLogo] = useState<string | null>(null);
  const lastThemeFetchTime = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) setIsThemeReady(true);
    }, 1500);

    const fetchHydratedData = async () => {
      // 1. Throttle: Prevent DB spam from notification shade fidgeting
      const now = Date.now();
      if (now - lastThemeFetchTime.current < 30000) return; 
      lastThemeFetchTime.current = now;

      try {
        // 2. Native fetch with NO CORS preflight penalties
        const res = await fetch(`/api/theme?t=${Date.now()}`, { cache: 'no-store' });
        const raw = await res.json();
        
        // 3. Memory Leak Protection: Abort if unmounted
        if (!isMounted) return;
        
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
          }
        }
      } catch (err) {
        console.error("Hydration failed", err);
      } finally {
        if (isMounted) setIsThemeReady(true);
      }
    };

    // Initial fetch on mount
    fetchHydratedData();

    // BFCache Defeat: Listen for foreground return
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchHydratedData();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Strict Cleanup: Prevent memory leaks
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const activeLogo = themeLogo || businessInfo?.logo || businessInfo?.imageSlots?.logo;

  const defaultHero =
    biz.imageSlots?.hero ||
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80';

  const slideImages = [
    businessInfo?.heroImage?.trim() ? businessInfo.heroImage : defaultHero,
    businessInfo?.heroImage2?.trim()
      ? businessInfo.heroImage2
      : 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800',
    businessInfo?.heroImage3?.trim()
      ? businessInfo.heroImage3
      : 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800',
  ];

  const [hasIntersected, setHasIntersected] = useState(false);
  const [isIntroAnimating, setIsIntroAnimating] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasIntersected(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!hasIntersected) return;

    const timer = setTimeout(() => {
      setIsIntroAnimating(false);
    }, 1500);

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideImages.length);
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [hasIntersected, slideImages.length]);

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
  const handleCardMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (typeof window === 'undefined') return;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || prefersReducedMotion) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    
    e.currentTarget.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleCardMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  };

  const handleCardTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches || e.touches.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleCardTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--mouse-x', `-1000px`);
    e.currentTarget.style.setProperty('--mouse-y', `-1000px`);
  };

  return (
    <>
      <div className={`min-h-[100dvh] flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)] selection:bg-[var(--theme-primary)] selection:text-[var(--theme-on-primary)] relative overflow-x-clip transition-opacity duration-700 ease-in-out ${isThemeReady ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      {/* ── Zero-Dependency CSS Layer ───────────────────────────────────────── */}
      <style>{`
        :root {
          --theme-primary: #0ea5e9;
          --theme-primary-hover: color-mix(in srgb, var(--theme-primary) 85%, #000000);
          --theme-accent: var(--theme-primary);
          --theme-accent-soft: color-mix(in srgb, var(--theme-primary) 14%, transparent);
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
          --font-display: 'Cormorant Garamond', Georgia, serif;
          --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        html { scroll-padding-top: 80px; scroll-behavior: smooth; }

        body {
          font-family: var(--font-body);
        }

        .font-editorial { font-family: var(--font-display); }
        .headline-balance { text-wrap: balance; }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
          background-size: 400px 100%;
          animation: shimmer 2.5s infinite linear;
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 28s linear infinite;
        }
        .animate-marquee:hover { animation-play-state: paused; }

        .glass-glow {
          backdrop-filter: blur(12px);
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 4px 32px color-mix(in srgb, var(--theme-primary) 8%, transparent);
        }

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

        /* 1. Text Shimmer */
        @keyframes text-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .animate-text-shimmer {
          background: linear-gradient(to right, var(--theme-primary) 0%, color-mix(in srgb, var(--theme-primary) 50%, var(--theme-text)) 50%, var(--theme-primary) 100%);
          background-size: 200% auto;
          color: transparent !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          animation: text-shimmer 4s linear infinite;
          display: inline-block;
        }

        /* 2. Aurora Glow */
        @keyframes aurora-pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
        }
        .aurora-blob {
          position: absolute;
          filter: blur(100px);
          border-radius: 50%;
          animation: aurora-pulse 8s ease-in-out infinite;
          will-change: transform, opacity;
        }

        /* 3. Radar Pulse */
        @keyframes radar-ping {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .btn-radar {
          position: relative;
          isolation: isolate;
        }
        .btn-radar::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 2px solid var(--theme-primary);
          border-radius: inherit;
          animation: radar-ping 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
          z-index: -1;
          pointer-events: none;
        }

        /* 1. Apple Blur-Fade Reveal */
        .reveal-blur {
          opacity: 0;
          filter: blur(12px);
          transform: translateY(30px);
          transition: opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1), 
                      filter 0.8s cubic-bezier(0.25, 1, 0.5, 1), 
                      transform 0.8s cubic-bezier(0.25, 1, 0.5, 1);
          will-change: opacity, filter, transform;
        }
        .reveal-visible {
          opacity: 1;
          filter: blur(0);
          transform: translateY(0);
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
      `}</style>

      {/* ── True Glassmorphic Sticky Header & Marquee Wrapper ──────────────── */}
      <div
        className="sticky top-0 z-40 w-full backdrop-blur-md border-b transition-all"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--theme-bg) 75%, transparent)',
          borderColor: 'color-mix(in srgb, var(--theme-text) 10%, transparent)'
        }}
      >
        {/* ── Top-Level Marquee Announcement Bar ───────────────────────────────── */}
        <div
          className="w-full overflow-hidden py-2 border-b select-none relative"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--theme-text) 6%, transparent)',
            color: 'var(--theme-text)',
            borderColor: 'color-mix(in srgb, var(--theme-text) 10%, transparent)'
          }}
        >
          <div className="animate-marquee whitespace-nowrap">
            <div className="flex items-center shrink-0">
              <span className="mx-8 text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
              <span className="mx-8 text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
              <span className="mx-8 text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
              <span className="mx-8 text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
            </div>
            <div className="flex items-center shrink-0" aria-hidden="true">
              <span className="mx-8 text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
              <span className="mx-8 text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
              <span className="mx-8 text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
              <span className="mx-8 text-sm font-semibold tracking-wider uppercase inline-flex items-center gap-3">
                {promoText}
              </span>
            </div>
          </div>
        </div>

        {/* ── Navigation Bar ──────────────────────────────────────────────────── */}
        <header className="min-h-16 py-2.5 relative flex items-center">
          <div className="w-full max-w-7xl mx-auto px-4 min-h-16 flex items-center justify-between gap-2 sm:gap-3">
            {/* Left: Logo + Business Name (flex-1 with min-w-0 flex container) */}
            <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
              {activeLogo && (
                <img 
                  src={activeLogo} 
                  alt="Logo" 
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
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl border border-[var(--theme-border-strong)] text-[var(--theme-text)] font-semibold text-sm hover:border-[var(--theme-text)] transition-all cursor-pointer"
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
            borderColor: 'color-mix(in srgb, var(--theme-border) 40%, transparent)',
            boxShadow: '0 24px 60px -15px rgba(0,0,0,0.5)',
          }}
        >
          {/* Full-Bleed Slideshow Background Layer */}
          <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0">
            {/* Themed gradient & aurora fallback layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-surface)] to-[var(--theme-bg)] z-0" />

            {/* HARDWARE-ACCELERATED NEON PATTERN */}
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                backgroundImage: `radial-gradient(color-mix(in srgb, var(--theme-primary) 70%, transparent) 2px, transparent 2px)`,
                backgroundSize: '32px 32px',
                filter: 'drop-shadow(0 0 4px var(--theme-primary))',
                transform: 'translateZ(0)',
                opacity: 0.35,
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
              }}
            />

            {/* Aurora Glow Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              <div className="aurora-blob bg-[var(--theme-primary)] w-[30rem] h-[30rem] -top-32 -left-32 opacity-25"></div>
              <div
                className="aurora-blob bg-[var(--theme-primary)] w-[30rem] h-[30rem] top-32 -right-32 opacity-20"
                style={{ animationDelay: '2s' }}
              ></div>
            </div>

            {/* Slideshow Images with Smooth Transitions and Gentle Drift */}
            {slideImages.map((src, index) => {
              const isCurrent = currentSlide === index;
              return (
                <img
                  key={index}
                  src={src}
                  alt={`${biz.name} visual ${index + 1}`}
                  draggable={false}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out motion-safe:scale-[1.03] select-none ${
                    isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                />
              );
            })}
          </div>

          {/* Silky Edge-Free Readability Scrim (Full-bleed photo shines unobstructed on right/top) */}
          <div className="absolute inset-0 pointer-events-none z-[1] bg-gradient-to-t from-black/85 via-black/40 to-black/15 md:bg-gradient-to-r md:from-black/80 md:via-black/40 md:to-transparent" />

          {/* Weightless Floating Left-Aligned Content Stage (No bulky frosted box) */}
          <div className="relative z-10 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-18">
            <div
              ref={heroRef}
              className="w-full max-w-xl lg:max-w-2xl py-2 sm:py-4"
            >
              {/* Slim Glass Trust Pill */}
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium backdrop-blur-sm bg-white/10 border border-white/20 text-white/90 shadow-sm">
                <span>{biz.address.split(',').slice(-2).join(',').trim()}</span>
                <span aria-hidden="true" className="text-white/50">·</span>
                <span className="tabular-nums font-semibold text-white">
                  <AnimatedCounter end={biz.rating} decimals={1} /> ★ Rated
                </span>
              </div>

              {/* Crisp Editorial Headline with Ambient Drop Shadow */}
              <h1 className="font-editorial headline-balance mt-4 text-[clamp(2.1rem,4.2vw,3.6rem)] font-semibold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] whitespace-normal break-words [overflow-wrap:anywhere]">
                {businessInfo?.heroHeadline || DEFAULT_BUSINESS_INFO.heroHeadline || biz.tagline}
              </h1>

              {/* Clean Luminous Subheadline */}
              <p className="mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-white/85 whitespace-normal break-words [overflow-wrap:anywhere] drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
                {businessInfo?.heroSubheadline || DEFAULT_BUSINESS_INFO.heroSubheadline ||
                  'Explore our handpicked catalog of premium items with transparent pricing, instant web order placement, and direct doorstep delivery.'}
              </p>

              {/* Sleek Side-by-Side CTAs & Contact Meta */}
              <div className="mt-7 pt-5 border-t border-white/15">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {/* High-Contrast Primary Pill Button */}
                  <a
                    href="#catalog"
                    className="inline-flex min-h-[46px] sm:min-h-[48px] items-center justify-center gap-2.5 rounded-full bg-[var(--theme-primary)] px-6 sm:px-7 py-2.5 sm:py-3 text-sm font-semibold text-[var(--theme-on-primary)] whitespace-nowrap shrink-0 transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer shadow-lg hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)]"
                  >
                    <ShoppingBag className="h-4 w-4 shrink-0 text-[var(--theme-on-primary)]" stroke="currentColor" aria-hidden="true" />
                    <span>Explore Catalog</span>
                  </a>

                  {/* Translucent Secondary Glass Pill Button */}
                  <a
                    href="#contact"
                    className="inline-flex min-h-[46px] sm:min-h-[48px] items-center justify-center gap-2 rounded-full backdrop-blur-sm bg-white/10 border border-white/25 px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-all duration-200 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-8 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md bg-black/40 border border-white/20 shadow-lg">
              {slideImages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Go to visual slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    currentSlide === idx
                      ? 'w-6 bg-[var(--theme-primary)]'
                      : 'w-1.5 bg-white/50 hover:bg-white'
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
            <div className="grid grid-cols-1 divide-y divide-[var(--theme-border)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] bg-[var(--theme-surface)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4 shadow-sm">
              {[
                {
                  value: (
                    <>
                      <AnimatedCounter end={biz.rating} decimals={1} /> / 5.0
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
                <div key={mIdx} className="p-6">
                  <p className="font-editorial text-2xl font-semibold tracking-tight text-[var(--theme-text)] tabular-nums">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--theme-text)]">{metric.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--theme-text-muted)] tabular-nums">{metric.detail}</p>
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
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--theme-primary)] text-[var(--theme-on-primary)] mb-2.5 shadow-xs">
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--theme-radius-inner)] bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold shadow-xs hover:shadow-md transition-all active:scale-95"
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
          <div className="flex animate-marquee whitespace-nowrap" aria-hidden="true">
            {(safeProducts.length > 0
              ? [...safeProducts, ...safeProducts]
              : [
                  { name: 'Curated Premium Collections' },
                  { name: 'Fast Doorstep Delivery' },
                  { name: 'Instant Web Checkout' },
                  { name: '100% Quality Guaranteed' },
                  { name: 'Cash on Delivery & Secure Pay' },
                  { name: 'Verified Merchant Storefront' },
                ]
            ).map((item: any, i: number) => (
              <span key={i} className="mx-6 text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-muted)] flex items-center">
                <span>{item.name}</span>
                {item.price !== undefined && (
                  <span className="ml-2 font-mono font-bold text-[var(--theme-primary)]">
                    · {formatPrice(item.price, biz.currencySymbol)}
                  </span>
                )}
                <span className="mx-4 text-[var(--theme-primary)] opacity-40">✦</span>
              </span>
            ))}
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
                  <div className="overflow-hidden rounded-[var(--theme-radius)] border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)]">
                    <EditableImage
                      slot="about"
                      src={biz.imageSlots?.about}
                      alt={`${biz.name} studio`}
                      className="aspect-[3/4] w-full object-cover"
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
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--theme-radius)] bg-[var(--theme-on-primary)] px-6 py-3 text-sm font-semibold text-[var(--theme-primary)] whitespace-nowrap shrink-0 hover:brightness-110 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-on-primary)]"
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
        className="!fixed !bottom-8 !right-6 md:!bottom-10 md:!right-8 !left-auto !m-0 !z-40 flex items-center justify-center w-14 h-14 bg-[var(--theme-primary)] text-[var(--theme-bg)] rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:brightness-110 active:scale-95 transition-all duration-300 btn-radar isolate touch-manipulation cursor-pointer"
        aria-label="Call Us"
      >
        <Phone className="w-6 h-6 text-[var(--theme-bg)]" />
      </a>
    )}
  </>
  );
}
