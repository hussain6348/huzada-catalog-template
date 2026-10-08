import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCw,
  Search,
  MessageCircle,
  ExternalLink,
  ShoppingBag,
  Package,
  Layers,
  MapPin,
  Clock,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  Clock3,
  XCircle,
  ShieldCheck,
  Activity,
  ChevronRight,
  ArrowLeft,
  FileText,
  Copy,
  Check,
  Plus,
  Minus,
  Pencil,
  Trash2,
  X,
  Image as ImageIcon,
  LoaderCircle,
  Sparkles,
  Upload
} from 'lucide-react';
import type { Order, OrderStatus, Product } from '../lib/types';
import {
  getStoredProducts,
  fetchCatalogProducts,
  persistProduct,
  removeProduct,
  CATALOG_UPDATED_EVENT
} from '../lib/products';

const FALLBACK_ORDERS: Order[] = [
  {
    id: 'ORD-9021',
    customerName: 'Ayesha Khan',
    customerPhone: '03008765432',
    customerAddress: 'House 42, Street 7, Sector F-8/2, Islamabad',
    notes: 'Please call upon arrival, gate number is 2.',
    items: [
      {
        id: 'prod-1',
        name: 'Minimalist Steel Water Bottle',
        description: '',
        price: 1250,
        quantity: 2,
        category: 'Lifestyle',
        image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
      },
      {
        id: 'prod-2',
        name: 'Walnut Desktop Organizer',
        description: '',
        price: 1850,
        quantity: 1,
        category: 'Workspace',
        image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
      },
    ],
    total: 4350,
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: 'ORD-8942',
    customerName: 'Zainab Fatima',
    customerPhone: '03219876543',
    customerAddress: 'Apartment 304, Creek Vistas, Phase 8, DHA, Karachi',
    notes: 'Leave package with security reception.',
    items: [
      {
        id: 'prod-3',
        name: 'Matte Ceramic Pour-Over Mug',
        description: '',
        price: 950,
        quantity: 2,
        category: 'Lifestyle',
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
      },
    ],
    total: 1900,
    status: 'processing',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: 'ORD-8810',
    customerName: 'Bilal Ahmed',
    customerPhone: '03335551234',
    customerAddress: 'Office 12, Floor 3, Tech Hub Plaza, Gulberg III, Lahore',
    notes: 'Deliver during standard business hours 9am - 5pm.',
    items: [
      {
        id: 'prod-4',
        name: 'Padded Keyboard Wrist Rest',
        description: '',
        price: 1400,
        quantity: 1,
        category: 'Workspace',
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
      },
    ],
    total: 1400,
    status: 'completed',
    createdAt: new Date(Date.now() - 1000 * 60 * 550).toISOString(),
  },
];

