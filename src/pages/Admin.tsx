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
import type { Appointment, AppointmentStatus, Order, OrderStatus, Product, Service } from '../lib/types';
import { clearAdminToken, getAuthHeaders } from '../lib/auth';
import {
  saveStoredServices,
  fetchCatalogServices,
  persistService,
  removeService,
  SERVICES_UPDATED_EVENT,
  resolveImageUrl,
  getServicePrimaryImage,
  handleImageError,
  parseDurationMinutes,
} from '../lib/services';
import {
  getStoredProducts,
  fetchCatalogProducts,
  persistProduct,
  removeProduct,
  CATALOG_UPDATED_EVENT,
  getProductPrimaryImage,
} from '../lib/products';
import {
  getStoredBusinessInfo,
  fetchBusinessInfo,
  persistBusinessInfo,
  saveImageSlot,
  BUSINESS_INFO_UPDATED_EVENT,
} from '../lib/businessInfo';
import type { BusinessInfo } from '../lib/types';
import { clientConfig } from '../config/client';
import { compressHero, compressService, compressLogo } from '../utils/imageCompression';


export const FALLBACK_APPOINTMENTS: Appointment[] = [];

const PRESET_SAMPLE_IMAGES = [
  { label: 'Dental Care', url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&q=80' },
  { label: 'Consultation', url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=800&q=80' },
  { label: 'Wellness & Therapy', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80' },
  { label: 'Clinical Care', url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80' },
  { label: 'Salon Styling', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80' },
  { label: 'Spa Treatment', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80' },
];

// Service Form Interface for Type-Safe Multi-Industry WaaS Adaptability
export interface ServiceFormData {
  name: string;
  category: string;
  customCategory?: string;
  price: number;
  duration: string;
  description: string;
  images: string[];
  imageUrls?: string[];
  badge: string;
}

export const DURATION_PRESETS: string[] = ['30 Minutes', '45 Minutes', '1 Hour', '90 Mins', '2 Hours', '15 Mins'];

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
  const [activeTab, setActiveTab] = useState<'appointments' | 'orders' | 'services' | 'inventory' | 'settings'>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Product[]>(() => getStoredProducts());
  const [services, setServices] = useState<Service[]>([]);
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
  const seenAppointmentIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedAppointmentsRef = useRef<boolean>(false);
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
      console.error('Failed to enable booking alerts:', err);
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

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'online' | 'syncing'>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState(false);

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

  // Service Modal State (Booking Engine)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] = useState<boolean>(false);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);

  const existingCategories: string[] = useMemo(() => {
    if (!Array.isArray(services)) return [];
    const catMap = new Map<string, string>();
    services
      .map(s => s.category?.trim())
      .filter((c): c is string => typeof c === 'string' && c.length > 0 && c !== '__CUSTOM__')
      .forEach(c => {
        const lower = c.toLowerCase();
        if (!catMap.has(lower)) {
          catMap.set(lower, c);
        }
      });
    return Array.from(catMap.values());
  }, [services]);

  const [serviceForm, setServiceForm] = useState<ServiceFormData>({
    name: '',
    category: '',
    customCategory: '',
    price: 60,
    duration: DURATION_PRESETS[0],
    description: '',
    images: [],
    badge: '',
  });
  const formData = serviceForm;
  const setFormData = setServiceForm;
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);

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

  const handleFilesUpload = async (filesList: FileList | File[]) => {
    const rawFiles = Array.from(filesList);
    const validFiles = rawFiles.filter(f => f.type.startsWith('image/'));

    if (validFiles.length === 0) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP, AVIF).');
      return;
    }

    setUploadError(null);
    setUploadNotice(null);

    const targetFile = validFiles[0];
    const newAsset: UploadingAsset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      previewUrl: URL.createObjectURL(targetFile),
      name: targetFile.name,
    };

    setUploadingAssets([newAsset]);

    try {
      const compressedTarget = await compressService(targetFile);
      const localDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(compressedTarget);
      });
      const formData = new FormData();
      formData.append('file', compressedTarget);
      const res = await fetch('/api/upload', { credentials: 'include',
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });
      if (res.status === 401) {
        clearAdminToken();
        if (onLogout) onLogout();
        setUploadError('Session expired. Please log in again.');
        return;
      }
      let cleanUrl = '';
      if (res.ok) {
        const data: any = await res.json();
        if (data.success && (data.imageUrl || data.url || (Array.isArray(data.imageUrls) && data.imageUrls[0]))) {
          const rawUrl = data.imageUrl || data.url || data.imageUrls[0];

          // 1. THE NULL-POINTER SHIELD
          if (!rawUrl || typeof rawUrl !== 'string') {
            throw new Error('Upload succeeded but returned an invalid image URL');
          }

          // 2. THE ABSOLUTE STRIPPER & 3. THE ENCODING PRESERVATION
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
        }
      }

      if (!cleanUrl && localDataUrl) {
        cleanUrl = localDataUrl;
      }

      if (cleanUrl) {
        setServiceForm(prev => ({
          ...prev,
          images: [cleanUrl],
          imageUrls: [cleanUrl],
        }));
      } else {
        setUploadError('Upload failed. Please try again.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      URL.revokeObjectURL(newAsset.previewUrl);
      setUploadingAssets([]);
    }
  };

  const handleAddDirectUrl = () => {
    const trimmed = customImageUrl.trim();
    if (!trimmed) return;
    if (!/^(https?:\/\/|data:image\/|\/)/i.test(trimmed)) {
      setUploadError('Please enter a valid URL starting with http://, https://, or /');
      return;
    }
    setServiceForm(prev => ({
      ...prev,
      images: [trimmed],
      imageUrls: [trimmed],
    }));
    setCustomImageUrl('');
    setUploadError(null);
  };

  const handleAddPreset = (url: string) => {
    setServiceForm(prev => ({
      ...prev,
      images: [url],
      imageUrls: [url],
    }));
    setUploadError(null);
  };

  const handleRemoveImage = () => {
    setServiceForm(prev => ({
      ...prev,
      images: [],
      imageUrls: [],
    }));
    setUploadError(null);
    setUploadNotice(null);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  // Fetch appointments from live Turso operations endpoint
  const fetchAppointments = async () => {
    setIsSyncing(true);
    setSystemStatus('syncing');
    try {
      let res = await fetch(`/api/bookings?t=${Date.now()}`, { cache: 'no-store', credentials: 'include', headers: getAuthHeaders() }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`/api/appointments?t=${Date.now()}`, { cache: 'no-store', credentials: 'include', headers: getAuthHeaders() }).catch(() => null);
      }
      if (!res || !res.ok) {
        res = await fetch(`/bookings?t=${Date.now()}`, { cache: 'no-store', credentials: 'include', headers: getAuthHeaders() }).catch(() => null);
      }

      if (res && res.status === 401) {
        clearAdminToken();
        if (onLogout) onLogout();
        return;
      }
      if (!res || !res.ok) throw new Error('Network error');
      const data: any = await res.json();

      const rawList = Array.isArray(data)
        ? data
        : (Array.isArray(data?.appointments)
          ? data.appointments
          : (Array.isArray(data?.bookings)
            ? data.bookings
            : []));

      const currentIds = (rawList || []).map((b: any, idx: number) => String(b.id || `APT-${Date.now()}-${idx}`));

      if (!hasHydratedAppointmentsRef.current) {
        currentIds.forEach((id: string) => seenAppointmentIdsRef.current.add(id));
        hasHydratedAppointmentsRef.current = true;
      } else {
        let hasNew = false;
        for (const id of currentIds) {
          if (!seenAppointmentIdsRef.current.has(id)) {
            hasNew = true;
            seenAppointmentIdsRef.current.add(id);
          }
        }
        if (hasNew && isSoundEnabled) {
          playNotificationChime();
        }
      }

      if (rawList && rawList.length > 0) {
        const mapped: Appointment[] = rawList.map((b: any, idx: number) => {
          const serviceName =
            b.serviceName ||
            b.service_name ||
            b.service ||
            b.requested_service ||
            (Array.isArray(b.items) && b.items[0]?.name ? b.items.map((i: any) => i.name).join(', ') : 'Standard Service');
          const bookingDate =
            b.bookingDate ||
            b.booking_date ||
            b.date ||
            b.appointment_date ||
            (b.createdAt ? b.createdAt.split('T')[0] : (b.created_at ? b.created_at.split('T')[0] : 'Upcoming'));
          const bookingTime =
            b.bookingTime ||
            b.booking_time ||
            b.time ||
            b.appointment_time ||
            '10:00 AM';
          const rawPrice = Number(b.price || b.total || 0);
          const rawStatus = (b.status ? String(b.status).toLowerCase() : 'pending') as AppointmentStatus;
          const status = rawStatus === 'processing' ? 'confirmed' : rawStatus;

          return {
            id: String(b.id || `APT-${Date.now()}-${idx}`),
            customerName: b.customerName || b.customer_name || b.name || b.client_name || 'Valued Client',
            customerPhone: b.customerPhone || b.customer_phone || b.phone || b.client_phone || '',
            customerEmail: b.customerEmail || b.customer_email || b.email || '',
            serviceName,
            date: bookingDate,
            bookingDate,
            time: bookingTime,
            bookingTime,
            duration: b.duration || (b.duration_minutes ? `${b.duration_minutes} Mins` : undefined),
            notes: b.notes || b.customerNotes || b.customer_notes || b.message || '',
            status,
            price: rawPrice,
            total: rawPrice,
            createdAt: b.createdAt || b.created_at || new Date().toISOString(),
          };
        });

        setAppointments(mapped);
        if (!selectedAppointmentId && mapped[0]) {
          setSelectedAppointmentId(mapped[0].id);
        }
      } else {
        setAppointments([]);
        setSelectedAppointmentId(null);
      }
    } catch {
      // On network error, preserve existing state
    } finally {
      setIsSyncing(false);
      setSystemStatus('online');
    }
  };

  // Fetch orders from operations endpoint
  const fetchOrders = async () => {
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
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchOrders();

    // 15-second real-time polling with cleanup to prevent memory leaks
    const pollInterval = setInterval(() => {
      fetchAppointments();
      fetchOrders();
    }, 15000);

    // Fetch and sync live catalog services
    fetchCatalogServices().then(items => {
      if (Array.isArray(items)) {
        setServices(items);
      }
    });

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

    const handleServicesUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setServices(e.detail);
      }
    };
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
    window.addEventListener(SERVICES_UPDATED_EVENT, handleServicesUpdate);
    window.addEventListener(CATALOG_UPDATED_EVENT, handleCatalogUpdate);
    window.addEventListener(BUSINESS_INFO_UPDATED_EVENT, handleBizUpdate);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener(SERVICES_UPDATED_EVENT, handleServicesUpdate);
      window.removeEventListener(CATALOG_UPDATED_EVENT, handleCatalogUpdate);
      window.removeEventListener(BUSINESS_INFO_UPDATED_EVENT, handleBizUpdate);
    };
  }, []);


  // Update appointment status
  const handleUpdateStatus = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      const payload = JSON.stringify({ id: appointmentId, status: newStatus });
      const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
      const res = await fetch('/api/appointments', { credentials: 'include',
        method: 'PATCH',
        headers,
        body: payload,
      }).catch(() => null);
      if (res && res.status === 401) {
        clearAdminToken();
        if (onLogout) onLogout();
        return;
      }
      await fetch('/api/orders', { credentials: 'include',
        method: 'PATCH',
        headers,
        body: payload,
      }).catch(() => null);
    } catch (e) {
      console.warn('Status patch network note:', e);
    }

    setAppointments(prev =>
      prev.map(apt => (apt.id === appointmentId ? { ...apt, status: newStatus } : apt))
    );
  };

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

  // Service Modal open handlers (Booking Engine)
  const handleOpenAddService = () => {
    setEditingService(null);
    const defaultCat = existingCategories[0] || '';
    setIsCreatingCustomCategory(existingCategories.length === 0);
    setIsCustomDuration(false);
    setServiceForm({
      name: '',
      category: defaultCat,
      customCategory: '',
      price: 60,
      duration: DURATION_PRESETS[0],
      description: '',
      images: [],
      imageUrls: [],
      badge: '',
    });
    setServiceError(null);
    setUploadError(null);
    setUploadNotice(null);
    setUploadingAssets([]);
    setCustomImageUrl('');
    setIsServiceModalOpen(true);
  };

  const handleOpenEditService = (srv: Service) => {
    setEditingService(srv);
    const existingCover = (Array.isArray(srv.images) && srv.images.length > 0)
      ? srv.images[0]
      : (Array.isArray(srv.imageUrls) && srv.imageUrls.length > 0)
      ? srv.imageUrls[0]
      : (srv.image ? srv.image : (srv.image_path ? srv.image_path : ''));

    const initialImages = existingCover ? [existingCover] : [];
    const rawCategory = (srv.category || '').trim();
    const matchedCanonical = existingCategories.find(c => c.toLowerCase() === rawCategory.toLowerCase());

    if (matchedCanonical) {
      setIsCreatingCustomCategory(false);
    } else {
      setIsCreatingCustomCategory(true);
    }

    const rawDur = String(srv.duration ?? (srv.duration_minutes ? `${srv.duration_minutes} Minutes` : '')).trim();
    let matchedPreset = DURATION_PRESETS.find(p => p.toLowerCase() === rawDur.toLowerCase());
    if (!matchedPreset && /^\d+$/.test(rawDur)) {
      const num = parseInt(rawDur, 10);
      matchedPreset = DURATION_PRESETS.find(p => {
        const pLower = p.toLowerCase();
        return pLower.startsWith(`${num} `) || pLower.startsWith(`${num}min`) || (num === 60 && pLower.includes('1 hour'));
      });
    }

    if (matchedPreset) {
      setIsCustomDuration(false);
    } else {
      setIsCustomDuration(rawDur.length > 0);
    }

    const initialDuration = matchedPreset || rawDur || DURATION_PRESETS[0];

    setServiceForm({
      name: srv.name,
      category: matchedCanonical || rawCategory,
      customCategory: '',
      price: srv.price,
      duration: initialDuration,
      description: srv.description || '',
      images: initialImages,
      imageUrls: initialImages,
      badge: srv.badge || '',
    });
    setServiceError(null);
    setUploadError(null);
    setUploadNotice(null);
    setUploadingAssets([]);
    setCustomImageUrl('');
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name.trim()) {
      setServiceError('Service name is required.');
      return;
    }
    const cleanCategory = (serviceForm.category || '').trim();
    if (!cleanCategory || cleanCategory === '__CUSTOM__') {
      setServiceError('Please select or enter a valid category name.');
      return;
    }
    const cleanDuration = String(serviceForm.duration || '').trim();
    if (!cleanDuration || cleanDuration === '__CUSTOM__') {
      setServiceError('Please select or enter a valid service duration.');
      return;
    }
    if (serviceForm.price <= 0) {
      setServiceError('Price must be greater than 0.');
      return;
    }

    setServiceSaving(true);
    setServiceError(null);

    const coverImage = serviceForm.images[0]?.trim() || '';

    // GUARDRAIL 3: THE ARRAY GUARANTEE
    // Both the backend and the rendering logic expect an array for imageUrls / images.
    // Guarantee that the single image URL (coverImage) is wrapped in an array: coverImage ? [coverImage] : []
    // If the user deletes the image, send an empty array []
    const imageUrls: string[] = coverImage ? [coverImage] : [];
    const durationMins = parseDurationMinutes(cleanDuration);
    const serviceId = editingService ? editingService.id : `srv-${Date.now().toString().slice(-6)}`;

    const servicePayload: Service = {
      id: serviceId,
      name: serviceForm.name.trim(),
      category: cleanCategory,
      price: Number(serviceForm.price),
      duration: cleanDuration,
      duration_minutes: durationMins,
      description: serviceForm.description.trim(),
      images: imageUrls,
      imageUrls: imageUrls,
      image: coverImage,
      image_path: coverImage,
      badge: serviceForm.badge.trim() || undefined,
    };

    try {
      // 1. Send fetch POST request to /api/services with array wrapper in payload
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          id: servicePayload.id,
          name: servicePayload.name,
          category: servicePayload.category,
          price: servicePayload.price,
          duration: cleanDuration,
          duration_minutes: durationMins,
          description: servicePayload.description,
          images: imageUrls,
          imageUrls: imageUrls,
          image: coverImage,
          image_path: coverImage,
          badge: servicePayload.badge || '',
        }),
      });

      if (res.status === 401) {
        clearAdminToken();
        if (onLogout) onLogout();
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to save service to database');
      }

      // GUARDRAIL 4: THE CONFIRMED ORPHAN CLEANUP
      // In the "Edit Service" flow (editingService), only trigger deleteOrphanR2Image(oldUrl)
      // AFTER fetch('/api/services') returns response.ok, ensuring no accidental image deletion if DB save fails.
      if (editingService) {
        const oldUrl =
          (Array.isArray(editingService.images) && editingService.images[0]) ||
          (Array.isArray(editingService.imageUrls) && editingService.imageUrls[0]) ||
          editingService.image ||
          editingService.image_path ||
          '';
        if (oldUrl && oldUrl !== coverImage) {
          await deleteOrphanR2Image(oldUrl);
        }
      }

      // GUARDRAIL 3: Local React state update with guaranteed array
      setServices(prev => {
        const exists = prev.some(s => s.id === servicePayload.id);
        const nextServices = exists
          ? prev.map(s => (s.id === servicePayload.id ? servicePayload : s))
          : [servicePayload, ...prev];
        saveStoredServices(nextServices);
        return nextServices;
      });

      setIsServiceModalOpen(false);
      setEditingService(null);
      setIsCreatingCustomCategory(false);
      setIsCustomDuration(false);

      // Refresh services from server in background to ensure database sync
      fetchCatalogServices().then(fresh => {
        if (fresh && fresh.length > 0) {
          setServices(fresh);
        }
      });
    } catch {
      setServiceError('Error saving service. Please try again.');
    } finally {
      setServiceSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    const srvToDelete = services.find(s => s.id === serviceId);
    const updated = await removeService(serviceId);
    setServices(updated);
    setDeleteConfirmId(null);
    if (srvToDelete) {
      const oldUrl =
        (Array.isArray(srvToDelete.images) && srvToDelete.images[0]) ||
        (Array.isArray(srvToDelete.imageUrls) && srvToDelete.imageUrls[0]) ||
        srvToDelete.image ||
        srvToDelete.image_path ||
        '';
      if (oldUrl) {
        deleteOrphanR2Image(oldUrl);
      }
    }
  };

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
        compressedTarget = await compressService(file);
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

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
      const query = searchQuery.toLowerCase();
      const matchesQuery =
        apt.id.toLowerCase().includes(query) ||
        apt.customerName.toLowerCase().includes(query) ||
        apt.customerPhone.includes(query) ||
        apt.serviceName.toLowerCase().includes(query) ||
        (apt.notes && apt.notes.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [appointments, statusFilter, searchQuery]);

  // Filtered appointments for display in historical booking list
  const displayAppointments = useMemo(() => {
    let list = appointments;
    if (selectedDate) {
      list = list.filter(b => {
        const bDate = (b as any).bookingDate || (b as any).booking_date || (b as any).date;
        return bDate === selectedDate;
      });
    }
    return list;
  }, [appointments, selectedDate]);

  // Pagination slicing logic
  const itemsPerPage = 8;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAppointments = useMemo(() => {
    return displayAppointments.slice(indexOfFirstItem, indexOfLastItem);
  }, [displayAppointments, indexOfFirstItem, indexOfLastItem]);
  const totalPages = Math.max(1, Math.ceil(displayAppointments.length / itemsPerPage));

  const selectedAppointment = useMemo(() => {
    return appointments.find(a => a.id === selectedAppointmentId) || filteredAppointments[0] || null;
  }, [appointments, selectedAppointmentId, filteredAppointments]);

  const copyAppointmentSummary = (apt: Appointment) => {
    const text = `Appointment ID: ${apt.id}\nCustomer: ${apt.customerName} (${apt.customerPhone})\nService: ${apt.serviceName}\nSchedule: ${apt.bookingDate || apt.date} at ${apt.bookingTime || apt.time || '10:00 AM'}\nStatus: ${apt.status}${apt.notes ? `\nNotes: ${apt.notes}` : ''}`;
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
                <Calendar className="w-4 h-4" />
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
                  title="Database Health: Optimal · Live Appointment Sync Operational"
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
                Appointments Ledger & Storefront Engine
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Manual Sync Appointments Button */}
          <button
            type="button"
            onClick={fetchAppointments}
            disabled={isSyncing}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">{isSyncing ? 'Syncing...' : 'Sync Appointments'}</span>
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
            onClick={() => setActiveTab('appointments')}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'appointments'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Client Appointments</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                activeTab === 'appointments'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {appointments.length}
            </span>
          </button>

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
            onClick={() => setActiveTab('services')}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'services'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Services Registry</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                activeTab === 'services'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {services.length}
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
            <span>Studio Settings</span>
          </button>
        </div>

        {/* TAB 1: CLIENT APPOINTMENTS LIST (Secure Database) */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            {/* Booking Alerts Card */}
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
                      <h3 className="font-bold text-sm sm:text-base text-zinc-900">Booking Alerts</h3>
                      {alertState === 'subscribed' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Alerts Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                      {alertState === 'subscribed' && 'You will receive instant lock-screen notifications for new customer bookings.'}
                      {alertState === 'ready' && 'Get instant push notifications on this device whenever a customer books an appointment.'}
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
                      <span>{isUpdatingAlerts ? 'Enabling...' : 'Enable Booking Alerts'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-base text-zinc-900">Live Customer Bookings (Database)</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Synchronized live from Serverless Environment to Secure Database
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="border border-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-700"
                />
                {selectedDate && (
                  <button
                    onClick={() => {
                      setSelectedDate('');
                      setCurrentPage(1);
                    }}
                    className="bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-200 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {!appointments || appointments.length === 0 ? (
                <div className="text-center py-12 px-4 border-2 border-dashed border-zinc-200 rounded-xl space-y-2">
                  <p className="text-sm font-semibold text-zinc-700">No appointments yet.</p>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Once customers submit the checkout form on the storefront, their details will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3.5">
                  {currentAppointments.map((b: any) => (
                    <button
                      key={b.id || Math.random()}
                      onClick={() => setSelectedBooking(b)}
                      className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs hover:border-blue-300 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-bold text-base text-zinc-900">
                            {b.customer_name || b.customerName || b.client_name || 'Anonymous Client'}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              (b.status || 'Pending').toLowerCase() === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {b.status || 'Pending'}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-zinc-600">
                          {b.service_name || b.serviceName || 'Custom Service'} •{' '}
                          <span className="font-mono text-zinc-500">
                            {b.customer_phone || b.customerPhone || b.client_phone || 'No Phone'}
                          </span>
                        </p>
                        <p className="text-[11px] text-zinc-400 font-mono">
                          Scheduled: {b.booking_date || b.bookingDate || b.date || 'TBD'} @ {b.booking_time || b.bookingTime || b.time || 'TBD'}
                        </p>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[11px] font-mono text-zinc-400 block mb-1">
                          Recorded {b.created_at || b.createdAt ? new Date(b.created_at || b.createdAt).toLocaleDateString() : 'Recently'}
                        </span>
                        <span className="text-xs font-semibold text-blue-600 flex items-center gap-1 sm:justify-end">
                          View Details <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-zinc-100">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 disabled:opacity-40 hover:bg-zinc-50 transition shadow-2xs cursor-pointer"
                  >
                    &larr; Previous
                  </button>

                  <div className="flex items-center gap-1.5">
                    {totalPages <= 7 ? (
                      Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer flex items-center justify-center ${
                            currentPage === pageNum
                              ? 'bg-zinc-900 text-white shadow-2xs'
                              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))
                    ) : (
                      <span className="text-xs font-mono font-bold text-zinc-600 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200">
                        Page {currentPage} of {totalPages}
                      </span>
                    )}
                  </div>

                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 disabled:opacity-40 hover:bg-zinc-50 transition shadow-2xs cursor-pointer"
                  >
                    Next &rarr;
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* TAB: CUSTOMER ORDERS LIST (Catalog Storefront) */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
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
                            : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm'
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

          {/* TAB 2: SERVICES MANAGEMENT */}
          {activeTab === 'services' && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs divide-y divide-zinc-100">
              {/* Header with primary action: + Add Service */}
              <div className="p-4 bg-zinc-50/70 border-b border-zinc-200 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wider block font-mono">
                    Services Directory
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {services.length} active booking {services.length === 1 ? 'service' : 'services'}
                  </span>
                </div>

                <button
                  onClick={handleOpenAddService}
                  className="bg-black hover:bg-zinc-800 text-white text-xs font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs font-sans"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Service</span>
                </button>
              </div>

              {/* Quick Add Service Card */}
              <div className="p-4 bg-zinc-50/40 border-b border-zinc-200">
                <div
                  onClick={handleOpenAddService}
                  className="border-2 border-dashed border-zinc-200 hover:border-zinc-800 rounded-xl p-4 transition-all cursor-pointer bg-white hover:bg-zinc-50/80 group flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3.5 text-left">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 group-hover:bg-zinc-900 group-hover:text-white flex items-center justify-center text-zinc-700 transition-colors shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-900">Add Service to Booking Menu</h4>
                      <p className="text-[11px] text-zinc-500">
                        Set service pricing, appointment duration, descriptions, and upload imagery for storefront bookings.
                      </p>
                    </div>
                  </div>

                  <span className="bg-black group-hover:bg-zinc-800 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow-xs">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Service</span>
                  </span>
                </div>
              </div>

              {services.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Layers className="w-10 h-10 text-zinc-300 mx-auto" />
                  <p className="text-xs text-zinc-500">No services found in booking catalog.</p>
                  <button
                    onClick={handleOpenAddService}
                    className="bg-zinc-900 text-white text-xs font-medium px-3.5 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 mx-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Service</span>
                  </button>
                </div>
              ) : (
                services.map(item => {
                  const itemImg = getServicePrimaryImage(item);
                  return (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors"
                    >
                      {/* Service info */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={itemImg}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            onError={handleImageError}
                            className="w-14 h-14 aspect-square rounded-lg object-cover flex-shrink-0 border border-neutral-200 bg-zinc-100"
                          />
                          {item.images && item.images.length > 1 && (
                            <span
                              title={`${item.images.length} service photos`}
                              className="absolute -bottom-1 -right-1 bg-zinc-900 text-white font-mono text-[9px] font-semibold px-1 py-0.2 rounded-full border border-white shadow-xs"
                            >
                              +{item.images.length - 1}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-semibold text-zinc-900 truncate">{item.name}</h4>
                            {item.badge && (
                              <span className="bg-zinc-100 text-zinc-700 text-[10px] font-medium px-1.5 py-0.2 rounded shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono mt-0.5">
                            <span>{item.category || 'General'}</span>
                            <span>·</span>
                            <span className="font-semibold text-zinc-800">
                              {businessInfo?.currencySymbol || '$'}{item.price.toLocaleString()}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-zinc-600 bg-zinc-100 px-1.5 py-0.2 rounded font-sans text-[10px]">
                              <Clock className="w-3 h-3 text-zinc-500" />
                              {item.duration || `${item.duration_minutes || 30} Minutes`}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-zinc-400 line-clamp-1 max-w-sm mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Controls & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                        <div className="flex items-center gap-1 border-l sm:border-l-0 sm:pl-0 border-zinc-200 pl-3">
                          <button
                            onClick={() => handleOpenEditService(item)}
                            className="px-2.5 py-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                            title="Edit Service"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {deleteConfirmId === item.id ? (
                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                              <button
                                onClick={() => handleDeleteService(item.id)}
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
                              title="Archive / Delete Service"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
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
                          className="w-12 h-12 rounded-xl object-cover bg-zinc-100 shrink-0 border border-zinc-200"
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
                    placeholder="e.g. ⚡ FAST & RELIABLE APPOINTMENTS • BOOK YOUR SESSION TODAY ⚡"
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
                      placeholder="e.g. Masterful Aesthetics. Precision Appointments."
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
                      placeholder="e.g. Experience bespoke styling, clinical aesthetics, and attentive care designed around your rhythm."
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

    {/* Booking Details Modal (Secure Database) */}
    {selectedBooking && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200">
          <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <h3 className="font-bold text-lg text-zinc-900">Booking Details</h3>
            <button
              onClick={() => setSelectedBooking(null)}
              className="p-1.5 hover:bg-zinc-200 rounded-full transition-colors text-zinc-500 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col gap-1">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Service Requested</span>
              <span className="text-lg font-bold text-zinc-900">
                {selectedBooking.service_name || selectedBooking.serviceName || 'Service not specified'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-semibold text-zinc-500">Date</span>
                  <span className="text-sm font-medium text-zinc-900">
                    {selectedBooking.booking_date || selectedBooking.bookingDate || selectedBooking.date || 'Not set'}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-semibold text-zinc-500">Time</span>
                  <span className="text-sm font-medium text-zinc-900">
                    {selectedBooking.booking_time || selectedBooking.bookingTime || selectedBooking.time || 'Not set'}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-5 space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Customer Information</h4>

              <div className="space-y-3">
                <div>
                  <span className="block text-xs text-zinc-500 font-medium">Full Name</span>
                  <span className="text-sm font-semibold text-zinc-900">
                    {selectedBooking.customer_name || selectedBooking.customerName || selectedBooking.client_name || 'Anonymous'}
                  </span>
                </div>

                <div>
                  <span className="block text-xs text-zinc-500 font-medium mb-1">Phone Number</span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-mono font-medium text-zinc-900 break-all">
                      {selectedBooking.customer_phone || selectedBooking.customerPhone || selectedBooking.client_phone || 'None'}
                    </span>
                    {(selectedBooking.customer_phone || selectedBooking.customerPhone || selectedBooking.client_phone) && (
                      <a
                        href={`tel:${selectedBooking.customer_phone || selectedBooking.customerPhone || selectedBooking.client_phone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors shrink-0"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <span className="block text-xs text-zinc-500 font-medium mb-1">Email Address</span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-zinc-900 break-all">
                      {selectedBooking.customer_email || selectedBooking.customerEmail || 'Not provided'}
                    </span>
                    {(selectedBooking.customer_email || selectedBooking.customerEmail) && (
                      <a
                        href={`mailto:${selectedBooking.customer_email || selectedBooking.customerEmail}?subject=Regarding your booking for ${selectedBooking.service_name || selectedBooking.serviceName}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors shrink-0"
                      >
                        <Mail className="w-3.5 h-3.5" /> Email
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end">
            <button
              onClick={() => setSelectedBooking(null)}
              className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    )}


    {/* ADD / EDIT SERVICE MODAL */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-zinc-200 shadow-2xl overflow-hidden my-auto flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="font-bold text-base text-zinc-900 tracking-tight">
                  {editingService ? 'Edit Service' : 'Add New Service'}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Booking Engine Services · Instant Storefront Sync
                </p>
              </div>
              <button
                onClick={() => {
                  setIsServiceModalOpen(false);
                  setEditingService(null);
                  setIsCreatingCustomCategory(false);
                  setIsCustomDuration(false);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveService} className="p-6 space-y-4">
              {serviceError && (
                <div className="p-2.5 text-xs text-red-600 bg-red-50 rounded-lg border border-red-200 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{serviceError}</span>
                </div>
              )}

              {/* Service Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Service Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Teeth Whitening & Ultrasonic Cleanse"
                  value={serviceForm.name}
                  onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
                />
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>

                {existingCategories.length === 0 ? (
                  /* State A: Zero existing categories -> direct text input */
                  <input
                    type="text"
                    required
                    placeholder="Enter category name (e.g. Haircuts, Repairs)..."
                    value={serviceForm.category}
                    onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-[var(--theme-radius)] px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] transition-colors"
                  />
                ) : !isCreatingCustomCategory ? (
                  /* State B: Has existing categories & not creating custom -> select dropdown */
                  <div className="relative">
                    <select
                      value={existingCategories.includes(serviceForm.category) ? serviceForm.category : (existingCategories[0] || '')}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__CUSTOM__') {
                          setIsCreatingCustomCategory(true);
                          setServiceForm({ ...serviceForm, category: '' });
                        } else {
                          setServiceForm({ ...serviceForm, category: val });
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-[var(--theme-radius)] px-4 py-3 pr-10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] transition-colors appearance-none"
                    >
                      {existingCategories.map(cat => (
                        <option key={cat} value={cat} className="bg-zinc-900 text-white">
                          {cat}
                        </option>
                      ))}
                      <option value="__CUSTOM__" className="bg-zinc-900 text-white font-semibold">
                        + Create New Category...
                      </option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                ) : (
                  /* State C: Creating custom category when existing categories exist */
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Enter new category name..."
                      value={serviceForm.category}
                      onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-[var(--theme-radius)] px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] transition-colors"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-zinc-500">
                        Type a new category name for this service.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingCustomCategory(false);
                          setServiceForm({
                            ...serviceForm,
                            category: existingCategories[0] || '',
                          });
                        }}
                        className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-2 cursor-pointer transition-colors"
                      >
                        Back to list
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Price & Duration in 2 columns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Price ({businessInfo?.currencySymbol || '$'}) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                      {businessInfo?.currencySymbol || '$'}
                    </span>
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="e.g. 85"
                      value={serviceForm.price === 0 ? '' : serviceForm.price}
                      onChange={e => {
                        const val = e.target.value;
                        setServiceForm({
                          ...serviceForm,
                          price: val === '' ? 0 : Number(val),
                        });
                      }}
                      className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Duration <span className="text-red-500">*</span>
                  </label>
                  {!isCustomDuration ? (
                    <div className="relative">
                      <select
                        value={DURATION_PRESETS.includes(String(serviceForm.duration)) ? String(serviceForm.duration) : DURATION_PRESETS[0]}
                        onChange={e => {
                          if (e.target.value === '__CUSTOM__') {
                            setIsCustomDuration(true);
                            setServiceForm(prev => ({ ...prev, duration: '' }));
                          } else {
                            setServiceForm(prev => ({ ...prev, duration: e.target.value }));
                          }
                        }}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-[var(--theme-radius)] px-4 py-3 pr-10 text-white focus:outline-none focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] transition-colors appearance-none"
                      >
                        {DURATION_PRESETS.map(dur => (
                          <option key={dur} value={dur} className="bg-zinc-900 text-white">
                            {dur}
                          </option>
                        ))}
                        <option value="__CUSTOM__" className="bg-zinc-900 text-white font-semibold">
                          + Custom Duration...
                        </option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. 10 days, 1 month, 2 hours..."
                        value={serviceForm.duration}
                        onChange={e => setServiceForm(prev => ({ ...prev, duration: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-[var(--theme-radius)] px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] transition-colors"
                      />
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomDuration(false);
                            setServiceForm(prev => ({ ...prev, duration: DURATION_PRESETS[0] }));
                          }}
                          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-2 cursor-pointer transition-colors"
                        >
                          Back to presets
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Service Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Detailed procedure overview, benefits, or preparation requirements..."
                  value={serviceForm.description}
                  onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                />
              </div>

              {/* Service Cover Image (Single Image) */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-900">
                    Service Cover Image <span className="text-red-500">*</span>
                  </label>
                  {uploadingAssets.length > 0 && (
                    <span className="text-[11px] text-zinc-600 font-mono flex items-center gap-1.5">
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin text-zinc-900" />
                      Uploading cover image...
                    </span>
                  )}
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const files = e.target.files;
                    if (!files || files.length === 0) {
                      e.target.value = '';
                      return;
                    }
                    const hasInvalid = Array.from(files).some(f => !f.type.startsWith('image/'));
                    if (hasInvalid) {
                      e.target.value = '';
                      return alert('Please select a valid image file.');
                    }
                    handleFilesUpload(files);
                    e.target.value = '';
                  }}
                />

                {/* Cover Image Preview (if present) */}
                {serviceForm.images.length > 0 ? (
                  <div className="relative w-full h-44 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-950 group shadow-xs mb-3">
                    <img
                      src={resolveImageUrl(serviceForm.images[0])}
                      alt="Service Cover Preview"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                    <span className="absolute top-2.5 left-2.5 bg-zinc-900/90 text-white text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded shadow-xs backdrop-blur-xs">
                      Cover Image
                    </span>

                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900/85 hover:bg-zinc-900 text-white text-[11px] font-medium shadow-xs backdrop-blur-xs transition-colors cursor-pointer"
                        title="Replace cover image"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="w-7 h-7 rounded-lg bg-red-600/90 hover:bg-red-600 text-white shadow-xs flex items-center justify-center cursor-pointer transition-colors"
                        title="Remove image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : uploadingAssets.length > 0 ? (
                  <div className="relative w-full h-44 rounded-xl overflow-hidden border border-zinc-300 bg-zinc-900 shadow-xs mb-3 flex flex-col items-center justify-center p-4">
                    <img
                      src={uploadingAssets[0].previewUrl}
                      alt="Uploading..."
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover opacity-30"
                    />
                    <LoaderCircle className="w-6 h-6 animate-spin text-white mb-2 z-10" />
                    <span className="text-xs font-mono text-white z-10">Uploading cover image...</span>
                  </div>
                ) : (
                  /* Single Image Dropzone */
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer mb-3 ${
                      isDragging
                        ? 'border-zinc-900 bg-zinc-100'
                        : 'border-zinc-200 hover:border-zinc-400 bg-zinc-50/60 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="space-y-1.5 py-1">
                      <Upload className="w-5 h-5 text-zinc-500 mx-auto" />
                      <p className="text-xs text-zinc-700">
                        Drag & drop service cover image here, or{' '}
                        <span className="font-semibold text-zinc-900 underline underline-offset-2">
                          Browse Device
                        </span>
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        PNG, JPG, WEBP, AVIF up to 10MB
                      </p>
                    </div>
                  </div>
                )}

                {/* Upload Error / Notice Alerts */}
                {uploadError && (
                  <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </p>
                )}

                {uploadNotice && (
                  <p className="text-xs text-amber-700 mb-2 flex items-center gap-1 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadNotice}</span>
                  </p>
                )}

                {/* Direct Image URL input */}
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="url"
                    placeholder="Or enter direct image URL (https://... or /...)"
                    value={customImageUrl}
                    onChange={e => setCustomImageUrl(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDirectUrl();
                      }
                    }}
                    className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddDirectUrl}
                    disabled={!customImageUrl.trim()}
                    className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Set URL
                  </button>
                </div>

                {/* Quick Sample Image Presets */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-zinc-400 font-mono">Sample presets:</span>
                  {PRESET_SAMPLE_IMAGES.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleAddPreset(preset.url)}
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
                  Optional Badge Tag <span className="text-zinc-400 font-normal">(e.g. Popular, Premium, Specialist)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Popular"
                  value={serviceForm.badge}
                  onChange={e => setServiceForm({ ...serviceForm, badge: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsServiceModalOpen(false);
                    setEditingService(null);
                    setIsCreatingCustomCategory(false);
                    setIsCustomDuration(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={serviceSaving}
                  className="bg-black hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs font-sans"
                >
                  {serviceSaving ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Service...</span>
                    </>
                  ) : (
                    <span>{editingService ? 'Save Service Changes' : 'Create & Publish Service'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <h4 className="text-3xl font-black mb-3 transition-colors duration-300" style={{ color: themeForm.textColor }}>Signature Service</h4>
              <p className="text-sm mb-8 opacity-70 leading-relaxed transition-colors duration-300" style={{ color: themeForm.textColor }}>This is an exact physical replica of how your chosen colors will render for your customers.</p>
              <button type="button" className="w-full py-4 rounded-2xl font-black shadow-lg transition-transform duration-300 hover:scale-[1.02] active:scale-95" style={{ backgroundColor: themeForm.primaryColor, color: themeForm.bgColor }}>
                Book Appointment
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
