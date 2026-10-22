import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  ArrowRight,
  MessageCircle,
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
  onOrderSuccess?: (orderId: string) => void;
  onOpenLightbox?: (product: Product, index?: number) => void;
}

export function CatalogEngine({
  products: initialProducts,
  onOrderSuccess,
  onOpenLightbox,
}: CatalogEngineProps) {
  const [activeProducts, setActiveProducts] = useState<Product[]>(
    () => initialProducts || getStoredProducts()
  );

  useEffect(() => {
    if (initialProducts) {
      setActiveProducts(initialProducts);
      return;
    }

    fetchCatalogProducts().then((items) => {
      setActiveProducts(items);
    });

    const handler = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
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

  // Derived categories
  const categories = useMemo(() => {
    const list = Array.from(new Set(activeProducts.map((p) => p.category)));
    return ['All', ...list];
  }, [activeProducts]);

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    return activeProducts
      .filter((p) => {
        const matchesCategory =
          selectedCategory === 'All' || p.category === selectedCategory;
        const matchesQuery =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        return 0;
      });
  }, [activeProducts, selectedCategory, searchQuery, sortBy]);

  // Cart calculations
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
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
    <div className="w-full max-w-6xl mx-auto space-y-8 font-sans">
      {/* Top Filter & Bag Action Bar */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search products by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
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
                className="appearance-none bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 pr-8 text-xs font-medium text-zinc-700 hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
              >
                <option value="featured">Featured Sort</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
              <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>

            {/* Cart Trigger Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              <span>Bag</span>
              <span className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums">
                {cartItemCount}
              </span>
              {cartTotal > 0 && (
                <span className="border-l border-zinc-700 pl-2 font-mono tabular-nums text-zinc-300">
                  {clientConfig.currencySymbol} {cartTotal.toLocaleString()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center space-y-3">
          <Package className="w-10 h-10 text-zinc-400 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-900">No products found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Try adjusting your search query or selecting a different category filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="text-xs font-medium text-zinc-900 hover:underline pt-2 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((product) => {
            const inCart = cart.find((i) => i.id === product.id);
            return (
              <ProductCard
                key={product.id}
                product={product}
                inCart={inCart}
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
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs transition-opacity duration-300"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white border-l border-zinc-200 shadow-2xl flex flex-col justify-between">
              {/* Drawer Header */}
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-base text-zinc-900">Shopping Bag</h2>
                  <span className="text-xs font-mono text-zinc-500">
                    ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'})
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                  aria-label="Close cart drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                  Selected Items
                </h4>

                {cart.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <ShoppingBag className="w-10 h-10 text-zinc-300 mx-auto" />
                    <p className="text-sm font-medium text-zinc-700">Your bag is empty.</p>
                    <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                      Explore our catalog and add items to your bag to proceed with WhatsApp checkout.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {cart.map((item) => {
                      const itemImg = getProductPrimaryImage(item);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50"
                        >
                          <img
                            src={itemImg}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            onError={handleImageError}
                            className="w-12 h-12 aspect-square rounded-lg object-cover bg-zinc-200 shrink-0 border border-zinc-200/60"
                          />

                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-semibold text-zinc-900 truncate">
                              {item.name}
                            </h5>
                            <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
                              {clientConfig.currencySymbol} {item.price.toLocaleString()} ×{' '}
                              {item.quantity}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-6 h-6 rounded bg-white border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-xs font-mono tabular-nums px-1 font-semibold">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-6 h-6 rounded bg-white border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="ml-1 text-zinc-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
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
              {cart.length > 0 && (
                <div className="p-5 border-t border-zinc-100 bg-zinc-50/70 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Shipping</span>
                    <span className="font-medium text-emerald-600">Standard Free Delivery</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-200">
                    <span className="text-sm font-semibold text-zinc-900">Total Payable</span>
                    <span className="text-base font-bold text-zinc-900 font-mono tabular-nums">
                      {clientConfig.currencySymbol} {cartTotal.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={handleOpenCheckout}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3.5 px-4 rounded-xl flex items-center justify-between text-xs transition-all shadow-md shadow-emerald-600/20 active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 fill-current" />
                      <span>Proceed to WhatsApp Checkout</span>
                    </div>
                    <ArrowRight className="w-4 h-4" />
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
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(prod) => addToCart(prod)}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        total={cartTotal}
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
