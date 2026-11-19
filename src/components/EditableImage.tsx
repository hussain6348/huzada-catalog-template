import React, { useState, useEffect, useRef } from 'react';

const SLOT_FALLBACKS: Record<string, string> = {
  logo: '/default-logo.png',
  hero: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
  about: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=80',
  promo: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
};

export interface EditableImageProps {
  slot?: string;
  slotId?: string;
  src?: string;
  defaultSrc?: string;
  alt?: string;
  className?: string;
  fallback?: string;
  style?: React.CSSProperties;
}

export function EditableImage({
  slot,
  slotId,
  src: propSrc,
  defaultSrc,
  alt = 'Storefront visual',
  className = '',
  fallback,
  style,
}: EditableImageProps) {
  const effectiveSlot = (slot || slotId || 'hero').toLowerCase();

  const resolveInitialSrc = (): string => {
    try {
      const perSlot = localStorage.getItem(`waas_img_${effectiveSlot}`);
      if (perSlot) return perSlot;
      const rawMap = localStorage.getItem('waas_image_slots');
      if (rawMap) {
        const parsed = JSON.parse(rawMap);
        if (parsed && parsed[effectiveSlot]) return parsed[effectiveSlot];
      }
    } catch {}
    return propSrc || defaultSrc || fallback || SLOT_FALLBACKS[effectiveSlot] || '';
  };

  const [src, setSrc] = useState<string>(resolveInitialSrc);
  const imgRef = useRef<HTMLImageElement>(null);

  // 1. Fetch latest asset from backend database on mount if available
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/theme-media?slot=${encodeURIComponent(effectiveSlot)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.image_url && data.image_url !== src) {
          setSrc(data.image_url);
          try {
            localStorage.setItem(`waas_img_${effectiveSlot}`, data.image_url);
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [effectiveSlot]);

  // 2. Cross-tab live sync via StorageEvent
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `waas_img_${effectiveSlot}` && e.newValue) {
        setSrc(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [effectiveSlot]);

  // 3. WaaS CustomEvent listener: 'waas-update-slot-image'
  useEffect(() => {
    const handleSlotEvent = (e: Event) => {
      const ce = e as CustomEvent<{ slot?: string; slotId?: string; url?: string }>;
      const targetSlot = (ce.detail?.slot || ce.detail?.slotId || '').toLowerCase();
      if (targetSlot === effectiveSlot && ce.detail?.url) {
        setSrc(ce.detail.url);
        try {
          localStorage.setItem(`waas_img_${effectiveSlot}`, ce.detail.url);
        } catch {}
        if (imgRef.current) {
          delete imgRef.current.dataset.errored;
        }
      }
    };

    window.addEventListener('waas-update-slot-image', handleSlotEvent);
    return () => window.removeEventListener('waas-update-slot-image', handleSlotEvent);
  }, [effectiveSlot]);

  const handleError = () => {
    if (imgRef.current && !imgRef.current.dataset.errored) {
      imgRef.current.dataset.errored = '1';
      const fb = fallback || defaultSrc || SLOT_FALLBACKS[effectiveSlot];
      if (fb && fb !== src) {
        setSrc(fb);
      }
    }
  };

  if (!src) return null;

  return (
    <img
      ref={imgRef}
      data-slot-id={effectiveSlot}
      src={src}
      className={className}
      alt={alt}
      style={style}
      onError={handleError}
      referrerPolicy="no-referrer"
    />
  );
}

export default EditableImage;