import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  ArrowRight,
  SlidersHorizontal,
  Package,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { Product, CartItem } from '../lib/types';
import {
  getStoredProducts,
  fetchCatalogProducts,
  CATALOG_UPDATED_EVENT,
  getProductPrimaryImage,
  handleImageError,
  selectCategoryDividedProducts,
} from '../lib/products';
import { clientConfig } from '../config/client';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';
import { CheckoutModal } from './CheckoutModal';

export interface CatalogEngineProps {
  products?: Product[];
  currencySymbol?: string;
  onOrderSuccess?: (orderId: string) => void;
  onOpenLightbox?: (product: Product, index?: number) => void;
  layoutMode?: 'home-preview' | 'all-products';
  maxProducts?: number;
  pageSize?: number;
}

export function CatalogEngine({
  products: initialProducts,
  currencySymbol,
  onOrderSuccess,
  onOpenLightbox,
  layoutMode = 'all-products',
  maxProducts = 8,
  pageSize = 6,
}: CatalogEngineProps) {
  const [activeProducts, setActiveProducts] = useState<Product[]>(
    () => (Array.isArray(initialProducts) ? initialProducts : getStoredProducts())
  );

  const productsTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialProducts) {
      setActiveProducts(initialProducts);
      return;
    }

    fetchCatalogProducts().then((items) => {
      if (Array.isArray(items)) {
        setActiveProducts(items);
      }
    });

    const handler = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setActiveProducts(e.detail);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(CATALOG_UPDATED_EVENT, handler);
      return () => window.removeEventListener(CATALOG_UPDATED_EVENT, handler);
    }
  }, [initialProducts]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const effectiveCurrency = currencySymbol || clientConfig.currencySymbol || 'Rs.';

  // Derived category list with accurate product counts
  const { categories, categoryCounts } = useMemo(() => {
    if (!Array.isArray(activeProducts)) {
      return { categories: ['All'], categoryCounts: { All: 0 } as Record<string, number> };
    }
    const counts: Record<string, number> = { All: activeProducts.length };
    const validCats = new Set<string>();

    for (const p of activeProducts) {
      if (!p) continue;
      const cat = p.category?.trim() || 'General';
      validCats.add(cat);
      counts[cat] = (counts[cat] || 0) + 1;
    }

    return {
      categories: ['All', ...Array.from(validCats)],
      categoryCounts: counts,
    };
  }, [activeProducts]);

  // Reset pagination to page 1 whenever category or search filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, sortBy]);

  // Full filtered & sorted products set
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(activeProducts)) return [];
    return activeProducts
      .filter((p) => {
        if (!p) return false;
        const matchesCategory =
          selectedCategory === 'All' || (p.category?.trim() || 'General') === selectedCategory;
        const nameMatch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const descMatch = (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && (nameMatch || descMatch);
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return (a.price || 0) - (b.price || 0);
        if (sortBy === 'price-desc') return (b.price || 0) - (a.price || 0);
        return 0;
      });
  }, [activeProducts, selectedCategory, searchQuery, sortBy]);

  // Main Page (home-preview) Selection: at most 8 latest products divided across categories
  const homeCategoryDividedProducts = useMemo(() => {
    if (layoutMode !== 'home-preview') return [];
    // If user is actively searching or filtering a category on home, respect that filtered slice
    if (searchQuery.trim() || selectedCategory !== 'All') {
      return filteredProducts.slice(0, maxProducts);
    }
    // Default home view: run category-divided algorithm across available categories
    return selectCategoryDividedProducts(activeProducts, maxProducts);
  }, [layoutMode, activeProducts, filteredProducts, searchQuery, selectedCategory, maxProducts]);

  // Bounded Pagination for All Products View
  const boundedPageSize = Math.max(1, Math.min(24, pageSize || 6));
  const totalPages = Math.ceil(filteredProducts.length / boundedPageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProducts = useMemo(() => {
    if (layoutMode === 'home-preview') {
      return homeCategoryDividedProducts;
    }
    const startIndex = (safeCurrentPage - 1) * boundedPageSize;
    return filteredProducts.slice(startIndex, startIndex + boundedPageSize);
  }, [layoutMode, homeCategoryDividedProducts, filteredProducts, safeCurrentPage, boundedPageSize]);

  // Smart, responsive pagination numbers (never overflows screens on large catalogs)
  const paginationPages = useMemo<(number | string)[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (safeCurrentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages];
  }, [totalPages, safeCurrentPage]);

  // Page change handler with smooth container scroll
  const handlePageChange = (newPage: number) => {
    const target = Math.min(Math.max(1, newPage), totalPages);
    setCurrentPage(target);
    if (productsTopRef.current && typeof window !== 'undefined') {
      const topOffset = productsTopRef.current.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
    }
  };

  // Cart calculations
  const cartItemCount = useMemo(() => {
    if (!Array.isArray(cart)) return 0;
    return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    if (!Array.isArray(cart)) return 0;
    return cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          image: getProductPrimaryImage(product),
          images: product.images,
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleOpenCheckout = () => {
    setIsDrawerOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <div ref={productsTopRef} className="w-full space-y-8 font-sans text-[var(--theme-text)]">
      {/* ──────────────────────────────────────────────────────────────────────────
          ALL PRODUCTS VIEW: Two-Pane Layout (Left Sidebar + Paginated Right Pane)
      ────────────────────────────────────────────────────────────────────────── */}
      {layoutMode === 'all-products' ? (
        <div className="flex flex-col lg:flex-row items-start gap-8">
          {/* LEFT SIDEBAR: Category Navigation Tabs */}
          <aside className="w-full lg:w-64 lg:shrink-0 space-y-4">
            <div className="bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] p-4 sm:p-5 shadow-xs lg:sticky lg:top-20">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[var(--theme-border)]">
                <Layers className="w-4 h-4 text-[var(--theme-primary)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)] font-mono">
                  Categories
                </h3>
                <span className="text-[11px] font-mono text-[var(--theme-text-muted)] ml-auto">
                  {categories.length - 1} total
                </span>
              </div>

              {/* Category Tab Rail: Vertical on desktop, smooth horizontal scroll on mobile */}
              <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 no-scrollbar">
                {categories.map((cat) => {
                  const isActive = selectedCategory === cat;
                  const count = categoryCounts[cat] || 0;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        if (typeof window !== 'undefined' && window.innerWidth < 1024 && productsTopRef.current) {
                          const offset = productsTopRef.current.getBoundingClientRect().top + window.scrollY - 80;
                          window.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
                        }
                      }}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[var(--theme-radius-inner)] text-xs font-medium transition-all duration-150 cursor-pointer text-left whitespace-nowrap lg:whitespace-normal shrink-0 lg:shrink ${
                        isActive
                          ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-sm font-semibold'
                          : 'bg-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface-subtle)]'
                      }`}
                    >
                      <span className="truncate">{cat === 'All' ? 'All Products' : cat}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full transition-colors ${
                          isActive
                            ? 'bg-[var(--theme-on-primary-border)] text-[var(--theme-on-primary)]'
                            : 'bg-[var(--theme-surface-subtle)] text-[var(--theme-text-subtle)] border border-[var(--theme-border)]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* RIGHT PANE: Search, Controls, Product Grid & Bounded Pagination */}
          <main className="flex-1 w-full min-w-0 space-y-6">
            {/* Search, Sort & Cart Action Bar */}
            <div className="bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Field */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-subtle)]" />
                  <input
                    type="text"
                    placeholder="Search by product title or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] rounded-[var(--theme-radius-inner)] pl-10 pr-9 text-xs sm:text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-subtle)] hover:text-[var(--theme-text)] cursor-pointer p-0.5"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Price Sort Dropdown */}
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="h-10 appearance-none bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] rounded-[var(--theme-radius-inner)] pl-3.5 pr-8 text-xs font-medium text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 cursor-pointer transition-colors"
                    >
                      <option value="featured">Featured Sort</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                    </select>
                    <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--theme-text-subtle)] pointer-events-none" />
                  </div>

                  {/* Cart Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    className="h-10 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] rounded-[var(--theme-radius-inner)] px-4 text-xs font-semibold flex items-center gap-2 shadow-xs hover:shadow-md transition-all shrink-0 cursor-pointer active:scale-95"
                  >
                    <ShoppingBag className="w-4 h-4 text-[var(--theme-on-primary)]" />
                    <span>Bag</span>
                    <span className="bg-[var(--theme-on-primary-border)] text-[var(--theme-on-primary)] px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums">
                      {cartItemCount}
                    </span>
                    {cartTotal > 0 && (
                      <span className="border-l border-[var(--theme-on-primary-border)] pl-2 font-mono tabular-nums text-[var(--theme-on-primary)] hidden sm:inline">
                        {effectiveCurrency} {cartTotal.toLocaleString()}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Active Filter Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--theme-border)] text-xs text-[var(--theme-text-muted)]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[var(--theme-text)]">
                    {selectedCategory === 'All' ? 'All Catalog Products' : selectedCategory}
                  </span>
                  <span>·</span>
                  <span>{filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} found</span>
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--theme-surface-subtle)] text-[var(--theme-text-subtle)] border border-[var(--theme-border)]">
                      <span>"{searchQuery}"</span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="hover:text-[var(--theme-text)] cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>

                {filteredProducts.length > 0 && (
                  <span className="text-[11px] font-mono text-[var(--theme-text-subtle)]">
                    Showing {(safeCurrentPage - 1) * boundedPageSize + 1}–{Math.min(safeCurrentPage * boundedPageSize, filteredProducts.length)} of {filteredProducts.length}
                  </span>
                )}
              </div>
            </div>

            {/* Paginated Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] p-12 text-center space-y-3 shadow-xs">
                <Package className="w-12 h-12 text-[var(--theme-text-subtle)] mx-auto opacity-50" />
                <h3 className="text-base font-semibold text-[var(--theme-text)]">
                  {activeProducts.length === 0 ? 'No Products Available' : 'No matching products found'}
                </h3>
                <p className="text-xs text-[var(--theme-text-muted)] max-w-sm mx-auto leading-relaxed">
                  {activeProducts.length === 0
                    ? 'Our storefront catalog is currently empty. Check back soon for new arrivals.'
                    : 'Try clearing your search query or selecting a different category from the sidebar.'}
                </p>
                {activeProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="text-xs font-semibold text-[var(--theme-primary)] hover:underline pt-2 cursor-pointer inline-flex items-center gap-1"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {paginatedProducts.map((product) => {
                    const inCart = (cart || []).find((i) => i.id === product.id);
                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        inCart={inCart}
                        currencySymbol={effectiveCurrency}
                        onAddToCart={() => addToCart(product)}
                        onUpdateQuantity={(delta) => updateQuantity(product.id, delta)}
                        onSelect={() => setSelectedProduct(product)}
                        onOpenLightbox={onOpenLightbox}
                      />
                    );
                  })}
                </div>

                {/* BOUNDED PAGINATION CONTROLS BAR (Never renders all items at once) */}
                {totalPages > 1 && (
                  <div className="bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                    <span className="text-xs text-[var(--theme-text-muted)] font-mono">
                      Showing {(safeCurrentPage - 1) * boundedPageSize + 1}–
                      {Math.min(safeCurrentPage * boundedPageSize, filteredProducts.length)} of{' '}
                      {filteredProducts.length} items
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePageChange(safeCurrentPage - 1)}
                        disabled={safeCurrentPage <= 1}
                        className="px-3 py-1.5 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] bg-[var(--theme-surface-subtle)] hover:bg-[var(--theme-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {paginationPages.map((p, idx) => {
                          if (p === '...') {
                            return (
                              <span
                                key={`ellipsis-${idx}`}
                                className="w-8 h-8 flex items-center justify-center text-xs font-mono text-[var(--theme-text-subtle)]"
                              >
                                …
                              </span>
                            );
                          }
                          const pageNum = p as number;
                          const isCurrent = pageNum === safeCurrentPage;
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => handlePageChange(pageNum)}
                              className={`w-8 h-8 rounded-[var(--theme-radius-inner)] text-xs font-mono font-semibold transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-sm'
                                  : 'bg-[var(--theme-surface-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border)] border border-[var(--theme-border)]'
                              }`}
                              aria-label={`Go to page ${pageNum}`}
                              aria-current={isCurrent ? 'page' : undefined}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePageChange(safeCurrentPage + 1)}
                        disabled={safeCurrentPage >= totalPages}
                        className="px-3 py-1.5 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] bg-[var(--theme-surface-subtle)] hover:bg-[var(--theme-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        aria-label="Next page"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      ) : (
        /* ──────────────────────────────────────────────────────────────────────────
           HOME PREVIEW MODE: Up to 8 Latest Products Divided Across Categories
        ────────────────────────────────────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Quick Category Filter Bar */}
          <div className="bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-subtle)] font-mono">
                  Curated Catalog Preview
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--theme-surface-subtle)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
                  {paginatedProducts.length} of {activeProducts.length} items
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {/* View All Products Link Button in Header */}
                <Link
                  to="/catalog"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--theme-radius-inner)] bg-[var(--theme-surface-subtle)] hover:bg-[var(--theme-surface)] text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)] text-xs font-semibold border border-[var(--theme-border)] transition-all cursor-pointer shadow-xs"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>View All Products</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                {/* Cart Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] rounded-[var(--theme-radius-inner)] px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[var(--theme-on-primary)]" />
                  <span>Bag ({cartItemCount})</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills on Home */}
            {categories.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-[var(--theme-radius-inner)] text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer active:scale-95 ${
                        active
                          ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-xs font-semibold'
                          : 'bg-[var(--theme-surface-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border)] border border-[var(--theme-border)]'
                      }`}
                    >
                      {cat === 'All' ? 'All Featured (8 max)' : cat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 8-Product Grid */}
          {paginatedProducts.length === 0 ? (
            <div className="bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] p-12 text-center space-y-3 shadow-xs">
              <Package className="w-12 h-12 text-[var(--theme-text-subtle)] mx-auto opacity-50" />
              <h3 className="text-base font-semibold text-[var(--theme-text)]">
                No Products Available
              </h3>
              <p className="text-xs text-[var(--theme-text-muted)] max-w-sm mx-auto leading-relaxed">
                Our storefront catalog currently has no items listed. Check back soon for new arrivals.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {paginatedProducts.map((product) => {
                  const inCart = (cart || []).find((i) => i.id === product.id);
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      inCart={inCart}
                      currencySymbol={effectiveCurrency}
                      onAddToCart={() => addToCart(product)}
                      onUpdateQuantity={(delta) => updateQuantity(product.id, delta)}
                      onSelect={() => setSelectedProduct(product)}
                      onOpenLightbox={onOpenLightbox}
                    />
                  );
                })}
              </div>

              {/* High-Converting "View All Products" Banner & Navigation */}
              {activeProducts.length > 0 && (
                <div className="p-6 sm:p-8 rounded-[var(--theme-radius)] bg-[var(--theme-surface)] border border-[var(--theme-border)] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--theme-surface-subtle)] text-[var(--theme-primary)] border border-[var(--theme-border)] mb-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Full Storefront Collection</span>
                    </div>
                    <h4 className="font-editorial text-xl sm:text-2xl font-bold text-[var(--theme-text)]">
                      Explore Our Complete Catalog
                    </h4>
                    <p className="text-xs text-[var(--theme-text-muted)] max-w-md leading-relaxed">
                      Showing up to {paginatedProducts.length} latest highlights across categories. Browse all {activeProducts.length} items with our category rail and paginated search.
                    </p>
                  </div>

                  <Link
                    to="/catalog"
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-[var(--theme-radius-inner)] bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>View All Products ({activeProducts.length})</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 3D Elevated Floating Shopping Bag Button (Tactile Quick-Access) ──── */}
      {cartItemCount > 0 && (
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="!fixed !bottom-8 !left-6 md:!bottom-10 md:!left-8 !z-40 flex items-center gap-2.5 px-4.5 py-3 bg-[var(--theme-primary)] text-[var(--theme-on-primary)] rounded-full shadow-[0_10px_35px_rgba(0,0,0,0.3)] hover:brightness-110 active:scale-95 transition-all duration-300 btn-radar isolate touch-manipulation cursor-pointer border border-[var(--theme-on-primary-border)]"
          aria-label={`Open shopping bag with ${cartItemCount} items`}
        >
          <ShoppingBag className="w-5 h-5 text-[var(--theme-on-primary)]" />
          <span className="text-xs font-bold font-mono">
            {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
          </span>
          <span className="border-l border-[var(--theme-on-primary-border)] pl-2 text-xs font-mono font-bold tabular-nums">
            {effectiveCurrency} {cartTotal.toLocaleString()}
          </span>
        </button>
      )}

      {/* ── Slide-over Cart Drawer with 3D Slide & Backdrop Blur ─────────────── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          {/* Backdrop with Blur */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[var(--theme-surface)] border-l border-[var(--theme-border)] shadow-2xl flex flex-col justify-between text-[var(--theme-text)] animate-in slide-in-from-right duration-300 ease-out">
              {/* Drawer Header */}
              <div className="p-5 border-b border-[var(--theme-border)] flex items-center justify-between bg-[var(--theme-surface)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-primary)]">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base text-[var(--theme-text)]">Shopping Bag</h2>
                    <span className="text-xs font-mono text-[var(--theme-text-muted)]">
                      {cartItemCount} {cartItemCount === 1 ? 'product' : 'products'} selected
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-[var(--theme-radius-inner)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface-subtle)] transition-colors cursor-pointer"
                  aria-label="Close cart drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--theme-border)] p-5 space-y-3 bg-[var(--theme-surface)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-subtle)] font-mono">
                  Selected Items
                </h4>

                {(!cart || cart.length === 0) ? (
                  <div className="py-16 text-center space-y-2">
                    <ShoppingBag className="w-10 h-10 text-[var(--theme-text-subtle)] mx-auto opacity-50" />
                    <p className="text-sm font-medium text-[var(--theme-text)]">Your bag is empty.</p>
                    <p className="text-xs text-[var(--theme-text-muted)] max-w-xs mx-auto leading-relaxed">
                      Explore our products and add items to your bag to proceed with checkout.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {cart.map((item) => {
                      const itemImg = getProductPrimaryImage(item);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] hover:border-[var(--theme-border-strong)] transition-colors"
                        >
                          <img
                            src={itemImg}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            onError={handleImageError}
                            className="w-12 h-12 aspect-square rounded-[calc(var(--theme-radius-inner)-2px)] object-cover bg-[var(--theme-surface)] shrink-0 border border-[var(--theme-border)]"
                          />

                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-semibold text-[var(--theme-text)] truncate">
                              {item.name}
                            </h5>
                            <p className="text-[11px] text-[var(--theme-text-muted)] font-mono tabular-nums">
                              {effectiveCurrency} {item.price.toLocaleString()} ×{' '}
                              {item.quantity}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-6 h-6 rounded-[calc(var(--theme-radius-inner)-2px)] bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:bg-[var(--theme-surface-subtle)] flex items-center justify-center text-[var(--theme-text)] transition-all cursor-pointer active:scale-90"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-xs font-mono tabular-nums px-1 font-semibold text-[var(--theme-text)]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-6 h-6 rounded-[calc(var(--theme-radius-inner)-2px)] bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:bg-[var(--theme-surface-subtle)] flex items-center justify-center text-[var(--theme-text)] transition-all cursor-pointer active:scale-90"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className="ml-1 text-[var(--theme-text-subtle)] hover:text-red-500 p-1 transition-colors cursor-pointer"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Drawer Footer & Checkout Trigger */}
              {cart && cart.length > 0 && (
                <div className="p-5 border-t border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] space-y-3">
                  <div className="flex items-center justify-between text-xs text-[var(--theme-text-muted)]">
                    <span>Shipping</span>
                    <span className="font-semibold text-[var(--theme-primary)]">Standard Free Delivery</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--theme-border)]">
                    <span className="text-sm font-semibold text-[var(--theme-text)]">Total Payable</span>
                    <span className="text-base font-bold text-[var(--theme-text)] font-mono tabular-nums">
                      {effectiveCurrency} {cartTotal.toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenCheckout}
                    className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-medium py-3.5 px-4 rounded-[var(--theme-radius-inner)] flex items-center justify-between text-xs transition-all shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-[var(--theme-on-primary)]" />
                      <span>Proceed to Checkout</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--theme-on-primary)]" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      <ProductModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        currencySymbol={effectiveCurrency}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(prod) => addToCart(prod)}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        total={cartTotal}
        currencySymbol={effectiveCurrency}
        onComplete={() => {
          setCart([]);
          setIsCheckoutOpen(false);
          onOrderSuccess?.('confirmed');
        }}
      />
    </div>
  );
}

export default CatalogEngine;