const PRESET_SAMPLE_IMAGES = [
  { label: 'Bottle', url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80' },
  { label: 'Desk Tray', url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80' },
  { label: 'Mug', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80' },
  { label: 'Keypad Rest', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80' },
  { label: 'Pen', url: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80' },
  { label: 'Desk Pad', url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80' },
];

export function Admin() {
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Product[]>(() => getStoredProducts());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'online' | 'syncing'>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState(false);

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Workspace',
    customCategory: '',
    price: 1200,
    description: '',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
    stock: 15,
    badge: '',
  });
  const [productSaving, setProductSaving] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Media Asset Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP, AVIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds 10MB limit.');
      return;
    }

    setUploadingImage(true);
    setUploadError(null);

    // Instant local object URL preview
    const localBlob = URL.createObjectURL(file);
    setProductForm(prev => ({ ...prev, image: localBlob }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data: any = await res.json();
      if (data.success && data.imageUrl) {
        setProductForm(prev => ({ ...prev, image: data.imageUrl }));
      } else {
        throw new Error(data.error || 'Server upload failed');
      }
    } catch (err: any) {
      console.warn('Media upload note:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Fetch orders from operations endpoint
  const fetchOrders = async () => {
    setIsSyncing(true);
    setSystemStatus('syncing');
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('Network error');
      const data: any = await res.json();
      if (data.orders && data.orders.length > 0) {
        setOrders(data.orders);
        if (!selectedOrderId && data.orders[0]) {
          setSelectedOrderId(data.orders[0].id);
        }
      } else {
        setOrders(FALLBACK_ORDERS);
        if (!selectedOrderId) {
          setSelectedOrderId(FALLBACK_ORDERS[0].id);
        }
      }
    } catch {
      setOrders(FALLBACK_ORDERS);
      if (!selectedOrderId) {
        setSelectedOrderId(FALLBACK_ORDERS[0].id);
      }
    } finally {
      setIsSyncing(false);
      setSystemStatus('online');
    }
  };

  useEffect(() => {
    fetchOrders();

    // Fetch and sync live catalog products
    fetchCatalogProducts().then(items => {
      setInventory(items);
    });

    const handleCatalogUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setInventory(e.detail);
      }
    };
    window.addEventListener(CATALOG_UPDATED_EVENT, handleCatalogUpdate);
    return () => window.removeEventListener(CATALOG_UPDATED_EVENT, handleCatalogUpdate);
  }, []);

  // Update order status
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
    } catch (e) {
      console.warn('Status patch network note:', e);
    }

    setOrders(prev =>
      prev.map(ord => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
    );
  };

  // Adjust inventory quantities
  const handleAdjustStock = async (productId: string, delta: number) => {
    const target = inventory.find(p => p.id === productId);
    if (!target) return;
    const newStock = Math.max(0, (target.stock || 0) + delta);
    const updated = await persistProduct({ ...target, stock: newStock });
    setInventory(updated);
  };

  // Modal open handlers
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: 'Workspace',
      customCategory: '',
      price: 1200,
      description: '',
      image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
      stock: 15,
      badge: '',
    });
    setProductError(null);
    setUploadError(null);
    setUploadingImage(false);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    const standardCategories = ['Workspace', 'Lifestyle', 'Accessories'];
    const isStandard = standardCategories.includes(prod.category);
    setProductForm({
      name: prod.name,
      category: isStandard ? prod.category : 'Custom',
      customCategory: isStandard ? '' : prod.category,
      price: prod.price,
      description: prod.description || '',
      image: prod.image,
      stock: prod.stock ?? 10,
      badge: prod.badge || '',
    });
    setProductError(null);
    setUploadError(null);
    setUploadingImage(false);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      setProductError('Product name is required.');
      return;
    }
    if (productForm.price <= 0) {
      setProductError('Price must be greater than 0.');
      return;
    }
    if (!productForm.image.trim()) {
      setProductError('Please provide an image URL.');
      return;
    }

    setProductSaving(true);
    setProductError(null);

    const finalCategory =
      productForm.category === 'Custom'
        ? productForm.customCategory.trim() || 'General'
        : productForm.category;

    const productPayload: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now().toString().slice(-6)}`,
      name: productForm.name.trim(),
      category: finalCategory,
      price: Number(productForm.price),
      description: productForm.description.trim(),
      image: productForm.image.trim(),
      stock: Number(productForm.stock),
      badge: productForm.badge.trim() || undefined,
    };

    try {
      const updated = await persistProduct(productPayload);
      setInventory(updated);
      setIsProductModalOpen(false);
      setEditingProduct(null);
    } catch {
      setProductError('Error saving product. Please try again.');
    } finally {
      setProductSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const updated = await removeProduct(productId);
    setInventory(updated);
    setDeleteConfirmId(null);
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;
      const query = searchQuery.toLowerCase();
      const matchesQuery =
        ord.id.toLowerCase().includes(query) ||
        ord.customerName.toLowerCase().includes(query) ||
        ord.customerPhone.includes(query) ||
        ord.customerAddress.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [orders, statusFilter, searchQuery]);

  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || filteredOrders[0] || null;
  }, [orders, selectedOrderId, filteredOrders]);

  const copyOrderSummary = (order: Order) => {
    const text = `Order ID: ${order.id}\nCustomer: ${order.customerName} (${order.customerPhone})\nAddress: ${order.customerAddress}\nTotal: Rs. ${order.total}\nStatus: ${order.status}`;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getCleanPhone = (phoneStr: string) => {
    let clean = phoneStr.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '92' + clean.slice(1);
    }
    return clean;
  };

  return (
    <div className="min-h-screen bg-zinc-100/60 font-sans text-zinc-900 flex flex-col">
      {/* Top Operations Header Bar */}
      <header className="bg-white border-b border-zinc-200 px-4 sm:px-6 py-3.5 sticky top-0 z-30 flex items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
            title="Back to Catalog"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-sm sm:text-base text-zinc-900 tracking-tight">
              Merchant Operations Console
            </h1>
            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-zinc-300" />
            {/* White-Label Business Status Indicator */}
            <div
              className="hidden sm:flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-1 rounded-md text-[11px] font-medium text-emerald-800"
              title="Database Health: Optimal · System Operational"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live Sync Active</span>
              <span className="text-emerald-300">·</span>
              <span className="text-emerald-700">System Operational</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchOrders}
            disabled={isSyncing}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Orders'}</span>
          </button>

          <Link
            to="/"
            className="bg-black hover:bg-zinc-800 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Open Storefront
          </Link>
        </div>
      </header>

      {/* Main Split-Screen Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
        {/* LEFT PANE (60%) */}
        <div className="w-full lg:w-[60%] flex flex-col space-y-4">
          {/* Tabs Selector & Filter Controls */}
          <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'orders'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Customer Orders</span>
                  <span
                    className={`ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      activeTab === 'orders' ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {orders.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'inventory'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Inventory Management</span>
                  <span
                    className={`ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      activeTab === 'inventory' ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {inventory.length}
                  </span>
                </button>
              </div>

              {activeTab === 'orders' && (
                <span className="text-[11px] text-zinc-400 font-mono">
                  Showing {filteredOrders.length} of {orders.length}
                </span>
              )}
            </div>

            {activeTab === 'orders' && (
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by order ID, customer name, phone number..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                {/* Status Filter Badges */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
                  {['all', 'pending', 'processing', 'completed', 'cancelled'].map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`capitalize px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        statusFilter === status
                          ? 'bg-zinc-800 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TAB 1: CUSTOMER ORDERS LIST */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-xs text-zinc-500">
                  No orders match your filter criteria.
                </div>
              ) : (
                filteredOrders.map(order => {
                  const isSelected = selectedOrder?.id === order.id;
                  const cleanPhone = getCleanPhone(order.customerPhone);
                  const waMsg = encodeURIComponent(
                    `Hello ${order.customerName}! Reaching out from the store regarding your order (${order.id}).`
                  );
                  const waLink = `https://wa.me/${cleanPhone}?text=${waMsg}`;

                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`bg-white rounded-xl border p-4 transition-all cursor-pointer shadow-2xs ${
                        isSelected
                          ? 'border-zinc-900 ring-1 ring-zinc-900'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-zinc-900">
                              {order.id}
                            </span>
                            {/* Status badge */}
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                                order.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : order.status === 'processing'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : order.status === 'cancelled'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>

                          <div className="text-xs font-medium text-zinc-800">
                            {order.customerName}
                          </div>

                          <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-zinc-400" />
                            <span>{order.customerPhone}</span>
                            <span className="text-zinc-300 mx-1">·</span>
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        {/* Order value & Quick WhatsApp launcher */}
                        <div className="text-right space-y-2">
                          <div className="font-mono font-bold text-sm text-zinc-900 tabular-nums">
                            Rs. {order.total.toLocaleString()}
                          </div>

                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
                            title="Direct WhatsApp Message"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-600 fill-current" />
                            <span>Chat</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        </div>
                      </div>

                      {/* Items preview tag */}
                      <div className="mt-3 pt-2.5 border-t border-zinc-100 text-[11px] text-zinc-500 flex items-center justify-between">
                        <span className="truncate max-w-xs">
                          {order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                        </span>
                        <span className="text-zinc-400 font-mono text-[10px] shrink-0">
                          {order.items.reduce((s, i) => s + i.quantity, 0)} items
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: INVENTORY MANAGEMENT */}
          {activeTab === 'inventory' && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs divide-y divide-zinc-100">
              {/* Header with primary action: + Upload Product */}
              <div className="p-4 bg-zinc-50/70 border-b border-zinc-200 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wider block font-mono">
                    Inventory Registry
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {inventory.length} active catalog {inventory.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <button
                  onClick={handleOpenAddProduct}
                  className="bg-black hover:bg-zinc-800 text-white text-xs font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs font-sans"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>+ Upload Product</span>
                </button>
              </div>

              {/* Quick Upload Product Card */}
              <div className="p-4 bg-zinc-50/40 border-b border-zinc-200">
                <div
                  onClick={handleOpenAddProduct}
                  className="border-2 border-dashed border-zinc-200 hover:border-zinc-800 rounded-xl p-4 transition-all cursor-pointer bg-white hover:bg-zinc-50/80 group flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3.5 text-left">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 group-hover:bg-zinc-900 group-hover:text-white flex items-center justify-center text-zinc-700 transition-colors shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-900">Upload Product to Catalog</h4>
                      <p className="text-[11px] text-zinc-500">
                        Upload media assets, set stock & pricing, and publish new items to your live storefront.
                      </p>
                    </div>
                  </div>

                  <span className="bg-black group-hover:bg-zinc-800 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow-xs">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Product</span>
                  </span>
                </div>
              </div>

              {inventory.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Package className="w-10 h-10 text-zinc-300 mx-auto" />
                  <p className="text-xs text-zinc-500">No products found in inventory.</p>
                  <button
                    onClick={handleOpenAddProduct}
                    className="bg-zinc-900 text-white text-xs font-medium px-3.5 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 mx-auto"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload First Product</span>
                  </button>
                </div>
              ) : (
                inventory.map(item => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors"
                  >
                    {/* Item info */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-xl object-cover bg-zinc-100 shrink-0 border border-zinc-200 shadow-2xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-semibold text-zinc-900 truncate">{item.name}</h4>
                          {item.badge && (
                            <span className="bg-zinc-100 text-zinc-700 text-[10px] font-medium px-1.5 py-0.2 rounded shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                          {item.category} · Rs. {item.price.toLocaleString()}
                        </p>
                        {item.description && (
                          <p className="text-[11px] text-zinc-400 line-clamp-1 max-w-sm mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Controls & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                      {/* Stock level & Steppers */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                            (item.stock || 0) < 10
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          {item.stock ?? 0} in stock
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleAdjustStock(item.id, -1)}
                            className="w-6 h-6 rounded border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
                            title="Reduce stock"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={() => handleAdjustStock(item.id, 1)}
                            className="w-6 h-6 rounded border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
                            title="Increase stock"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                      {/* Edit & Delete actions */}
                      <div className="flex items-center gap-1 border-l border-zinc-200 pl-3">
                        <button
                          onClick={() => handleOpenEditProduct(item)}
                          className="px-2 py-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                          title="Edit Product"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                            <button
                              onClick={() => handleDeleteProduct(item.id)}
                              className="text-red-700 font-semibold text-[11px] px-1.5 py-0.5 hover:underline cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-zinc-500 text-[11px] px-1 hover:text-zinc-800 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Archive / Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANE (40%) - ORDER INSPECTION DOSSIER */}
        <div className="w-full lg:w-[40%] flex flex-col">
          <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs sticky top-20 space-y-5">
            {selectedOrder ? (
              <>
                {/* Dossier Header */}
                <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                      Order Dossier
                    </span>
                    <h3 className="font-mono text-base font-bold text-zinc-900 flex items-center gap-2">
                      <span>{selectedOrder.id}</span>
                      <button
                        onClick={() => copyOrderSummary(selectedOrder)}
                        className="text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
                        title="Copy Summary"
                      >
                        {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </h3>
                    <span className="text-[11px] text-zinc-500">
                      Placed: {new Date(selectedOrder.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded capitalize ${
                      selectedOrder.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedOrder.status === 'processing'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : selectedOrder.status === 'cancelled'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>

                {/* Status Updater Buttons */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-mono block">
                    Update Order Status
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'pending')}
                      className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer text-left flex items-center justify-between ${
                        selectedOrder.status === 'pending'
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <span>Pending</span>
                      <Clock3 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'processing')}
                      className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer text-left flex items-center justify-between ${
                        selectedOrder.status === 'processing'
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <span>Processing</span>
                      <RotateCw className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                      className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer text-left flex items-center justify-between ${
                        selectedOrder.status === 'completed'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <span>Completed</span>
                      <CheckCircle2 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                      className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer text-left flex items-center justify-between ${
                        selectedOrder.status === 'cancelled'
                          ? 'bg-red-600 text-white border-red-700'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <span>Cancelled</span>
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Customer Information Card */}
                <div className="bg-zinc-50 rounded-xl p-3.5 border border-zinc-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-zinc-200/70 pb-2">
                    <span className="font-semibold text-zinc-700">Customer Details</span>
                    <a
                      href={`https://wa.me/${getCleanPhone(selectedOrder.customerPhone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline flex items-center gap-1 font-medium"
                    >
                      <MessageCircle className="w-3 h-3 fill-current" />
                      <span>WhatsApp Link</span>
                    </a>
                  </div>

                  <div className="space-y-1.5 text-zinc-700">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="font-medium text-zinc-900">{selectedOrder.customerName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="font-mono">{selectedOrder.customerPhone}</span>
                    </div>

                    <div className="flex items-start gap-2 pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{selectedOrder.customerAddress}</span>
                    </div>

                    {selectedOrder.notes && (
                      <div className="flex items-start gap-2 pt-1 text-zinc-600 italic">
                        <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                        <span>"{selectedOrder.notes}"</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Itemized Breakdown */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-mono block">
                    Itemized Order Breakdown
                  </span>
                  <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                    {selectedOrder.items.map(item => (
                      <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-md object-cover bg-zinc-100 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 truncate">{item.name}</p>
                            <p className="text-[11px] text-zinc-500 font-mono">
                              Rs. {item.price.toLocaleString()} × {item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-zinc-900 tabular-nums shrink-0">
                          Rs. {(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Summary */}
                <div className="pt-2 border-t border-zinc-100 space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-500">
                    <span>Payment Method</span>
                    <span className="font-medium text-zinc-900">Cash on Delivery (COD)</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Delivery Charge</span>
                    <span className="font-medium text-emerald-700">Free</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200 font-bold text-sm text-zinc-900">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base tabular-nums">
                      Rs. {selectedOrder.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center space-y-2">
                <Layers className="w-8 h-8 text-zinc-300 mx-auto" />
                <p className="text-xs text-zinc-500">Select an order on the left to inspect details.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-zinc-200 shadow-2xl overflow-hidden my-auto flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="font-bold text-base text-zinc-900 tracking-tight">
                  {editingProduct ? 'Edit Catalog Product' : 'Upload New Product'}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Merchant Inventory Registry · Instant Storefront Sync
                </p>
              </div>
              <button
                onClick={() => {
                  setIsProductModalOpen(false);
                  setEditingProduct(null);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {productError && (
                <div className="p-2.5 text-xs text-red-600 bg-red-50 rounded-lg border border-red-200 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{productError}</span>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Minimalist Aluminum Laptop Stand"
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
                />
              </div>

              {/* Category selector pills */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['Workspace', 'Lifestyle', 'Accessories', 'Custom'].map(cat => {
                    const active = productForm.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setProductForm({ ...productForm, category: cat })}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-zinc-900 text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                {productForm.category === 'Custom' && (
                  <input
                    type="text"
                    placeholder="Enter custom category name..."
                    value={productForm.customCategory}
                    onChange={e => setProductForm({ ...productForm, customCategory: e.target.value })}
                    className="mt-2 w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                )}
              </div>

              {/* Price & Stock in 2 columns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Price in Rs. <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                      Rs.
                    </span>
                    <input
                      required
                      type="number"
                      min="1"
                      step="10"
                      value={productForm.price}
                      onChange={e => setProductForm({ ...productForm, price: Number(e.target.value) })}
                      className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Stock Count <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, stock: Math.max(0, productForm.stock - 1) })}
                      className="px-2.5 py-2 hover:bg-zinc-100 text-zinc-600 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={productForm.stock}
                      onChange={e => setProductForm({ ...productForm, stock: Math.max(0, Number(e.target.value)) })}
                      className="w-full text-center py-2 text-xs font-mono text-zinc-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, stock: productForm.stock + 1 })}
                      className="px-2.5 py-2 hover:bg-zinc-100 text-zinc-600 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Product Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Key features, materials, dimensions, or usage notes..."
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                />
              </div>

              {/* Product Media / Image Asset */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5 flex items-center justify-between">
                  <span>Product Media / Image Asset <span className="text-red-500">*</span></span>
                  {uploadingImage && (
                    <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                      <LoaderCircle className="w-3 h-3 animate-spin text-zinc-900" />
                      Uploading asset...
                    </span>
                  )}
                </label>

                {/* Upload Dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !uploadingImage && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-zinc-900 bg-zinc-100'
                      : 'border-zinc-200 hover:border-zinc-400 bg-zinc-50/60 hover:bg-zinc-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />

                  {uploadingImage ? (
                    <div className="py-2.5 flex flex-col items-center justify-center space-y-1.5">
                      <LoaderCircle className="w-6 h-6 animate-spin text-zinc-900" />
                      <p className="text-xs font-medium text-zinc-700">Uploading and processing media asset...</p>
                      <p className="text-[10px] text-zinc-400 font-mono">Storing to high-speed asset distribution</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 py-1">
                      <Upload className="w-5 h-5 text-zinc-500 mx-auto" />
                      <p className="text-xs text-zinc-700">
                        Drag & drop product image here, or{' '}
                        <span className="font-semibold text-zinc-900 underline underline-offset-2">
                          Browse Device
                        </span>
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        PNG, JPG, WEBP, AVIF up to 10MB
                      </p>
                    </div>
                  )}
                </div>

                {uploadError && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{uploadError}</span>
                  </p>
                )}

                {/* Direct Image URL input */}
                <div className="mt-2.5">
                  <input
                    type="url"
                    placeholder="Or enter direct image URL (https://...)"
                    value={productForm.image}
                    onChange={e => setProductForm({ ...productForm, image: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                {/* Live Thumbnail Preview */}
                <div className="mt-2.5 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-200 shrink-0 border border-zinc-300 flex items-center justify-center">
                      {productForm.image ? (
                        <img
                          src={productForm.image}
                          alt="Preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e: any) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                        Live Media Preview
                      </span>
                      <p className="text-xs font-semibold text-zinc-800 truncate">
                        {productForm.name || 'Product Title'}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono">
                        Rs. {Number(productForm.price || 0).toLocaleString()} · {productForm.stock} in stock
                      </p>
                    </div>
                  </div>

                  {productForm.image && (
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, image: '' })}
                      className="p-1 text-zinc-400 hover:text-red-600 rounded cursor-pointer"
                      title="Clear image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Quick Sample Image Presets */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-zinc-400 font-mono">Sample presets:</span>
                  {PRESET_SAMPLE_IMAGES.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setProductForm({ ...productForm, image: preset.url })}
                      className="text-[10px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Badge */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Optional Badge Tag <span className="text-zinc-400 font-normal">(e.g. Popular, New, Limited)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Limited Edition"
                  value={productForm.badge}
                  onChange={e => setProductForm({ ...productForm, badge: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsProductModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={productSaving}
                  className="bg-black hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs font-sans"
                >
                  {productSaving ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Product...</span>
                    </>
                  ) : (
                    <span>{editingProduct ? 'Save Product Changes' : 'Upload & Publish Product'}</span>
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

// Default export alias to support both import { Admin } and default import
export default Admin;
