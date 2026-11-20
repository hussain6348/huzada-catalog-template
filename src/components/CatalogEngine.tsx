import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import type { Product, CartItem } from '../lib/types';
import {
  getStoredProducts,
  fetchCatalogProducts,
  CATALOG_UPDATED_EVENT,
  getProductPrimaryImage,
  handleImageError,
} from '../lib/products';
import { clientConfig } from '../config/client';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';
import { CheckoutModal } from './CheckoutModal';

interface CatalogEngineProps {
  products?: Product[];
  currencySymbol?: string;
  onOrderSuccess?: (orderId: string) => void;
  onOpenLightbox?: (product: Product, index?: number) => void;
}

export function CatalogEngine({
  products: initialProducts,
  currencySymbol,
  onOrderSuccess,
  onOpenLightbox,
}: CatalogEngineProps) {
  const [activeProducts, setActiveProducts] = useState<Product[]>(
    () => (Array.isArray(initialProducts) ? initialProducts : getStoredProducts())
  );

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
    window.addEventListener(CATALOG_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CATALOG_UPDATED_EVENT, handler);
  }, [initialProducts]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');

  const effectiveCurrency = currencySymbol || clientConfig.currencySymbol || 'Rs.';

  // Derived categories safely
  const categories = useMemo(() => {
    if (!Array.isArray(activeProducts)) return ['All'];
    const validCategories = activeProducts
      .map((p) => p?.category)
      .filter((c): c is string => Boolean(c && typeof c === 'string'));
    const unique = Array.from(new Set(validCategories));
    return ['All', ...unique];
  }, [activeProducts]);

  // Filtered & sorted products safely
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(activeProducts)) return [];
    return activeProducts
      .filter((p) => {
        if (!p) return false;
        const matchesCategory =
          selectedCategory === 'All' || p.category === selectedCategory;
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

  // Cart calculations
  const cartItemCount = (cart || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
  const cartTotal = (cart || []).reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: (item.quantity || 1) + 1 } : item
        );
      }
      const primaryImg = getProductPrimaryImage(product);
      return [...prev, { ...product, image: primaryImg, quantity: 1 }];
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
    <div className="w-full max-w-6xl mx-auto space-y-8 font-sans text-[var(--theme-text)]">
      {/* Top Filter & Bag Action Bar */}
      <div className="bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-subtle)]" />
            <input
              type="text"
              placeholder="Search products by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] rounded-[var(--theme-radius-inner)] pl-10 pr-4 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-subtle)] hover:text-[var(--theme-text)] cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Price Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] rounded-[var(--theme-radius-inner)] px-3.5 py-2 pr-8 text-xs font-medium text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 cursor-pointer"
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
              className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] rounded-[var(--theme-radius-inner)] px-4 py-2 text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors shrink-0 cursor-pointer active:scale-95"
            >
              <ShoppingBag className="w-4 h-4 text-[var(--theme-on-primary)]" />
              <span>Bag</span>
              <span className="bg-[var(--theme-on-primary-border)] text-[var(--theme-on-primary)] px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums">
                {cartItemCount}
              </span>
              {cartTotal > 0 && (
                <span className="border-l border-[var(--theme-on-primary-border)] pl-2 font-mono tabular-nums text-[var(--theme-on-primary)]">
                  {effectiveCurrency} {cartTotal.toLocaleString()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-[var(--theme-radius-inner)] text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-xs font-semibold'
                      : 'bg-[var(--theme-surface-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border)] border border-[var(--theme-border)]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Grid / Clean Empty States */}
      {filteredProducts.length === 0 ? (
        <div className="bg-[var(--theme-surface)] rounded-[var(--theme-radius)] border border-[var(--theme-border)] p-12 text-center space-y-3 shadow-xs text-[var(--theme-text)]">
          <Package className="w-12 h-12 text-[var(--theme-text-subtle)] mx-auto opacity-70" />
          <h3 className="text-lg font-semibold text-[var(--theme-text)] font-editorial">
            {activeProducts.length === 0 ? 'Catalog is Empty' : 'No products found'}
          </h3>
          <p className="text-xs text-[var(--theme-text-muted)] max-w-sm mx-auto leading-relaxed">
            {activeProducts.length === 0
              ? 'No products have been published to the catalog yet. Check back soon!'
              : 'Try adjusting your search query or selecting a different category filter.'}
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
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((product) => {
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
      )}

      {/* Slide-over Cart Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[var(--theme-surface)] border-l border-[var(--theme-border)] shadow-2xl flex flex-col justify-between text-[var(--theme-text)]">
              {/* Drawer Header */}
              <div className="p-5 border-b border-[var(--theme-border)] flex items-center justify-between bg-[var(--theme-surface)]">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-[var(--theme-primary)]" />
                  <h2 className="font-semibold text-base text-[var(--theme-text)]">Shopping Bag</h2>
                  <span className="text-xs font-mono text-[var(--theme-text-muted)]">
                    ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'})
                  </span>
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
                          className="flex items-center justify-between gap-3 p-3 rounded-[var(--theme-radius-inner)] border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)]"
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
                              className="w-6 h-6 rounded-[calc(var(--theme-radius-inner)-2px)] bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:bg-[var(--theme-surface-subtle)] flex items-center justify-center text-[var(--theme-text)] transition-colors cursor-pointer"
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
                              className="w-6 h-6 rounded-[calc(var(--theme-radius-inner)-2px)] bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:bg-[var(--theme-surface-subtle)] flex items-center justify-center text-[var(--theme-text)] transition-colors cursor-pointer"
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
                    className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-medium py-3.5 px-4 rounded-[var(--theme-radius-inner)] flex items-center justify-between text-xs transition-all shadow-md active:scale-[0.99] cursor-pointer"
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
