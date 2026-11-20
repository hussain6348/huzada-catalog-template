import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
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
  ChevronDown,
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
  Upload,
  Mail,
  Globe,
  LogOut,
  Settings,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Order, OrderStatus, Product, BusinessInfo } from '../lib/types';
import { clearAdminToken, getAuthHeaders } from '../lib/auth';
import {
  getStoredProducts,
  fetchCatalogProducts,
  persistProduct,
  removeProduct,
  CATALOG_UPDATED_EVENT,
  getProductPrimaryImage,
  handleImageError,
} from '../lib/products';
import {
  getStoredBusinessInfo,
  fetchBusinessInfo,
  persistBusinessInfo,
  saveImageSlot,
  BUSINESS_INFO_UPDATED_EVENT,
} from '../lib/businessInfo';
import { clientConfig } from '../config/client';
import { compressHero, compressLogo, compressProduct } from '../utils/imageCompression';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface AdminProps {
  onLogout?: () => void;
}

export function Admin({ onLogout }: AdminProps = {}) {
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'settings'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Product[]>(() => getStoredProducts());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  // ─── Order Alerts & Web Audio Chime State ──────────────────────────────
  type AlertState = 'loading' | 'subscribed' | 'ready' | 'ios_browser' | 'blocked' | 'unsupported';
  const [alertState, setAlertState] = useState<AlertState>('loading');
  const [isUpdatingAlerts, setIsUpdatingAlerts] = useState<boolean>(false);
  const [alertError, setAlertError] = useState<string | null>(null);

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('waas_alert_sound');
        return saved !== null ? saved === 'true' : true;
      }
      return true;
    } catch {
      return true;
    }
  });

  const toggleSound = () => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('waas_alert_sound', String(next));
        }
      } catch {}
      return next;
    });
  };

  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedOrdersRef = useRef<boolean>(false);

  const playNotificationChime = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // Tone 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Tone 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.08);
      gain2.gain.setValueAtTime(0, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.10);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch (err) {
      console.warn('Audio chime playback blocked or not supported:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const detectAlertState = async () => {
      try {
        if (typeof window === 'undefined') return;

        const isIOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        const isStandalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as unknown as { standalone?: boolean }).standalone === true;

        const hasSW = 'serviceWorker' in navigator;
        const hasPush = 'PushManager' in window;
        const hasNotif = 'Notification' in window;

        if (!hasSW || !hasPush || !hasNotif) {
          if (isIOS && !isStandalone) {
            if (isMounted) setAlertState('ios_browser');
          } else {
            if (isMounted) setAlertState('unsupported');
          }
          return;
        }

        if (isIOS && !isStandalone) {
          if (isMounted) setAlertState('ios_browser');
          return;
        }

        if (Notification.permission === 'denied') {
          if (isMounted) setAlertState('blocked');
          return;
        }

        try {
          const reg = await navigator.serviceWorker.getRegistration('/sw.js');
          if (reg) {
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              if (isMounted) setAlertState('subscribed');
              return;
            }
          }
        } catch {
          if (isMounted) setAlertState('unsupported');
          return;
        }

        if (isMounted) setAlertState('ready');
      } catch {
        if (isMounted) setAlertState('unsupported');
      }
    };

    detectAlertState();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleEnableAlerts = async () => {
    if (isUpdatingAlerts) return;
    setIsUpdatingAlerts(true);
    setAlertError(null);

    try {
      // 1. USER-GESTURE RULE: Call Notification.requestPermission() as the VERY FIRST statement
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (permission === 'denied') {
          setAlertState('blocked');
        } else {
          setAlertState('ready');
        }
        return;
      }

      // 2. Register service worker and await ready
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key
      const cfgRes = await fetch(`/api/push-config?t=${Date.now()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!cfgRes.ok) {
        throw new Error('Failed to retrieve push credentials from server');
      }
      const { publicKey } = await cfgRes.json();
      if (!publicKey || typeof publicKey !== 'string') {
        throw new Error('Invalid public key received from server');
      }

      // 4. Clean up any stale subscription
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe().catch(() => {});
      }

      // 5. Subscribe via pushManager
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 6. Persist to Turso via /api/push-subscribe
      const subJson = subscription.toJSON();
      const saveRes = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
        }),
      });

      // 7. PHANTOM-SUBSCRIPTION ROLLBACK
      if (!saveRes.ok) {
        await subscription.unsubscribe().catch(() => {});
        throw new Error('Could not register device with database. Push rolled back.');
      }

      setAlertState('subscribed');
    } catch (err: any) {
      console.error('Failed to enable order alerts:', err);
      setAlertError(err?.message || 'Failed to enable alerts');
    } finally {
      setIsUpdatingAlerts(false);
    }
  };

  const handleDisableAlerts = async () => {
    if (isUpdatingAlerts) return;
    setIsUpdatingAlerts(true);
    setAlertError(null);

    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe().catch(() => {});
          await fetch('/api/push-subscribe', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ endpoint }),
          }).catch(() => {});
        }
      }
      setAlertState('ready');
    } catch (err: any) {
      console.error('Failed to disable alerts:', err);
      setAlertError(err?.message || 'Failed to disable alerts');
    } finally {
      setIsUpdatingAlerts(false);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'online' | 'syncing'>('online');

  // Studio Settings State
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => getStoredBusinessInfo());
  const effectiveCurrencySymbol = businessInfo?.currencySymbol || clientConfig.currencySymbol || '$';
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSavedNotice, setBizSavedNotice] = useState(false);
  const [slotInputs, setSlotInputs] = useState<Record<string, string>>(() => {
    const current = getStoredBusinessInfo();
    return {
      logo: current.imageSlots?.logo || '',
      hero: current.heroImage || current.imageSlots?.hero || '',
      hero2: current.heroImage2 || current.imageSlots?.hero2 || '',
      hero3: current.heroImage3 || current.imageSlots?.hero3 || '',
      about: current.imageSlots?.about || '',
      promo: current.imageSlots?.promo || '',
    };
  });
  const [slotNotice, setSlotNotice] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const handleLogout = () => {
    clearAdminToken();
    if (onLogout) {
      onLogout();
    }
  };

  // Product & Inventory State (Catalog Engine)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<{
    name: string;
    category: string;
    customCategory: string;
    price: number;
    description: string;
    images: string[];
    stock: number;
    badge: string;
  }>({
    name: '',
    category: 'Workspace',
    customCategory: '',
    price: 1200,
    description: '',
    images: [],
    stock: 15,
    badge: '',
  });
  const [productSaving, setProductSaving] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [deleteConfirmProductId, setDeleteConfirmProductId] = useState<string | null>(null);
  const [customProductImageUrl, setCustomProductImageUrl] = useState('');
  const [isProductDragging, setIsProductDragging] = useState(false);
  const [uploadingProductImages, setUploadingProductImages] = useState<{ id: string; previewUrl: string; name: string }[]>([]);
  const [productUploadError, setProductUploadError] = useState<string | null>(null);

  // Multi-Media Asset Upload State
  interface UploadingAsset {
    id: string;
    previewUrl: string;
    name: string;
  }
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAssets, setUploadingAssets] = useState<UploadingAsset[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
      
  // THEME SETTINGS STATE
  const [themeForm, setThemeForm] = useState({
    primaryColor: "#0ea5e9",
    bgColor: "#0f172a",
    textColor: "#ffffff"
  });
  const [isDeployingTheme, setIsDeployingTheme] = useState<boolean>(false);
  const isSavingTheme = isDeployingTheme; // Backward compatibility alias
  const [activeThemeId, setActiveThemeId] = useState<string>('1');
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    fetch(`/api/theme?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!isMounted.current || !data) return;
        const item = data.data ? (Array.isArray(data.data) ? data.data[0] : data.data) : (Array.isArray(data) ? data[0] : data);
        if (item) {
          if (item.id) setActiveThemeId(String(item.id));
          if (item.primaryColor) {
            setThemeForm({
              primaryColor: item.primaryColor || '#0ea5e9',
              bgColor: item.bgColor || '#0f172a',
              textColor: item.textColor || '#ffffff'
            });
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleSaveTheme = async () => {
    setIsDeployingTheme(true);
    try {
      // 1. THE AUTHENTICATION INJECTION (CRITICAL): Inject Ghost Lock headers
      const response = await fetch('/api/theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          primaryColor: themeForm.primaryColor,
          bgColor: themeForm.bgColor,
          textColor: themeForm.textColor
        }),
      });

      // 5. THE 401 GATE: Clean auth state reset & redirect on 401
      if (response.status === 401) {
        clearAdminToken();
        try {
          localStorage.clear();
        } catch {}
        if (onLogout) onLogout();
        window.location.href = '/admin';
        return;
      }

      // 2. THE SERVER-TRUTH SYNC: Await response.json() and verify theme ID from database
      const data = await response.json();
      if (!response.ok || (data && data.success === false)) {
        throw new Error(data?.error || "Database sync failed");
      }

      const verifiedThemeId = data?.data?.id ?? data?.id ?? '1';
      const verifiedTheme = data?.data || data;

      // Wrap state updates with isMounted ref check
      if (isMounted.current) {
        setActiveThemeId(String(verifiedThemeId));
        if (verifiedTheme.primaryColor && verifiedTheme.bgColor && verifiedTheme.textColor) {
          setThemeForm({
            primaryColor: verifiedTheme.primaryColor,
            bgColor: verifiedTheme.bgColor,
            textColor: verifiedTheme.textColor
          });
        }
      }

      // 3. THE GLOBAL BRIDGE - DISPATCH (ADMIN): Dispatch global event to instantly sync storefront
      window.dispatchEvent(
        new CustomEvent('WAAS_THEME_UPDATED', { detail: String(verifiedThemeId) })
      );

      // Instant local document CSS sync
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--theme-primary', themeForm.primaryColor);
        document.documentElement.style.setProperty('--theme-bg', themeForm.bgColor);
        document.documentElement.style.setProperty('--theme-text', themeForm.textColor);
      }

      if (isMounted.current) {
        alert("Theme deployed securely to Edge!");
      }
    } catch (error: any) {
      console.error("Theme deployment failed:", error);
      if (isMounted.current) {
        alert(`Error saving theme: ${error.message || 'Check console.'}`);
      }
    } finally {
      // 5. Wrap state update in isMounted check
      if (isMounted.current) {
        setIsDeployingTheme(false);
      }
    }
  };

  const optimizeImageFile = (file: File): Promise<{ file: File; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = () => {
        const rawDataUrl = reader.result as string;
        if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
          resolve({ file, dataUrl: rawDataUrl });
          return;
        }

        const img = new Image();
        img.onerror = () => resolve({ file, dataUrl: rawDataUrl });
        img.onload = () => {
          try {
            const maxDim = 1200;
            let { width, height } = img;
            if (width <= maxDim && height <= maxDim && file.size <= 350 * 1024) {
              resolve({ file, dataUrl: rawDataUrl });
              return;
            }
            if (width > maxDim || height > maxDim) {
              if (width >= height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve({ file, dataUrl: rawDataUrl });
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const quality = outputMime === 'image/jpeg' ? 0.85 : undefined;
            const compressedDataUrl = canvas.toDataURL(outputMime, quality);
            canvas.toBlob(
              blob => {
                if (!blob) {
                  resolve({ file, dataUrl: compressedDataUrl });
                  return;
                }
                const ext = outputMime === 'image/png' ? 'png' : 'jpg';
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                const optimizedFile = new File([blob], `${baseName}.${ext}`, {
                  type: outputMime,
                });
                resolve({ file: optimizedFile, dataUrl: compressedDataUrl });
              },
              outputMime,
              quality
            );
          } catch {
            resolve({ file, dataUrl: rawDataUrl });
          }
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  // Fetch orders from operations endpoint
  const fetchOrders = async () => {
    setIsSyncing(true);
    setSystemStatus('syncing');
    try {
      const res = await fetch(`/api/orders?t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: getAuthHeaders(),
      }).catch(() => null);

      if (res && res.status === 401) {
        clearAdminToken();
        if (onLogout) onLogout();
        return;
      }
      if (!res || !res.ok) return;
      const data: any = await res.json();
      const rawList = Array.isArray(data)
        ? data
        : (Array.isArray(data?.orders) ? data.orders : []);

      const currentIds = (rawList || []).map((o: any, idx: number) => String(o.id || `ORD-${Date.now()}-${idx}`));

      if (!hasHydratedOrdersRef.current) {
        currentIds.forEach((id: string) => seenOrderIdsRef.current.add(id));
        hasHydratedOrdersRef.current = true;
      } else {
        let hasNew = false;
        for (const id of currentIds) {
          if (!seenOrderIdsRef.current.has(id)) {
            hasNew = true;
            seenOrderIdsRef.current.add(id);
          }
        }
        if (hasNew && isSoundEnabled) {
          playNotificationChime();
        }
      }

      setOrders(rawList);
      if (!selectedOrderId && rawList[0]) {
        setSelectedOrderId(rawList[0].id);
      }
    } catch (e) {
      console.warn('Live orders fetch note:', e);
    } finally {
      setIsSyncing(false);
      setSystemStatus('online');
    }
  };

  useEffect(() => {
    fetchOrders();

    // 15-second real-time polling with cleanup to prevent memory leaks
    const pollInterval = setInterval(() => {
      fetchOrders();
    }, 15000);

    // Fetch and sync live catalog products
    fetchCatalogProducts().then(items => {
      if (Array.isArray(items)) {
        setInventory(items);
      }
    });

    // Fetch and sync live business info
    fetchBusinessInfo().then(data => {
      if (data) {
        setBusinessInfo(data);
        setSlotInputs({
          logo: data.imageSlots?.logo || '',
          hero: data.heroImage || data.imageSlots?.hero || '',
          hero2: data.heroImage2 || data.imageSlots?.hero2 || '',
          hero3: data.heroImage3 || data.imageSlots?.hero3 || '',
          about: data.imageSlots?.about || '',
          promo: data.imageSlots?.promo || '',
        });
      }
    }).catch(console.warn);

    const handleCatalogUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setInventory(e.detail);
      }
    };
    const handleBizUpdate = (e: any) => {
      if (e?.detail) {
        setBusinessInfo(e.detail);
        if (e.detail.imageSlots) {
          setSlotInputs(prev => ({
            ...prev,
            ...e.detail.imageSlots,
          }));
        }
      }
    };
    window.addEventListener(CATALOG_UPDATED_EVENT, handleCatalogUpdate);
    window.addEventListener(BUSINESS_INFO_UPDATED_EVENT, handleBizUpdate);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener(CATALOG_UPDATED_EVENT, handleCatalogUpdate);
      window.removeEventListener(BUSINESS_INFO_UPDATED_EVENT, handleBizUpdate);
    };
  }, []);

  const deleteOrphanR2Image = async (imageUrl?: string) => {
    if (!imageUrl || typeof imageUrl !== 'string') return;
    const trimmed = imageUrl.trim();
    if (!trimmed) return;

    // Check if it is an R2 asset (/api/media/ or .r2.dev)
    const isR2 = trimmed.includes('/api/media/') || trimmed.includes('.r2.dev');
    if (!isR2) return;

    try {
      let key = '';
      if (trimmed.includes('/api/media/')) {
        key = trimmed.split('/api/media/').pop()?.split('?')[0] || '';
      } else {
        try {
          const urlObj = new URL(trimmed);
          key = urlObj.pathname.split('/').filter(Boolean).pop() || '';
        } catch {
          key = trimmed.split('/').filter(Boolean).pop() || '';
        }
      }

      if (key) {
        await fetch(`/api/media/${encodeURIComponent(key)}`, {
          method: 'DELETE',
          headers: {
            ...getAuthHeaders(),
          },
        });
      }
    } catch (err) {
      console.warn('Orphan R2 asset deletion note:', err);
    }
  };

  // Update order status
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      if (res.status === 401) {
        clearAdminToken();
        if (onLogout) onLogout();
        return;
      }
    } catch (e) {
      console.warn('Order status patch note:', e);
    }

    setOrders(prev =>
      prev.map(ord => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
    );
  };

  const copyOrderSummary = (order: Order) => {
    const text = `Order ID: ${order.id}\nCustomer: ${order.customerName} (${order.customerPhone})\nAddress: ${order.customerAddress}\nTotal: Rs. ${order.total}\nStatus: ${order.status}`;
    navigator.clipboard.writeText(text);
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  // Adjust inventory quantities
  const handleAdjustStock = async (productId: string, delta: number) => {
    const target = inventory.find(p => p.id === productId);
    if (!target) return;
    const newStock = Math.max(0, (target.stock || 0) + delta);
    const updated = await persistProduct({ ...target, stock: newStock });
    setInventory(updated);
  };

  // Product Modal open handlers
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: 'Workspace',
      customCategory: '',
      price: 1200,
      description: '',
      images: [],
      stock: 15,
      badge: '',
    });
    setProductError(null);
    setProductUploadError(null);
    setUploadingProductImages([]);
    setCustomProductImageUrl('');
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    const standardCategories = ['Workspace', 'Lifestyle', 'Accessories', 'Beauty', 'Apparel'];
    const isStandard = standardCategories.includes(prod.category);
    const existingImages = (Array.isArray(prod.images) && prod.images.length > 0)
      ? prod.images.slice(0, 5)
      : (prod.image ? [prod.image] : (prod.image_path ? [prod.image_path] : []));

    setProductForm({
      name: prod.name,
      category: isStandard ? prod.category : 'Custom',
      customCategory: isStandard ? '' : prod.category,
      price: prod.price,
      description: prod.description || '',
      images: existingImages,
      stock: prod.stock ?? 10,
      badge: prod.badge || '',
    });
    setProductError(null);
    setProductUploadError(null);
    setUploadingProductImages([]);
    setCustomProductImageUrl('');
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
    if (productForm.images.length === 0) {
      setProductError('Please provide at least one image for the product gallery.');
      return;
    }

    setProductSaving(true);
    setProductError(null);

    const finalCategory =
      productForm.category === 'Custom'
        ? productForm.customCategory.trim() || 'General'
        : productForm.category;

    const finalImages = productForm.images.slice(0, 5);

    const productPayload: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now().toString().slice(-6)}`,
      name: productForm.name.trim(),
      category: finalCategory,
      price: Number(productForm.price),
      description: productForm.description.trim(),
      images: finalImages,
      image: finalImages[0] || '',
      stock: Number(productForm.stock),
      badge: productForm.badge.trim() || undefined,
    };

    try {
      const updated = await persistProduct(productPayload);
      setInventory(updated);
      setIsProductModalOpen(false);
      setEditingProduct(null);

      fetchCatalogProducts().then(freshProducts => {
        if (freshProducts && freshProducts.length > 0) {
          setInventory(freshProducts);
        }
      });
    } catch {
      setProductError('Error saving product. Please try again.');
    } finally {
      setProductSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const updated = await removeProduct(productId);
    setInventory(updated);
    setDeleteConfirmProductId(null);
  };

  const handleProductFilesUpload = async (filesList: FileList | File[]) => {
    const rawFiles = Array.from(filesList);
    const validFiles = rawFiles.filter(f => f.type.startsWith('image/'));

    if (validFiles.length === 0) {
      setProductUploadError('Please select valid image files (PNG, JPG, WEBP).');
      return;
    }

    const currentCount = productForm.images.length + uploadingProductImages.length;
    const availableSlots = 5 - currentCount;

    if (availableSlots <= 0) {
      setProductUploadError('Maximum limit of 5 media assets reached.');
      return;
    }

    const filesToUpload = validFiles.slice(0, availableSlots);
    setProductUploadError(null);

    const newAssets = filesToUpload.map(file => ({
      id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
    }));

    setUploadingProductImages(prev => [...prev, ...newAssets]);

    const uploadTasks = newAssets.map(async (asset, index) => {
      const rawFile = filesToUpload[index];
      try {
        const { file: optimizedFile, dataUrl: localDataUrl } = await optimizeImageFile(rawFile);
        const formData = new FormData();
        formData.append('file', optimizedFile);
        const res = await fetch('/api/upload', {
          credentials: 'include',
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });
        if (res.status === 401) {
          clearAdminToken();
          if (onLogout) onLogout();
          return { success: false, id: asset.id, previewUrl: asset.previewUrl };
        }
        if (res.ok) {
          const data: any = await res.json();
          if (data.success && (data.imageUrl || data.url)) {
            return { success: true, id: asset.id, imageUrl: data.imageUrl || data.url, previewUrl: asset.previewUrl };
          }
        }
        if (localDataUrl) {
          return { success: true, id: asset.id, imageUrl: localDataUrl, previewUrl: asset.previewUrl };
        }
        return { success: false, id: asset.id, previewUrl: asset.previewUrl };
      } catch {
        return { success: false, id: asset.id, previewUrl: asset.previewUrl };
      }
    });

    const results = await Promise.all(uploadTasks);
    const successfulUrls: string[] = [];

    results.forEach(res => {
      URL.revokeObjectURL(res.previewUrl);
      if (res.success && res.imageUrl) {
        successfulUrls.push(res.imageUrl);
      }
    });

    if (successfulUrls.length > 0) {
      setProductForm(prev => ({
        ...prev,
        images: [...prev.images, ...successfulUrls].slice(0, 5),
      }));
    }

    setUploadingProductImages(prev => prev.filter(item => !results.some(r => r.id === item.id)));
  };

  const handleAddProductDirectUrl = () => {
    const trimmed = customProductImageUrl.trim();
    if (!trimmed) return;
    if (!/^(https?:\/\/|data:image\/)/i.test(trimmed)) {
      setProductUploadError('Please enter a valid URL (http://, https://, or data:image/)');
      return;
    }
    if (productForm.images.length >= 5) {
      setProductUploadError('Maximum limit of 5 media assets reached.');
      return;
    }
    setProductForm(prev => ({
      ...prev,
      images: [...prev.images, trimmed].slice(0, 5),
    }));
    setCustomProductImageUrl('');
    setProductUploadError(null);
  };

  const handleRemoveProductImage = (index: number) => {
    setProductForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    setProductUploadError(null);
  };

  const handleSetPrimaryProductCover = (index: number) => {
    if (index === 0) return;
    setProductForm(prev => {
      const chosen = prev.images[index];
      const remaining = prev.images.filter((_, i) => i !== index);
      return {
        ...prev,
        images: [chosen, ...remaining],
      };
    });
  };

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(ord => {
      const matchesStatus = orderStatusFilter === 'all' || ord.status === orderStatusFilter;
      const query = orderSearchQuery.toLowerCase();
      const matchesQuery =
        (ord.id || '').toLowerCase().includes(query) ||
        (ord.customerName || '').toLowerCase().includes(query) ||
        (ord.customerPhone || '').includes(query) ||
        (ord.customerAddress || '').toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [orders, orderStatusFilter, orderSearchQuery]);

  const selectedOrder = useMemo(() => {
    return (orders || []).find(o => o.id === selectedOrderId) || filteredOrders[0] || null;
  }, [orders, selectedOrderId, filteredOrders]);

  const handleSaveBusinessInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBizSaving(true);
    try {
      const updated: BusinessInfo = {
        ...businessInfo,
        heroImage: businessInfo.heroImage || slotInputs.hero || '',
        heroImage2: businessInfo.heroImage2 || slotInputs.hero2 || '',
        heroImage3: businessInfo.heroImage3 || slotInputs.hero3 || '',
        promoText: businessInfo.promoText !== undefined ? businessInfo.promoText : '',
        imageSlots: {
          ...businessInfo.imageSlots,
          ...slotInputs,
        },
      };
      await persistBusinessInfo(updated);
      try {
        await fetch('/api/theme-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ slot_id: 'promo_text', image_url: updated.promoText || '' }),
        });
      } catch (mediaErr) {
        console.warn('Failed to sync promo_text to theme-media:', mediaErr);
      }
      setBusinessInfo(updated);
      setBizSavedNotice(true);
      setTimeout(() => setBizSavedNotice(false), 2500);
    } catch (err) {
      console.error('Failed to save business info:', err);
    } finally {
      setBizSaving(false);
    }
  };

  const handleUpdateSlot = async (slot: 'logo' | 'hero' | 'about' | 'promo' | 'hero2' | 'hero3') => {
    const url = slotInputs[slot]?.trim() || '';
    const oldUrl = businessInfo.imageSlots?.[slot] || (slot === 'hero' ? businessInfo.heroImage : slot === 'hero2' ? businessInfo.heroImage2 : slot === 'hero3' ? businessInfo.heroImage3 : '') || '';

    // Clean up previous R2 asset if replaced
    if (oldUrl && oldUrl !== url) {
      try {
        await deleteOrphanR2Image(oldUrl);
      } catch (cleanErr) {
        console.warn('Orphan R2 cleanup note (proceeding):', cleanErr);
      }
    }

    saveImageSlot(slot, url);
    setBusinessInfo(prev => {
      const updated = {
        ...prev,
        imageSlots: {
          ...prev.imageSlots,
          [slot]: url,
        },
      };
      if (slot === 'hero') updated.heroImage = url;
      if (slot === 'hero2') updated.heroImage2 = url;
      if (slot === 'hero3') updated.heroImage3 = url;
      return updated;
    });
    try {
      await fetch('/api/theme-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ slot_id: slot, image_url: url }),
      });
    } catch (e) {
      console.warn('Failed to sync slot to Live Edge Database:', e);
    }
    setSlotNotice(`Slot "${slot}" updated live!`);
    setTimeout(() => setSlotNotice(null), 2500);
  };

  const handleSlotFileUpload = async (
    slot: 'logo' | 'hero' | 'about' | 'promo' | 'hero2' | 'hero3',
    file: File
  ) => {
    if (!file || !file.type.startsWith('image/')) {
      setSlotNotice(`Please select a valid image file.`);
      alert('Please select a valid image file.');
      setTimeout(() => setSlotNotice(null), 3000);
      return;
    }

    setUploadingSlot(slot);
    setSlotNotice(`Uploading ${slot} asset to Secure Media Vault...`);

    try {
      // --- INJECTED COMPRESSION STEP ---
      let compressedTarget: File;
      if (slot === 'hero' || slot === 'hero2' || slot === 'hero3' || slot === 'about' || slot === 'promo') {
        compressedTarget = await compressHero(file);
      } else if (slot === 'logo') {
        compressedTarget = await compressLogo(file);
      } else {
        compressedTarget = await compressProduct(file);
      }
      // ---------------------------------

      const localDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(compressedTarget);
      });

      const formData = new FormData();
      formData.append('file', compressedTarget);

      const res = await fetch('/api/upload', {
        credentials: 'include',
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      if (res.status === 401) {
        clearAdminToken();
        if (onLogout) onLogout();
        return;
      }

      let uploadedUrl = '';

      if (res.ok) {
        const data: any = await res.json();
        if (data.success && (data.imageUrl || data.url || (Array.isArray(data.imageUrls) && data.imageUrls[0]))) {
          uploadedUrl = data.imageUrl || data.url || data.imageUrls[0];
        }
      }

      // Fallback to local DataURL if server upload returned error or local dev
      if (!uploadedUrl && localDataUrl) {
        uploadedUrl = localDataUrl;
      }

      const rawUrl = uploadedUrl;

      // 1. THE NULL-POINTER SHIELD: Verify URL exists and is a string
      if (!rawUrl || typeof rawUrl !== 'string') {
        throw new Error('Upload succeeded but returned an invalid image URL');
      }

      // 2. THE ABSOLUTE STRIPPER & 3. THE ENCODING PRESERVATION
      // Strips protocols and domains (e.g. localhost), preserves exact percent-encoding (%20)
      let cleanUrl: string;
      if (rawUrl.startsWith('data:')) {
        cleanUrl = rawUrl;
      } else {
        try {
          const parsed = new URL(rawUrl, window.location.origin);
          cleanUrl = parsed.pathname + parsed.search;
        } catch {
          cleanUrl = rawUrl.replace(/^https?:\/\/[^\/]+/, '');
        }
        cleanUrl = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
      }

      if (cleanUrl) {
        // Self-cleaning R2 orphan deletion: check if OLD image URL is an R2 URL
        const oldUrl = slotInputs[slot] || businessInfo.imageSlots?.[slot] || (slot === 'hero' ? businessInfo.heroImage : slot === 'hero2' ? businessInfo.heroImage2 : slot === 'hero3' ? businessInfo.heroImage3 : '') || '';
        if (oldUrl && oldUrl !== cleanUrl) {
          try {
            await deleteOrphanR2Image(oldUrl);
          } catch (cleanErr) {
            console.warn('Orphan R2 cleanup error (proceeding with upload):', cleanErr);
          }
        }

        // 4. THE SYNCHRONIZED PAYLOAD: Use exact cleanUrl for BOTH React UI state and Database payload
        setSlotInputs(prev => ({
          ...prev,
          [slot]: cleanUrl,
        }));

        // Broadcast to EditableImage and local cache
        saveImageSlot(slot, cleanUrl);
        setBusinessInfo(prev => {
          const updated = {
            ...prev,
            imageSlots: {
              ...prev.imageSlots,
              [slot]: cleanUrl,
            },
          };
          if (slot === 'hero') updated.heroImage = cleanUrl;
          if (slot === 'hero2') updated.heroImage2 = cleanUrl;
          if (slot === 'hero3') updated.heroImage3 = cleanUrl;
          return updated;
        });

        // 3. Save to the Database
        try {
          await fetch('/api/theme-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ slot_id: slot, image_url: cleanUrl }),
          });
        } catch (e) {
          console.warn('Failed to mirror slot to Live Edge Database:', e);
        }

        setSlotNotice(`Slot "${slot}" uploaded to Secure Media Vault & updated live!`);
      } else {
        setSlotNotice(`Upload failed for slot "${slot}".`);
        alert('Upload failed.');
      }
    } catch (err: any) {
      console.error('Slot upload error:', err);
      setSlotNotice(`Upload error: ${err.message || 'Network issue'}`);
      alert('Upload failed.');
    } finally {
      setUploadingSlot(null);
      setTimeout(() => setSlotNotice(null), 3500);
    }
  };

  // Direct alias for backward-compatibility and tests expecting handleImageUpload
  const handleImageUpload = handleSlotFileUpload;

  const uploadingHeroKey =
    uploadingSlot === 'hero' ? 'heroImage' : uploadingSlot === 'hero2' ? 'heroImage2' : uploadingSlot === 'hero3' ? 'heroImage3' : null;

  const handleHeroSlideUpload = (key: 'heroImage' | 'heroImage2' | 'heroImage3', file: File) => {
    const slot = key === 'heroImage' ? 'hero' : key === 'heroImage2' ? 'hero2' : 'hero3';
    return handleSlotFileUpload(slot, file);
  };

  const getCleanPhone = (phoneStr: string) => {
    let clean = phoneStr.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '92' + clean.slice(1);
    }
    return clean;
  };

  return (
    <div className="min-h-screen bg-zinc-100/60 font-sans text-zinc-900 flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Top Operations Header Bar */}
      <header className="bg-white border-b border-zinc-200 px-4 sm:px-6 py-3.5 sticky top-0 z-30 flex items-center justify-between gap-4 shadow-2xs w-full max-w-full">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shrink-0"
            title="Back to Storefront"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Business Logo with Fallback Icon */}
            {businessInfo?.logo || businessInfo?.imageSlots?.logo ? (
              <img
                src={businessInfo?.logo || businessInfo?.imageSlots?.logo}
                alt={businessInfo?.name || "Business Logo"}
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-md border border-zinc-200 bg-white p-0.5 shrink-0"
                onError={(e: any) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-zinc-900 text-white flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="font-bold text-sm sm:text-base text-zinc-900 tracking-tight leading-none truncate">
                  {businessInfo?.name ? `${businessInfo.name} Console` : 'Merchant Operations Console'}
                </h1>
                <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-zinc-300 shrink-0" />
                {/* Live Sync Active Badge */}
                <div
                  className="hidden sm:flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-0.5 rounded-md text-[11px] font-medium text-emerald-800 shrink-0"
                  title="Database Health: Optimal · Live Order & Catalog Sync Operational"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Live Sync Active</span>
                  <span className="text-emerald-300">·</span>
                  <span className="text-emerald-700">Real-time</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 hidden sm:block mt-0.5 truncate">
                Customer Orders Ledger & Storefront Engine
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Manual Sync Orders Button */}
          <button
            type="button"
            onClick={fetchOrders}
            disabled={isSyncing}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">{isSyncing ? 'Syncing...' : 'Sync Orders'}</span>
            <span className="xs:hidden">{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <Link
            to="/"
            className="bg-black hover:bg-zinc-800 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer hidden sm:inline-flex items-center"
          >
            Open Storefront
          </Link>

          {/* Secure Logout Action */}
          <button
            type="button"
            onClick={handleLogout}
            className="border border-zinc-200 hover:border-red-200 bg-white hover:bg-red-50 text-zinc-600 hover:text-red-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Log out and end administrative session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Secure Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 min-w-0">
        {/* Multi-Tab Navigation Controls */}
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 overflow-x-auto max-w-full no-scrollbar">
          <button
            onClick={() => setActiveTab('orders')}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'orders'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Customer Orders</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                activeTab === 'orders'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'inventory'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product Inventory</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                activeTab === 'inventory'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {inventory.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'settings'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Storefront Settings</span>
          </button>

        </div>

        {/* TAB: CUSTOMER ORDERS LIST (Catalog Storefront) */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Storefront Order Alerts Card */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-900">
                    {alertState === 'blocked' ? (
                      <BellOff className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <Bell className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-zinc-900">Storefront Order Alerts</h3>
                      {alertState === 'subscribed' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Alerts Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                      {alertState === 'subscribed' && 'You will receive instant lock-screen notifications for new customer orders.'}
                      {alertState === 'ready' && 'Get instant push notifications on this device whenever a customer places an order.'}
                      {alertState === 'ios_browser' && 'Live sound alerts are active in this tab. For iPhone/iPad lock-screen alerts, tap Share → Add to Home Screen, then reopen.'}
                      {alertState === 'blocked' && 'Notifications are blocked in your browser settings. Allow them for this site to enable lock-screen alerts.'}
                      {alertState === 'unsupported' && 'Live sound alerts are active while this dashboard is open.'}
                      {alertState === 'loading' && 'Checking notification status...'}
                    </p>
                    {alertError && (
                      <p className="text-xs font-medium text-red-600 mt-1">{alertError}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                  {/* Web Audio Chime Sound Toggle */}
                  <button
                    type="button"
                    onClick={toggleSound}
                    title={isSoundEnabled ? 'Mute alert chime' : 'Unmute alert chime'}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                      isSoundEnabled
                        ? 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200'
                    }`}
                  >
                    {isSoundEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-zinc-700" />
                        <span>Sound On</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Muted</span>
                      </>
                    )}
                  </button>

                  {/* Push Action Button */}
                  {alertState === 'subscribed' && (
                    <button
                      type="button"
                      disabled={isUpdatingAlerts}
                      onClick={handleDisableAlerts}
                      className="bg-zinc-100 text-zinc-700 hover:bg-zinc-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      {isUpdatingAlerts ? 'Updating...' : 'Disable'}
                    </button>
                  )}

                  {alertState === 'ready' && (
                    <button
                      type="button"
                      disabled={isUpdatingAlerts}
                      onClick={handleEnableAlerts}
                      className="bg-zinc-900 text-white hover:bg-zinc-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{isUpdatingAlerts ? 'Enabling...' : 'Enable Order Alerts'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Orders Filter & Search Controls */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by order ID, customer name, phone, address..."
                    value={orderSearchQuery}
                    onChange={e => setOrderSearchQuery(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                  />
                  {orderSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
                  {['all', 'pending', 'processing', 'completed', 'cancelled'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setOrderStatusFilter(status)}
                      className={`capitalize px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        orderStatusFilter === status
                          ? 'bg-zinc-900 text-white shadow-2xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Orders Workspace: List + Details */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center space-y-3 shadow-xs">
                <ShoppingBag className="w-12 h-12 text-zinc-300 mx-auto" />
                <h3 className="text-base font-semibold text-zinc-900">
                  {orders.length === 0 ? 'No Customer Orders Yet' : 'No matching orders found'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {orders.length === 0
                    ? 'When visitors place orders through your storefront catalog, they will appear here in real-time with sound and push alerts.'
                    : 'Try clearing your search query or switching your status filter to "All".'}
                </p>
                {orders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrderSearchQuery('');
                      setOrderStatusFilter('all');
                    }}
                    className="text-xs font-semibold text-zinc-900 hover:underline pt-2 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Orders List */}
                <div className="lg:col-span-7 space-y-3">
                  {filteredOrders.map(order => {
                    const isSelected = selectedOrder?.id === order.id;
                    const itemCount = (order.items || []).reduce((s, i) => s + (i.quantity || 1), 0);

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer shadow-xs ${
                          isSelected
                            ? 'border-zinc-900 ring-2 ring-zinc-900/10'
                            : 'border-zinc-200 hover:border-zinc-400 hover:shadow-md hover:-translate-y-0.5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-zinc-900">
                                {order.id}
                              </span>
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

                            <div className="text-sm font-semibold text-zinc-900 truncate">
                              {order.customerName}
                            </div>

                            <div className="text-xs text-zinc-500 flex items-center gap-1.5 flex-wrap">
                              <Phone className="w-3.5 h-3.5 text-zinc-400" />
                              <span>{order.customerPhone}</span>
                              <span className="text-zinc-300">·</span>
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-base text-zinc-900 tabular-nums">
                              {effectiveCurrencySymbol} {order.total.toLocaleString()}
                            </div>
                            <span className="text-[11px] text-zinc-400 font-mono">
                              {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </div>

                        {/* Items preview tag */}
                        <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 flex items-center justify-between gap-2">
                          <span className="truncate">
                            {(order.items || []).map(i => `${i.name} (x${i.quantity || 1})`).join(', ') || 'Order details'}
                          </span>
                          <span className="text-zinc-400 text-[11px] shrink-0 font-mono">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Order Detail Pane */}
                {selectedOrder && (
                  <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200 p-5 sm:p-6 shadow-sm sticky top-20 space-y-5">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                      <div>
                        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                          Order Details
                        </span>
                        <h4 className="font-mono font-bold text-base text-zinc-900">
                          {selectedOrder.id}
                        </h4>
                      </div>

                      {/* Status Dropdown */}
                      <select
                        value={selectedOrder.status}
                        onChange={e => handleUpdateOrderStatus(selectedOrder.id, e.target.value as OrderStatus)}
                        className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-800 capitalize focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* Customer Info Card */}
                    <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          Customer:
                        </span>
                        <span className="font-semibold text-zinc-900">{selectedOrder.customerName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-zinc-400" />
                          Contact:
                        </span>
                        <span className="font-medium text-zinc-900 font-mono">{selectedOrder.customerPhone}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 pt-1 border-t border-zinc-200/60">
                        <span className="text-zinc-500 flex items-center gap-1.5 shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          Address:
                        </span>
                        <span className="font-medium text-zinc-800 text-right">{selectedOrder.customerAddress}</span>
                      </div>
                      {selectedOrder.notes && (
                        <div className="flex items-start justify-between gap-3 pt-1 border-t border-zinc-200/60">
                          <span className="text-zinc-500 flex items-center gap-1.5 shrink-0">
                            <FileText className="w-3.5 h-3.5 text-zinc-400" />
                            Notes:
                          </span>
                          <span className="font-medium text-zinc-700 text-right">{selectedOrder.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="space-y-2">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                        Ordered Items ({(selectedOrder.items || []).reduce((s, i) => s + (i.quantity || 1), 0)})
                      </h5>
                      <div className="divide-y divide-zinc-100 max-h-56 overflow-y-auto">
                        {(selectedOrder.items || []).map((item, idx) => {
                          const itemImg = getProductPrimaryImage(item);
                          return (
                            <div key={item.id || idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={itemImg}
                                  alt={item.name}
                                  className="w-9 h-9 rounded-lg object-cover bg-zinc-100 shrink-0 border border-zinc-200"
                                  onError={handleImageError}
                                />
                                <div className="min-w-0">
                                  <p className="font-medium text-zinc-900 truncate">{item.name}</p>
                                  <p className="text-[11px] text-zinc-400 font-mono">
                                    {effectiveCurrencySymbol} {item.price.toLocaleString()} × {item.quantity}
                                  </p>
                                </div>
                              </div>
                              <span className="font-mono font-semibold text-zinc-900 tabular-nums shrink-0">
                                {effectiveCurrencySymbol} {((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Order Total & Actions */}
                    <div className="pt-3 border-t border-zinc-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-zinc-700">Total Due:</span>
                        <span className="text-xl font-bold font-mono text-zinc-900 tabular-nums">
                          {effectiveCurrencySymbol} {selectedOrder.total.toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyOrderSummary(selectedOrder)}
                        className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        {copiedOrderId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedOrderId ? 'Order Summary Copied!' : 'Copy Order Summary'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: PRODUCT INVENTORY (Catalog Storefront) */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs divide-y divide-zinc-100">
            {/* Header with primary action: + Upload Product */}
            <div className="p-4 sm:p-5 bg-zinc-50/70 border-b border-zinc-200 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wider block font-mono">
                  Inventory Registry
                </span>
                <span className="text-[11px] text-zinc-500">
                  {inventory.length} active catalog {inventory.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleOpenAddProduct}
                className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs font-sans"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Product</span>
              </button>
            </div>

            {/* Quick Upload Product Card */}
            <div className="p-4 sm:p-5 bg-zinc-50/40 border-b border-zinc-200">
              <div
                onClick={handleOpenAddProduct}
                className="border-2 border-dashed border-zinc-200 hover:border-zinc-800 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer bg-white hover:bg-zinc-50/80 group flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-11 h-11 rounded-xl bg-zinc-100 group-hover:bg-zinc-900 group-hover:text-white flex items-center justify-center text-zinc-700 transition-colors shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-zinc-900">Upload Product to Catalog</h4>
                    <p className="text-[11px] sm:text-xs text-zinc-500">
                      Upload media assets (up to 5), set stock & pricing, and publish new items to your live storefront.
                    </p>
                  </div>
                </div>

                <span className="bg-zinc-900 group-hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-xs">
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Product</span>
                </span>
              </div>
            </div>

            {/* Products List */}
            {inventory.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <Package className="w-12 h-12 text-zinc-300 mx-auto" />
                <h4 className="text-sm font-semibold text-zinc-800">No products in inventory</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Your catalog currently has zero items. Click below to add your first product with images, pricing, and stock.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddProduct}
                  className="bg-zinc-900 text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload First Product</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {inventory.map((item) => {
                  const itemImg = getProductPrimaryImage(item);
                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors"
                    >
                      {/* Item Info */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <img
                          src={itemImg}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover bg-zinc-100 shrink-0 border border-zinc-200 transition-transform hover:scale-105"
                          onError={handleImageError}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                              {item.name}
                            </h4>
                            {item.badge && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                            <span className="font-mono text-zinc-400 font-medium">
                              {item.category || 'General'}
                            </span>
                            <span>·</span>
                            <span className="font-mono font-bold text-zinc-900">
                              {effectiveCurrencySymbol} {item.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controls: Stock Adjuster & Actions */}
                      <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                        {/* Stock Stepper */}
                        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                          <span className="text-[10px] font-mono text-zinc-400 px-1 uppercase">Stock:</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(item.id, -1)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-colors cursor-pointer text-xs"
                            title="Decrease stock"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold font-mono px-1.5 tabular-nums min-w-[20px] text-center">
                            {item.stock ?? 10}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(item.id, 1)}
                            className="w-6 h-6 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center transition-colors cursor-pointer text-xs"
                            title="Increase stock"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Edit & Delete Buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(item)}
                            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {deleteConfirmProductId === item.id ? (
                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200">
                              <span className="text-[10px] font-semibold text-red-700 px-1">Delete?</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(item.id)}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmProductId(null)}
                                className="px-2 py-0.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded text-[11px] font-semibold transition cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmProductId(item.id)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STUDIO SETTINGS */}
        {activeTab === 'settings' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-[60%]">
              <form onSubmit={handleSaveBusinessInfo} className="space-y-4">
              <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Business Identity & Branding</h3>
                    <p className="text-xs text-zinc-500">Live values injected directly into MasterTheme.tsx</p>
                  </div>
                  {bizSavedNotice && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved & Published</span>
                    </span>
                  )}
                </div>

                {/* Business Name & Tagline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={businessInfo.name}
                      onChange={e => setBusinessInfo({ ...businessInfo, name: e.target.value })}
                      placeholder="e.g. Salons on Sixth"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Tagline / Subhead <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={businessInfo.tagline}
                      onChange={e => setBusinessInfo({ ...businessInfo, tagline: e.target.value })}
                      placeholder="e.g. Precision Craftsmanship & Tailored Care"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                {/* WhatsApp & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      WhatsApp Number (Intl digits) <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={businessInfo.whatsapp}
                      onChange={e => setBusinessInfo({ ...businessInfo, whatsapp: e.target.value })}
                      placeholder="e.g. 923322264855"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Display Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={businessInfo.phone}
                      onChange={e => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                      placeholder="e.g. +1 (409) 256-3597"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                {/* Currency Code & Symbol */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Currency Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={businessInfo.currency}
                      onChange={e => setBusinessInfo({ ...businessInfo, currency: e.target.value })}
                      placeholder="e.g. USD, PKR, AED"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Currency Symbol <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={businessInfo.currencySymbol}
                      onChange={e => setBusinessInfo({ ...businessInfo, currencySymbol: e.target.value })}
                      placeholder="e.g. $, Rs., د.إ"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Studio Physical Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={businessInfo.address}
                    onChange={e => setBusinessInfo({ ...businessInfo, address: e.target.value })}
                    placeholder="e.g. 811 6th St N #200, Texas City, TX 77590"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                {/* Operating Hours & Google Maps URL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Operating Hours <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={businessInfo.hours}
                      onChange={e => setBusinessInfo({ ...businessInfo, hours: e.target.value })}
                      placeholder="e.g. Mon–Sat, Closes 5:00 PM"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Google Maps Link
                    </label>
                    <input
                      type="url"
                      value={businessInfo.mapsUrl}
                      onChange={e => setBusinessInfo({ ...businessInfo, mapsUrl: e.target.value })}
                      placeholder="https://maps.google.com/..."
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                {/* Rating & Review Count */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Rating Score
                    </label>
                    <input
                      type="text"
                      value={businessInfo.rating}
                      onChange={e => setBusinessInfo({ ...businessInfo, rating: e.target.value })}
                      placeholder="e.g. 4.8"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Review Count / Trust Detail
                    </label>
                    <input
                      type="text"
                      value={businessInfo.reviewCount}
                      onChange={e => setBusinessInfo({ ...businessInfo, reviewCount: e.target.value })}
                      placeholder="e.g. 24+ Google Reviews"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                {/* Announcement Marquee Banner */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Announcement Banner Text (Marquee Ticker)
                  </label>
                  <input
                    type="text"
                    value={businessInfo.promoText || ''}
                    onChange={e => setBusinessInfo(prev => ({ ...prev, promoText: e.target.value }))}
                    placeholder="e.g. ⚡ FREE WORLDWIDE EXPRESS SHIPPING ON ORDERS OVER $50 • NEW COLLECTION LIVE ⚡"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                {/* Storefront Dynamic Copy Controls */}
                <div className="pt-2 border-t border-zinc-100 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    Storefront Section Copy
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Hero Headline
                    </label>
                    <input
                      type="text"
                      value={businessInfo.heroHeadline || ''}
                      onChange={e => setBusinessInfo(prev => ({ ...prev, heroHeadline: e.target.value }))}
                      placeholder="e.g. Curated Essentials. Uncompromising Craft."
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Hero Subheadline
                    </label>
                    <textarea
                      rows={2}
                      value={businessInfo.heroSubheadline || ''}
                      onChange={e => setBusinessInfo(prev => ({ ...prev, heroSubheadline: e.target.value }))}
                      placeholder="e.g. Explore our handcrafted catalog of signature products, premium materials, and fast direct-to-door delivery."
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                    />
                  </div>

                  {/* Hero Slideshow Gallery Grid */}
                  <div className="bg-zinc-900 bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-white">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-white mb-2">Hero Slideshow Gallery</h3>
                      <p className="text-sm text-white/60">Upload up to 3 high-resolution images for the storefront rotating hero section.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Slide 1 */}
                      <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
                        <label className="block text-sm font-bold text-white/80">Slide 1 (Primary)</label>
                        <input
                          type="text"
                          value={businessInfo?.heroImage || ''} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setBusinessInfo(prev => ({ ...prev, heroImage: val }));
                            setSlotInputs(prev => ({ ...prev, hero: val }));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--theme-primary)] text-sm"
                          placeholder="https://..."
                        />
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*" 
                            disabled={uploadingHeroKey === 'heroImage'}
                            onChange={(e) => {
                              const existingFileVar = e.target.files?.[0];
                              if (!existingFileVar || !existingFileVar.type.startsWith('image/')) {
                                e.target.value = '';
                                return alert('Please select a valid image file.');
                              }
                              handleHeroSlideUpload('heroImage', existingFileVar);
                              e.target.value = '';
                            }} 
                            className="w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--theme-primary)] file:text-white hover:file:opacity-90 cursor-pointer disabled:opacity-50" 
                          />
                          {uploadingHeroKey === 'heroImage' && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />}
                        </div>
                      </div>

                      {/* Slide 2 */}
                      <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
                        <label className="block text-sm font-bold text-white/80">Slide 2</label>
                        <input
                          type="text"
                          value={businessInfo?.heroImage2 || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBusinessInfo(prev => ({ ...prev, heroImage2: val }));
                            setSlotInputs(prev => ({ ...prev, hero2: val }));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--theme-primary)] text-sm"
                          placeholder="https://..."
                        />
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*" 
                            disabled={uploadingHeroKey === 'heroImage2'}
                            onChange={(e) => {
                              const existingFileVar = e.target.files?.[0];
                              if (!existingFileVar || !existingFileVar.type.startsWith('image/')) {
                                e.target.value = '';
                                return alert('Please select a valid image file.');
                              }
                              handleHeroSlideUpload('heroImage2', existingFileVar);
                              e.target.value = '';
                            }} 
                            className="w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--theme-primary)] file:text-white hover:file:opacity-90 cursor-pointer disabled:opacity-50" 
                          />
                          {uploadingHeroKey === 'heroImage2' && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />}
                        </div>
                      </div>

                      {/* Slide 3 */}
                      <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
                        <label className="block text-sm font-bold text-white/80">Slide 3</label>
                        <input
                          type="text"
                          value={businessInfo?.heroImage3 || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBusinessInfo(prev => ({ ...prev, heroImage3: val }));
                            setSlotInputs(prev => ({ ...prev, hero3: val }));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--theme-primary)] text-sm"
                          placeholder="https://..."
                        />
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*" 
                            disabled={uploadingHeroKey === 'heroImage3'}
                            onChange={(e) => {
                              const existingFileVar = e.target.files?.[0];
                              if (!existingFileVar || !existingFileVar.type.startsWith('image/')) {
                                e.target.value = '';
                                return alert('Please select a valid image file.');
                              }
                              handleHeroSlideUpload('heroImage3', existingFileVar);
                              e.target.value = '';
                            }} 
                            className="w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--theme-primary)] file:text-white hover:file:opacity-90 cursor-pointer disabled:opacity-50" 
                          />
                          {uploadingHeroKey === 'heroImage3' && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      About Description
                    </label>
                    <textarea
                      rows={3}
                      value={businessInfo.aboutDescription || ''}
                      onChange={e => setBusinessInfo(prev => ({ ...prev, aboutDescription: e.target.value }))}
                      placeholder="e.g. Founded on the philosophy that wellness and beauty should be an unhurried, tailor-made ritual..."
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      CTA Headline
                    </label>
                    <input
                      type="text"
                      value={businessInfo.ctaHeadline || ''}
                      onChange={e => setBusinessInfo(prev => ({ ...prev, ctaHeadline: e.target.value }))}
                      placeholder="e.g. Ready for an Exceptional Experience?"
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">
                    Changes sync directly to Live Edge Database and trigger instant live updates in AITheme.
                  </span>
                  <button
                    type="submit"
                    disabled={bizSaving}
                    className="bg-black hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    {bizSaving ? (
                      <>
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <span>Save Studio Settings</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* RIGHT PANE (40%) - IMAGE SLOT MANAGER */}
          <div className="w-full lg:w-[40%] flex flex-col">
            <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs sticky top-20 space-y-4">
              <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Image Slot Manager</span>
                  </h3>
                  <p className="text-xs text-zinc-500">Live slot updates via `waas-update-slot-image`</p>
                </div>
                {slotNotice && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {slotNotice}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {[
                  { slot: 'hero' as const, title: 'Hero Visual Slot (Slide 1)', desc: 'Main architectural studio visual displayed in hero section (Slide 1).' },
                  { slot: 'hero2' as const, title: 'Hero Slideshow (Slide 2)', desc: 'Second image in the cinematic hero card fan-out & slideshow.' },
                  { slot: 'hero3' as const, title: 'Hero Slideshow (Slide 3)', desc: 'Third image in the cinematic hero card fan-out & slideshow.' },
                  { slot: 'logo' as const, title: 'Brand Logo Slot', desc: 'Optional custom logo replacing header text title.' },
                  { slot: 'about' as const, title: 'About Section Slot', desc: 'Portrait / team photo in boutique standards section.' },
                  { slot: 'promo' as const, title: 'Promotional Banner Slot', desc: 'Optional background or accent showcase slot.' },
                ]
                  .filter(item => !['hero', 'hero2', 'hero3'].includes(item.slot))
                  .map(({ slot, title, desc }) => {
                  const currentUrl = slotInputs[slot] || '';
                  const isUploading = uploadingSlot === slot;
                  return (
                    <div key={slot} className="border border-zinc-100 bg-zinc-50/50 p-3.5 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-zinc-900">{title}</span>
                          <span className="ml-1.5 text-[10px] font-mono uppercase bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded">
                            {slot}
                          </span>
                        </div>
                        {currentUrl && (
                          <a
                            href={currentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-zinc-400 hover:text-zinc-700 inline-flex items-center gap-1"
                          >
                            <span>Preview</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-tight">{desc}</p>

                      {/* Native File Upload & Preview Grid */}
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-lg border border-zinc-200 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                          {currentUrl ? (
                            <img
                              src={currentUrl}
                              alt={slot}
                              className="w-full h-full object-cover"
                              onError={handleImageError}
                            />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-zinc-300" />
                          )}
                        </div>

                        <div className="flex-1 space-y-1.5">
                          {/* Native File Upload Button */}
                          <div>
                            <input
                              id={`slot-file-input-${slot}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={isUploading}
                              onChange={e => {
                                const existingFileVar = e.target.files?.[0];
                                if (!existingFileVar || !existingFileVar.type.startsWith('image/')) {
                                  e.target.value = '';
                                  return alert('Please select a valid image file.');
                                }
                                handleSlotFileUpload(slot, existingFileVar);
                                e.target.value = '';
                              }}
                            />
                            <label
                              htmlFor={`slot-file-input-${slot}`}
                              className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs ${
                                isUploading
                                  ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                                  : 'bg-black hover:bg-zinc-800 text-white'
                              }`}
                            >
                              {isUploading ? (
                                <>
                                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                                  <span>Uploading to Secure Media Vault...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>Upload from Computer</span>
                                </>
                              )}
                            </label>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            Auto-optimizes & saves directly to Secure Media Vault
                          </p>
                        </div>
                      </div>

                      {/* Manual / External Image URL Field */}
                      <div className="flex items-center gap-2 pt-1.5 border-t border-zinc-200/60">
                        <input
                          type="text"
                          value={slotInputs[slot] || ''}
                          onChange={e => setSlotInputs({ ...slotInputs, [slot]: e.target.value })}
                          placeholder={`Or paste image URL for ${slot}...`}
                          className="flex-1 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateSlot(slot)}
                          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-zinc-200 transition-colors cursor-pointer shrink-0"
                          title="Broadcast manual URL update to EditableImage"
                        >
                          Apply URL
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ADD / EDIT PRODUCT MODAL (Catalog Engine) */}

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
                  Storefront Products · Multi-Asset Gallery & Instant Sync
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsProductModalOpen(false);
                  setEditingProduct(null);
                  setProductError(null);
                  setProductUploadError(null);
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
                <label className="text-xs font-semibold text-zinc-700 block mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Classic Linen Shirt"
                  value={productForm.name}
                  onChange={e => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                />
              </div>

              {/* Category & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">
                    Category
                  </label>
                  <select
                    value={productForm.category}
                    onChange={e => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
                  >
                    <option value="Workspace">Workspace</option>
                    <option value="Lifestyle">Lifestyle</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Custom">Custom Category...</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">
                    Badge <span className="text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Popular, Featured, Sale"
                    value={productForm.badge}
                    onChange={e => setProductForm(prev => ({ ...prev, badge: e.target.value }))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                  />
                </div>
              </div>

              {productForm.category === 'Custom' && (
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">
                    Custom Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ceramics, Wellness, Books"
                    value={productForm.customCategory}
                    onChange={e => setProductForm(prev => ({ ...prev, customCategory: e.target.value }))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
                  />
                </div>
              )}

              {/* Price & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">
                    Price ({effectiveCurrencySymbol}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={productForm.price || ''}
                    onChange={e => setProductForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">
                    Available Stock <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={productForm.stock}
                    onChange={e => setProductForm(prev => ({ ...prev, stock: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Multi-Media Asset Gallery Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 block">
                    Product Gallery ({productForm.images.length}/5 images) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-zinc-400 font-mono">First photo is cover</span>
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsProductDragging(true); }}
                  onDragLeave={() => setIsProductDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsProductDragging(false);
                    if (e.dataTransfer.files?.length > 0) {
                      handleProductFilesUpload(e.dataTransfer.files);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                    isProductDragging
                      ? 'border-zinc-900 bg-zinc-50'
                      : 'border-zinc-200 hover:border-zinc-400 bg-zinc-50/50'
                  }`}
                >
                  <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-1.5" />
                  <p className="text-xs text-zinc-600 font-medium">
                    Drag & drop product images, or{' '}
                    <label className="text-zinc-900 underline cursor-pointer hover:text-black">
                      browse
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleProductFilesUpload(e.target.files);
                          }
                        }}
                      />
                    </label>
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Upload up to 5 photos (PNG, JPG, WEBP). Photos auto-optimized.
                  </p>
                </div>

                {/* Direct URL Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="Or paste direct image URL (https://...)"
                    value={customProductImageUrl}
                    onChange={(e) => setCustomProductImageUrl(e.target.value)}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddProductDirectUrl}
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer"
                  >
                    Add URL
                  </button>
                </div>

                {productUploadError && (
                  <p className="text-xs text-red-600 font-medium">{productUploadError}</p>
                )}

                {/* Thumbnails Strip */}
                {productForm.images.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {productForm.images.map((img, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100">
                        <img
                          src={img}
                          alt={`Product preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={handleImageError}
                        />
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 bg-zinc-900 text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-xs">
                            Cover
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryProductCover(idx)}
                              className="p-1 bg-white text-zinc-900 rounded hover:bg-zinc-100 cursor-pointer text-[10px]"
                              title="Set as cover photo"
                            >
                              ★
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveProductImage(idx)}
                            className="p-1 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Description */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">
                  Product Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail materials, features, sizing, or usage instructions..."
                  value={productForm.description}
                  onChange={e => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsProductModalOpen(false);
                    setEditingProduct(null);
                    setProductError(null);
                    setProductUploadError(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={productSaving}
                  className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-xs font-sans"
                >
                  {productSaving ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Product...</span>
                    </>
                  ) : (
                    <span>{editingProduct ? 'Save Product Changes' : 'Publish Product'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="w-full max-w-5xl mx-auto mt-16 bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-4 sm:p-8 shadow-2xl backdrop-blur-sm">
        <div className="border-b border-zinc-800 pb-6 mb-8">
          <h2 className="text-2xl font-black text-white tracking-tight">Storefront Theme Settings</h2>
          <p className="text-zinc-400 mt-2 text-sm">Update your live storefront colors instantly. Changes apply universally.</p>
        </div>
        
        {/* Quick Presets */}
        <div className="mb-10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">1-Click Presets</h3>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={isDeployingTheme} onClick={() => setThemeForm({ primaryColor: "#0ea5e9", bgColor: "#ffffff", textColor: "#0f172a" })} className="px-5 py-2.5 rounded-xl bg-white text-zinc-900 text-sm font-bold border border-zinc-200 transition-transform hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Ocean Light</button>
            <button type="button" disabled={isDeployingTheme} onClick={() => setThemeForm({ primaryColor: "#10b981", bgColor: "#09090b", textColor: "#ffffff" })} className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-bold border border-zinc-800 transition-transform hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Neon Midnight</button>
            <button type="button" disabled={isDeployingTheme} onClick={() => setThemeForm({ primaryColor: "#d97706", bgColor: "#1c1917", textColor: "#f5f5f4" })} className="px-5 py-2.5 rounded-xl bg-stone-900 text-stone-100 text-sm font-bold border border-stone-700 transition-transform hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Luxury Amber</button>
          </div>
        </div>

        {/* Explicit Native Color Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Primary */}
          <div className="flex flex-col">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Primary Color</label>
            <div className="flex items-center gap-4 bg-black/50 p-3 rounded-2xl border border-zinc-800 transition-colors focus-within:border-zinc-600">
              <input type="color" value={themeForm.primaryColor} onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })} className="h-10 w-10 rounded-lg cursor-pointer border-0 bg-transparent p-0 flex-shrink-0" />
              <span className="text-sm text-white font-mono uppercase tracking-widest opacity-80">{themeForm.primaryColor}</span>
            </div>
          </div>
          {/* Background */}
          <div className="flex flex-col">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Background Color</label>
            <div className="flex items-center gap-4 bg-black/50 p-3 rounded-2xl border border-zinc-800 transition-colors focus-within:border-zinc-600">
              <input type="color" value={themeForm.bgColor} onChange={(e) => setThemeForm({ ...themeForm, bgColor: e.target.value })} className="h-10 w-10 rounded-lg cursor-pointer border-0 bg-transparent p-0 flex-shrink-0" />
              <span className="text-sm text-white font-mono uppercase tracking-widest opacity-80">{themeForm.bgColor}</span>
            </div>
          </div>
          {/* Text */}
          <div className="flex flex-col">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Text Color</label>
            <div className="flex items-center gap-4 bg-black/50 p-3 rounded-2xl border border-zinc-800 transition-colors focus-within:border-zinc-600">
              <input type="color" value={themeForm.textColor} onChange={(e) => setThemeForm({ ...themeForm, textColor: e.target.value })} className="h-10 w-10 rounded-lg cursor-pointer border-0 bg-transparent p-0 flex-shrink-0" />
              <span className="text-sm text-white font-mono uppercase tracking-widest opacity-80">{themeForm.textColor}</span>
            </div>
          </div>
        </div>

        {/* Isolated Live Preview Sandbox */}
        <div className="mb-10 overflow-hidden rounded-3xl border border-zinc-800 shadow-2xl transition-colors duration-300" style={{ backgroundColor: themeForm.bgColor }}>
          <div className="p-4 border-b border-white/5 bg-black/10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 text-center" style={{ color: themeForm.textColor }}>Live Storefront Preview</h3>
          </div>
          <div className="p-4 sm:p-8 md:p-12">
            <div className="max-w-md mx-auto p-4 sm:p-8 rounded-3xl border bg-transparent backdrop-blur-md shadow-xl transition-colors duration-300" style={{ borderColor: `${themeForm.textColor}20` }}>
              <h4 className="text-3xl font-black mb-3 transition-colors duration-300" style={{ color: themeForm.textColor }}>Signature Product</h4>
              <p className="text-sm mb-8 opacity-70 leading-relaxed transition-colors duration-300" style={{ color: themeForm.textColor }}>This is an exact physical replica of how your chosen colors will render for your customers.</p>
              <button type="button" className="w-full py-4 rounded-2xl font-black shadow-lg transition-transform duration-300 hover:scale-[1.02] active:scale-95" style={{ backgroundColor: themeForm.primaryColor, color: themeForm.bgColor }}>
                Add to Bag
              </button>
            </div>
          </div>
        </div>

        {/* Deploy Action */}
        <div className="flex justify-end pt-8 border-t border-zinc-800">
          <button 
            type="button"
            onClick={handleSaveTheme}
            disabled={isDeployingTheme}
            className="px-8 py-4 rounded-2xl bg-blue-600 text-white font-black tracking-wide shadow-xl shadow-blue-900/20 transition-all hover:bg-blue-500 hover:shadow-blue-900/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-full sm:w-auto min-w-0 sm:min-w-[200px]"
          >
            {isDeployingTheme ? "Deploying Database Sync..." : "Deploy Theme"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Default export alias to support both import { Admin } and default import
export default Admin;
