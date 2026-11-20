import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Phone,
  ShoppingBag,
  Clock,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import BookingForm from '../components/BookingForm';
import { getStoredBusinessInfo } from '../lib/businessInfo';
import { clientConfig } from '../config/client';

const SERVICE_IMAGE_FALLBACK =
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80';

export const FALLBACK_SERVICES: any[] = [];

function resolveServiceImage(service: any): string {
  const raw =
    (Array.isArray(service?.images) && service.images[0]) ||
    service?.image ||
    service?.image_path ||
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

export default function Services() {
  const [selectedService, setSelectedService] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState("");

  // Business info sync
  const [businessInfo, setBusinessInfo] = useState(() => {
    const stored = getStoredBusinessInfo();
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PKR: 'Rs.', AED: 'AED ', CAD: '$', AUD: '$' };
    const currCode = stored.currency || 'USD';
    const currSym = stored.currencySymbol || symbols[currCode] || '$';
    return {
      ...stored,
      name: stored.name || clientConfig.businessName || 'Huzada Booking',
      tagline: stored.tagline || clientConfig.tagline || 'Professional Appointments Tailored to You',
      whatsapp: stored.whatsapp || clientConfig.whatsappNumber,
      currency: currCode,
      currencySymbol: currSym,
      phone: stored.phone || '',
      address: stored.address || '',
      logo: stored.logo || stored.imageSlots?.logo,
    };
  });

  // Services data sync
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = getStoredBusinessInfo();
      const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PKR: 'Rs.', AED: 'AED ', CAD: '$', AUD: '$' };
      const currCode = stored.currency || 'USD';
      const currSym = stored.currencySymbol || symbols[currCode] || '$';
      setBusinessInfo({
        ...stored,
        name: stored.name || clientConfig.businessName || 'Huzada Booking',
        tagline: stored.tagline || clientConfig.tagline || 'Professional Appointments Tailored to You',
        whatsapp: stored.whatsapp || clientConfig.whatsappNumber,
        currency: currCode,
        currencySymbol: currSym,
        phone: stored.phone || '',
        address: stored.address || '',
        logo: stored.logo || stored.imageSlots?.logo,
      });

      try {
        const saved = localStorage.getItem('huzada_booking_services');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setServices(
              parsed.map((s: any) => ({
                ...s,
                images: Array.isArray(s.images) && s.images.length > 0
                  ? s.images
                  : (s.image ? [s.image] : []),
                duration_minutes: parseInt(String(s.duration || s.duration_minutes || 30), 10) || 30,
              }))
            );
          }
        }
      } catch {
        // Safe ignore
      }
    };

    window.addEventListener('storage', handleStorageChange);

    fetch(`/api/services?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data: any) => {
        if (Array.isArray(data)) {
          setServices(
            data.map((s: any) => ({
              ...s,
              images: Array.isArray(s.images) && s.images.length > 0
                ? s.images
                : (s.image ? [s.image] : []),
              duration_minutes: parseInt(String(s.duration || s.duration_minutes || 30), 10) || 30,
            }))
          );
        }
      })
      .catch(() => {});

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Safely extract and memoize unique categories to prevent render cycling
  const categories = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          (services || [])
            .map(s => s?.category?.trim())
            .filter(c => c && c !== "")
        )
      )
    ];
  }, [services]);

  const filteredServices = useMemo(() => {
    return (services || []).filter((s) => {
      const matchesCategory = activeCategory === "All" || s?.category?.trim() === activeCategory;
      
      const query = searchQuery.toLowerCase();
      const titleMatch = (s?.title || s?.name || "").toLowerCase().includes(query);
      const descMatch = (s?.description || "").toLowerCase().includes(query);
      const matchesSearch = !searchQuery || titleMatch || descMatch;
      
      return matchesCategory && matchesSearch;
    });
  }, [services, activeCategory, searchQuery]);

  return (
    <>
      <div className="min-h-[100dvh] flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)] selection:bg-[var(--theme-primary)] selection:text-[var(--theme-on-primary)] relative overflow-hidden">
        {/* ── Zero-Dependency CSS Theme Variables Layer ───────────────────────── */}
        <style>{`
          :root {
            --theme-primary: #0f172a;
            --theme-primary-hover: #1e293b;
            --theme-accent: var(--theme-primary);
            --theme-accent-soft: color-mix(in srgb, var(--theme-primary) 12%, transparent);
            --theme-surface: color-mix(in srgb, var(--theme-text) 4%, var(--theme-bg));
            --theme-surface-subtle: color-mix(in srgb, var(--theme-text) 8%, var(--theme-bg));
            --theme-surface-translucent: color-mix(in srgb, var(--theme-bg) 94%, transparent);
            --theme-bg: #f8fafc;
            --theme-text: #0f172a;
            --theme-text-muted: color-mix(in srgb, var(--theme-text) 70%, transparent);
            --theme-text-subtle: color-mix(in srgb, var(--theme-text) 50%, transparent);
            --theme-on-primary: var(--theme-bg);
            --theme-on-primary-muted: color-mix(in srgb, var(--theme-bg) 75%, transparent);
            --theme-on-primary-border: color-mix(in srgb, var(--theme-bg) 20%, transparent);
            --theme-border: color-mix(in srgb, var(--theme-text) 15%, transparent);
            --theme-border-strong: color-mix(in srgb, var(--theme-text) 25%, transparent);
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
        `}</style>

        {/* ── ZONE 1: TOP NAVIGATION ────────────────────────────────────────── */}
        <header
          className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md border-b transition-all"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--theme-bg) 75%, transparent)',
            borderColor: 'color-mix(in srgb, var(--theme-text) 10%, transparent)'
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--theme-text)] hover:text-[var(--theme-primary)] transition-colors group"
            >
              <div className="p-2 rounded-full bg-[var(--theme-surface)] border border-[var(--theme-border)] group-hover:border-[var(--theme-primary)] transition-colors shadow-xs">
                <ArrowLeft className="w-4 h-4 text-[var(--theme-text)] group-hover:text-[var(--theme-primary)] transition-colors" stroke="currentColor" />
              </div>
              <span className="hidden sm:inline">Back to Home</span>
            </Link>

            <div className="flex items-center gap-3">
              {businessInfo.logo && (
                <img
                  src={businessInfo.logo}
                  alt={businessInfo.name}
                  className="w-8 h-8 rounded-[var(--theme-radius)] object-cover shrink-0 aspect-square border border-[var(--theme-border)]"
                />
              )}
              <span className="font-editorial text-lg sm:text-xl font-bold text-[var(--theme-text)] truncate max-w-[200px] sm:max-w-xs">
                {businessInfo.name}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/catalog"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] hover:text-[var(--theme-primary)] hover:border-[var(--theme-primary)] transition-colors"
              >
                <span>Store Catalog</span>
              </Link>
            </div>
          </div>
        </header>

        {/* ── ZONE 2: SCROLLABLE MIDDLE & CATALOG CONTENT ────────────────────── */}
        <main className="flex-grow flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[100px] pb-10 sm:pb-16 w-full">
          {/* Header Banner */}
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <span className="inline-block text-xs uppercase tracking-[0.2em] font-bold text-[var(--theme-primary)] mb-3">
              Complete Offerings
            </span>
            <h1 className="font-editorial text-3xl sm:text-5xl font-bold tracking-tight text-[var(--theme-text)]">
              Services Catalog
            </h1>
            <p className="mt-4 text-base sm:text-lg text-[var(--theme-text-muted)] leading-relaxed">
              Explore our complete menu of professional appointments and bespoke care options.
            </p>
          </div>

          {/* SEARCH BAR */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none opacity-50">
              <Search className="h-5 w-5 text-[var(--theme-text)]" />
            </div>
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              className="w-full pl-11 pr-12 py-3 bg-transparent border-2 rounded-2xl text-[var(--theme-text)] placeholder:text-[var(--theme-text)] placeholder:opacity-50 outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-[var(--theme-primary)] shadow-md transition-all"
              style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 20%, transparent)' }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center opacity-50 hover:opacity-100 transition-opacity text-[var(--theme-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Dynamic Category Pill Filters */}
          {categories.length > 1 && (
            <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap mb-10 sm:mb-12">
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-md'
                        : 'bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] hover:border-[var(--theme-primary)] hover:bg-[var(--theme-surface-subtle)]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Services Grid */}
          {filteredServices.length === 0 ? (
            <div className="w-full flex flex-col items-center justify-center py-12 px-4 pb-24 text-center">
              <div className="opacity-20 mb-4">
                <SearchX className="h-12 w-12 text-[var(--theme-text)]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--theme-text)]">No services found</h3>
              <p className="mt-2 text-sm text-[var(--theme-text)] opacity-60">Try adjusting your search or selecting a different category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-6 pb-24">
              {filteredServices.map((service, idx) => {
                const imgSrc = resolveServiceImage(service);
                const priceStr = formatPrice(service.price, businessInfo.currencySymbol);
                const durationStr = service.duration_minutes
                  ? `${service.duration_minutes} mins`
                  : service.duration
                  ? `${service.duration} mins`
                  : null;

                return (
                  <article
                    key={service.id || idx}
                    className="group flex flex-col h-full overflow-hidden isolation-isolate rounded-[var(--theme-radius)] border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-md hover:shadow-xl hover:border-[var(--theme-primary)] transition-all duration-200"
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--theme-surface-subtle)] border-b border-[var(--theme-border)]">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={service.name || 'Service photo'}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div
                          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-3 text-center"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' }}
                        >
                          <ShoppingBag className="h-6 w-6 md:h-8 md:w-8 text-[var(--theme-primary)]" stroke="currentColor" aria-hidden="true" />
                          <span className="mt-1.5 text-xs font-medium text-[var(--theme-text)] line-clamp-1">
                            {service.name}
                          </span>
                        </div>
                      )}
                      {service.badge && (
                        <div className="absolute top-2 right-2 z-10 bg-[var(--theme-surface-translucent)] backdrop-blur-md border border-[var(--theme-border)] px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold text-[var(--theme-primary)] shadow-xs">
                          {service.badge}
                        </div>
                      )}
                    </div>

                    <div className="relative z-10 flex flex-col flex-grow justify-between p-3 md:p-4">
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-[var(--theme-text-subtle)] tabular-nums">
                          <span className="font-semibold text-[var(--theme-primary)]">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="truncate">{service.category || 'Service'}</span>
                          {durationStr && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 shrink-0">
                                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3 text-[var(--theme-primary)]" stroke="currentColor" />
                                {durationStr}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-2">
                          <h2 className="font-editorial font-semibold text-[var(--theme-text)] line-clamp-2 break-words text-sm md:text-base">
                            {service.name}
                          </h2>
                          {priceStr && (
                            <span className="text-sm md:text-base font-semibold text-[var(--theme-text)] tabular-nums shrink-0">
                              {priceStr}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-xs md:text-sm leading-relaxed text-[var(--theme-text-muted)] hidden md:block md:line-clamp-2">
                          {service.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[var(--theme-border)] flex items-center justify-end w-full mt-auto">
                        <button
                          type="button"
                          onClick={() => setSelectedService(service)}
                          className="w-full mt-auto inline-flex min-h-[36px] md:min-h-[40px] items-center justify-center gap-1.5 md:gap-2 rounded-[var(--theme-radius)] bg-[var(--theme-primary)] px-4 py-2 text-xs font-semibold text-[var(--theme-on-primary)] whitespace-nowrap transition-colors duration-150 hover:bg-[var(--theme-primary-hover)] active:scale-[0.99] cursor-pointer"
                        >
                          <span>Book Service</span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--theme-on-primary)]" stroke="currentColor" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {/* ── ZONE 3: FOOTER & BOTTOM-ZONE UI ──────────────────────────────── */}
        <footer className="border-t border-[var(--theme-border)] bg-[var(--theme-surface)] py-10 pb-24 mt-auto print:hidden">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-center lg:px-8">
            <div>
              <Link to="/" className="font-editorial text-xl font-semibold text-[var(--theme-text)] whitespace-nowrap">
                {businessInfo.name}
              </Link>
              <p className="mt-1 text-xs text-[var(--theme-text-muted)] tabular-nums">
                {businessInfo.address ? `${businessInfo.address} · ` : ''}
                {businessInfo.phone}
              </p>
            </div>

            <p className="text-xs text-[var(--theme-text-subtle)] tabular-nums">
              &copy; {new Date().getFullYear()} {businessInfo.name}. All rights reserved.
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

      {/* Floating Action Button: Call Phone */}
      {businessInfo?.phone && (
        <a
          href={`tel:${businessInfo.phone.toString().replace(/[^0-9+]/g, '')}`}
          className="!fixed !bottom-8 !right-6 md:!bottom-10 md:!right-8 !left-auto !m-0 !z-40 flex items-center justify-center w-14 h-14 bg-[var(--theme-primary)] text-[var(--theme-bg)] rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:brightness-110 active:scale-95 transition-all duration-300 btn-radar isolate touch-manipulation cursor-pointer"
          aria-label="Call Us"
        >
          <Phone className="w-6 h-6 text-[var(--theme-bg)]" />
        </a>
      )}

      {/* Booking Form Modal Overlay */}
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
    </>
  );
}
