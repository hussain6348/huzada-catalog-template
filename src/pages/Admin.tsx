import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  ShoppingBag,
  Plus,
  Pencil,
  Trash2,
  LogOut,
  ArrowLeft,
  Search,
  ExternalLink,
  MessageCircle,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  LoaderCircle,
  X,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import type { Product, Order } from '../lib/types';
import {
  getStoredProducts,
  fetchCatalogProducts,
  saveProductApi,
  deleteProductApi,
  getProductPrimaryImage,
  handleImageError,
} from '../lib/products';
import { getAuthToken, logoutAdmin } from '../lib/auth';
import { clientConfig } from '../config/client';

interface AdminProps {
  onLogout: () => void;
}

export function Admin({ onLogout }: AdminProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state for Add/Edit product
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // Status message
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const token = getAuthToken() || '';

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load products and orders
  useEffect(() => {
    fetchCatalogProducts().then((data) => setProducts(data));
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch orders', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSignOut = () => {
    logoutAdmin();
    onLogout();
  };

  const openAddProductModal = () => {
    setEditingProduct({
      id: `prod-${Date.now().toString().slice(-5)}`,
      name: '',
      category: 'Apparel',
      price: 1500,
      stock: 10,
      description: '',
      image: '',
      images: [],
    });
    setProductFormError(null);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct({ ...product });
    setProductFormError(null);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.name || !editingProduct.price) {
      setProductFormError('Please enter a valid product name and price.');
      return;
    }

    setIsSavingProduct(true);
    setProductFormError(null);

    const payload: Partial<Product> = {
      ...editingProduct,
      price: Number(editingProduct.price) || 0,
      stock: Number(editingProduct.stock) || 0,
      images: editingProduct.image ? [editingProduct.image] : [],
    };

    const res = await saveProductApi(payload, token);
    setIsSavingProduct(false);

    if (res.success && res.product) {
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setProducts(getStoredProducts());
      showNotification(`Product "${payload.name}" saved successfully.`);
    } else {
      setProductFormError(res.error || 'Failed to save product.');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    const res = await deleteProductApi(product.id, token);
    if (res.success) {
      setProducts(getStoredProducts());
      showNotification(`Product "${product.name}" deleted.`);
    } else {
      showNotification(res.error || 'Failed to delete product', 'error');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: orderId, status }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o))
        );
        showNotification(`Order ${orderId} marked as ${status}.`);
      }
    } catch {
      showNotification('Failed to update order status', 'error');
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div className="min-h-screen bg-zinc-100/60 font-sans text-zinc-900 pb-16">
      {/* Top Navbar */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              title="Return to public storefront"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-zinc-900">
                  {clientConfig.businessName}
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                Store Operations & Order Processing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors hidden sm:inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Live Store</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Floating Notification */}
        {notification && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-fade-in ${
              notification.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-zinc-400 hover:text-zinc-700 ml-3"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dashboard Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200/90 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-mono uppercase">Products</span>
              <Package className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
              {products.length}
            </p>
            <span className="text-[11px] text-zinc-500">Active catalog items</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200/90 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-mono uppercase">Pending</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-amber-600">
              {pendingOrdersCount}
            </p>
            <span className="text-[11px] text-zinc-500">Awaiting WhatsApp dispatch</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200/90 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-mono uppercase">Total Orders</span>
              <ShoppingBag className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
              {orders.length}
            </p>
            <span className="text-[11px] text-zinc-500">Recorded orders</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200/90 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-mono uppercase">Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
              {clientConfig.currencySymbol} {totalRevenue.toLocaleString()}
            </p>
            <span className="text-[11px] text-zinc-500">From confirmed orders</span>
          </div>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-2 shadow-xs flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Products & Catalog</span>
              <span className="bg-zinc-700 text-zinc-200 px-1.5 py-0.2 rounded text-[10px] font-mono">
                {products.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>WhatsApp Orders</span>
              {orders.length > 0 && (
                <span className="bg-emerald-600 text-white px-1.5 py-0.2 rounded text-[10px] font-mono">
                  {orders.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'products' && (
            <button
              onClick={openAddProductModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          )}

          {activeTab === 'orders' && (
            <button
              onClick={loadOrders}
              disabled={loadingOrders}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {loadingOrders ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Refresh Orders</span>
              )}
            </button>
          )}
        </div>

        {/* TAB 1: PRODUCTS TABLE */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden space-y-4">
            {/* Search Bar in Card */}
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter products by title or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                Showing {filteredProducts.length} items
              </span>
            </div>

            {/* Products List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/70 border-b border-zinc-200 text-zinc-500 font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-400">
                        No products found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const img = getProductPrimaryImage(p);
                      return (
                        <tr key={p.id} className="hover:bg-zinc-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={img}
                                alt={p.name}
                                referrerPolicy="no-referrer"
                                onError={handleImageError}
                                className="w-10 h-10 rounded-lg object-cover bg-zinc-100 border border-zinc-200 shrink-0"
                              />
                              <div className="min-w-0 max-w-xs sm:max-w-sm">
                                <p className="font-semibold text-zinc-900 truncate">
                                  {p.name}
                                </p>
                                <p className="text-[11px] text-zinc-500 truncate">
                                  {p.description}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-zinc-100 text-zinc-700 px-2 py-1 rounded-md text-[10px] font-mono">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold tabular-nums text-zinc-900">
                            {clientConfig.currencySymbol} {p.price.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-zinc-600">
                            {p.stock ?? 10}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditProductModal(p)}
                                className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit product"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS TABLE */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden space-y-4">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-zinc-900">
                  Incoming WhatsApp Customer Orders
                </h3>
                <p className="text-xs text-zinc-500">
                  Orders submitted through the storefront with customer delivery coordinates.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                {orders.length} total orders
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/70 border-b border-zinc-200 text-zinc-500 font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Order ID & Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Payable</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Direct Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-zinc-400">
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No customer orders recorded yet.</p>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Test by placing an order from the storefront checkout.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => {
                      const cleanPhone = (o.customerPhone || '').replace(/[^0-9]/g, '');
                      const waChatUrl = `https://wa.me/${cleanPhone}`;

                      return (
                        <tr key={o.id} className="hover:bg-zinc-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold text-zinc-900 block">
                              {o.id}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Recent'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-zinc-900">{o.customerName}</p>
                            <p className="text-[11px] text-zinc-500">{o.customerPhone}</p>
                            <p className="text-[11px] text-zinc-400 truncate max-w-xs">
                              {o.customerAddress}
                            </p>
                            {o.notes && (
                              <p className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5">
                                Note: {o.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-0.5 max-w-xs">
                              {o.items?.map((item, idx) => (
                                <div key={idx} className="text-[11px] text-zinc-700 truncate">
                                  • {item.name} <span className="font-mono">×{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold tabular-nums text-zinc-900">
                            {clientConfig.currencySymbol} {o.total.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={o.status || 'pending'}
                              onChange={(e) =>
                                handleUpdateOrderStatus(o.id, e.target.value as any)
                              }
                              className={`text-[11px] font-semibold rounded-lg px-2 py-1 border transition-colors cursor-pointer ${
                                o.status === 'delivered'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : o.status === 'confirmed'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : o.status === 'cancelled'
                                  ? 'bg-red-50 text-red-800 border-red-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <a
                              href={waChatUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3 fill-current" />
                              <span>WhatsApp</span>
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">
                {products.some((p) => p.id === editingProduct.id)
                  ? 'Edit Product'
                  : 'Add New Product'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
              {productFormError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{productFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Product Title *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Premium Cotton Hoodie"
                  value={editingProduct.name || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, name: e.target.value })
                  }
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Price ({clientConfig.currencySymbol}) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="50"
                    placeholder="2500"
                    value={editingProduct.price ?? ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Category *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Apparel, Accessories, etc."
                    value={editingProduct.category || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category: e.target.value })
                    }
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="10"
                    value={editingProduct.stock ?? 10}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stock: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Badge (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Popular, Bestseller, Limited"
                    value={editingProduct.badge || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, badge: e.target.value })
                    }
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Product Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={editingProduct.image || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, image: e.target.value })
                  }
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed product specifications, materials, and highlights..."
                  value={editingProduct.description || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, description: e.target.value })
                  }
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSavingProduct ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Product</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
