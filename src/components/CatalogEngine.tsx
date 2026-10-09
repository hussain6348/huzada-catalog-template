import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Package
} from 'lucide-react';
import type { Product, CartItem } from '../lib/types';
import { getStoredProducts, fetchCatalogProducts, CATALOG_UPDATED_EVENT, resolveImageUrl } from '../lib/products';

const STORE_WHATSAPP = '923322264855';
const CURRENCY_SYMBOL = 'Rs.';

interface CatalogEngineProps {
  products?: Product[];
  onOrderSuccess?: (orderId: string) => void;
}

export function CatalogEngine({
  products: initialProducts,
  onOrderSuccess,
}: CatalogEngineProps) {
  const [activeProducts, setActiveProducts] = useState<Product[]>(() => initialProducts || getStoredProducts());

  useEffect(() => {
    if (initialProducts) {
      setActiveProducts(initialProducts);
      return;
    }

    fetchCatalogProducts().then(items => {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');

  // Checkout form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{ id: string; waUrl: string } | null>(null);

  // Derived categories
  const categories = useMemo(() => {
    const list = Array.from(new Set(activeProducts.map(p => p.category)));
    return ['All', ...list];
  }, [activeProducts]);

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    return activeProducts
      .filter(p => {
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
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
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      const primaryImg = product.images?.[0] || product.image || '';
      return [...prev, { ...product, image: primaryImg, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter(item => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setSubmitting(true);
    setErrorMessage(null);

    const orderPayload = {
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerAddress: address.trim(),
      notes: notes.trim() || undefined,
      items: cart,
      total: cartTotal,
      status: 'pending',
    };

    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data: any = await res.json();
      const orderId = data.orderId || `ORD-${Date.now().toString().slice(-5)}`;

      // Generate WhatsApp text payload
      const itemBreakdown = cart
        .map(i => `• ${i.name} (x${i.quantity}) - ${CURRENCY_SYMBOL} ${(i.price * i.quantity).toLocaleString()}`)
        .join('\n');

      const waText = [
        `*NEW ORDER - Merchant Store*`,
        `────────────────────────`,
        `*Order ID:* ${orderId}`,
        ``,
        `*Customer:* ${name.trim()}`,
        `*Contact:* ${phone.trim()}`,
        `*Address:* ${address.trim()}`,
        notes.trim() ? `*Delivery Notes:* ${notes.trim()}` : null,
        ``,
        `*Items:*`,
        itemBreakdown,
        ``,
        `*Total Payable:* ${CURRENCY_SYMBOL} ${cartTotal.toLocaleString()} (Cash on Delivery)`,
        `────────────────────────`,
        `Please confirm availability and dispatch window. Thank you!`,
      ]
        .filter(Boolean)
        .join('\n');

      const waUrl = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(waText)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      setCompletedOrder({ id: orderId, waUrl });
      onOrderSuccess?.(orderId);
    } catch {
      setErrorMessage('Could not record order on the server. Please try again or reach out on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetOrderFlow = () => {
    setCart([]);
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setCompletedOrder(null);
    setIsDrawerOpen(false);
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
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
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
                onChange={e => setSortBy(e.target.value as any)}
                className="appearance-none bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 pr-8 text-xs font-medium text-zinc-700 hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
              >
                <option value="featured">Featured Sort</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
              <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>

            {/* Cart Trigger */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Bag</span>
              <span className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums">
                {cartItemCount}
              </span>
              {cartTotal > 0 && (
                <span className="border-l border-zinc-700 pl-2 font-mono tabular-nums text-zinc-300">
                  {CURRENCY_SYMBOL} {cartTotal.toLocaleString()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar">
          {categories.map(cat => {
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
          {filteredProducts.map(product => {
            const inCart = cart.find(i => i.id === product.id);
            return (
              <ProductCardItem
                key={product.id}
                product={product}
                inCart={inCart}
                onAddToCart={() => addToCart(product)}
                onUpdateQuantity={(delta) => updateQuantity(product.id, delta)}
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
                  <ShoppingBag className="w-5 h-5 text-zinc-900" />
                  <h2 className="font-semibold text-base text-zinc-900">
                    {completedOrder ? 'Order Status' : 'Shopping Bag'}
                  </h2>
                  <span className="text-xs font-mono text-zinc-500">
                    ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'})
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {completedOrder ? (
                /* Success View inside Drawer */
                <div className="p-6 flex-1 flex flex-col justify-center text-center space-y-6">
                  <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-900">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-lg text-zinc-900">Order Initiated</h3>
                    <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                      Reference ID: <span className="font-mono font-semibold text-zinc-800">{completedOrder.id}</span>
                    </p>
                    <p className="text-xs text-zinc-600 pt-2">
                      Please send the message in WhatsApp to confirm your items and delivery destination with our team.
                    </p>
                  </div>

                  <div className="space-y-2 pt-4">
                    <a
                      href={completedOrder.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-black hover:bg-zinc-800 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-sm"
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                      <span>Open WhatsApp Chat</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70 ml-1" />
                    </a>

                    <button
                      onClick={resetOrderFlow}
                      className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
                    >
                      Continue Shopping
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Cart Drawer with Items and Checkout Form */
                <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
                  {/* Cart Items List */}
                  <div className="p-5 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                      Selected Items
                    </h4>
                    {cart.length === 0 ? (
                      <div className="py-12 text-center space-y-2">
                        <ShoppingBag className="w-8 h-8 text-zinc-300 mx-auto" />
                        <p className="text-xs text-zinc-500">Your bag is empty.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cart.map(item => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-zinc-100 bg-zinc-50/50"
                          >
                            <img
                              src={resolveImageUrl(item.images?.[0] || item.image || item.image_path)}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              className="w-12 h-12 rounded-lg object-cover bg-zinc-200 shrink-0"
                              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                const target = e.currentTarget;
                                if (!target.dataset.hasFailed) {
                                  target.dataset.hasFailed = 'true';
                                  target.src = 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80';
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <h5 className="text-xs font-semibold text-zinc-900 truncate">
                                {item.name}
                              </h5>
                              <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
                                {CURRENCY_SYMBOL} {item.price.toLocaleString()} × {item.quantity}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-6 h-6 rounded bg-white border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="text-xs font-mono tabular-nums px-1 font-semibold">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-6 h-6 rounded bg-white border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="ml-1 text-zinc-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Customer Checkout Form */}
                  {cart.length > 0 && (
                    <form id="drawer-checkout-form" onSubmit={handleCheckoutSubmit} className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                          Customer Delivery Info
                        </h4>
                        <span className="text-[11px] text-zinc-500">Cash on Delivery</span>
                      </div>

                      {errorMessage && (
                        <div className="p-2.5 text-xs text-red-600 bg-red-50 rounded-lg border border-red-200">
                          {errorMessage}
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            placeholder="e.g. Ayesha Tariq"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            WhatsApp Contact <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="tel"
                            placeholder="e.g. 03322264855"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            Delivery Address <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            required
                            rows={2}
                            placeholder="House #, Street, Sector / Area, City"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1">
                            Instructions / Landmark (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Near commercial market"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                          />
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Drawer Footer & Checkout Button */}
              {!completedOrder && cart.length > 0 && (
                <div className="p-5 border-t border-zinc-100 bg-zinc-50/70 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Shipping</span>
                    <span className="font-medium text-zinc-900">Standard Free Delivery</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-200">
                    <span className="text-sm font-semibold text-zinc-900">Total Payable</span>
                    <span className="text-base font-bold text-zinc-900 font-mono tabular-nums">
                      {CURRENCY_SYMBOL} {cartTotal.toLocaleString()}
                    </span>
                  </div>

                  <button
                    form="drawer-checkout-form"
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-black hover:bg-zinc-800 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-between text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 fill-current" />
                      <span>{submitting ? 'Generating Order...' : 'Complete Order via WhatsApp'}</span>
                    </div>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProductCardItemProps {
  product: Product;
  inCart?: CartItem;
  onAddToCart: () => void;
  onUpdateQuantity: (delta: number) => void;
}

function ProductCardItem({
  product,
  inCart,
  onAddToCart,
  onUpdateQuantity,
}: ProductCardItemProps) {
  const primaryImg = product.images?.[0] || product.image || product.image_path;
  const images = (Array.isArray(product.images) && product.images.length > 0)
    ? product.images
    : (primaryImg ? [primaryImg] : ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80']);

  const [activeImgIdx, setActiveImgIdx] = useState(0);

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImgIdx(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImgIdx(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="group bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col hover:border-zinc-300 transition-all shadow-2xs hover:shadow-sm">
      {/* Product Image with Hover Zoom & Carousel */}
      <div className="relative aspect-4/3 overflow-hidden bg-zinc-100">
        <img
          src={resolveImageUrl(images[activeImgIdx] || primaryImg || images[0])}
          alt={`${product.name} - view ${activeImgIdx + 1}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            const target = e.currentTarget;
            if (!target.dataset.hasFailed) {
              target.dataset.hasFailed = 'true';
              target.src = 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80';
            }
          }}
        />

        {product.badge && (
          <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-zinc-900 text-[11px] font-semibold px-2 py-0.5 rounded shadow-xs z-10">
            {product.badge}
          </span>
        )}

        <span className="absolute bottom-3 right-3 bg-zinc-900/80 backdrop-blur-xs text-white text-[11px] font-mono px-2 py-0.5 rounded z-10">
          {product.category}
        </span>

        {/* Multi-Image Controls & Indicators */}
        {images.length > 1 && (
          <>
            <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded z-10">
              {activeImgIdx + 1}/{images.length}
            </span>

            {/* Previous & Next hover controls */}
            <button
              onClick={prevImage}
              aria-label="Previous image"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 hover:bg-white text-zinc-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-10"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={nextImage}
              aria-label="Next image"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 hover:bg-white text-zinc-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-10"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Bottom thumbnail indicator dots */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 bg-black/40 backdrop-blur-xs px-2 py-1 rounded-full">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImgIdx(i);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    activeImgIdx === i ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`View photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h3 className="font-semibold text-sm text-zinc-900 group-hover:text-zinc-700 transition-colors">
            {product.name}
          </h3>
          <p className="text-xs text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400 block uppercase font-mono">Price</span>
            <span className="text-sm font-bold text-zinc-900 tabular-nums">
              {CURRENCY_SYMBOL} {product.price.toLocaleString()}
            </span>
          </div>

          {inCart ? (
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                onClick={() => onUpdateQuantity(-1)}
                className="w-6 h-6 rounded bg-white hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-semibold font-mono tabular-nums px-1.5">
                {inCart.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(1)}
                className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={onAddToCart}
              className="bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-800 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Bag</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
