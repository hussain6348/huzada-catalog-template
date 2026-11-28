import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, LoaderCircle, Image as ImageIcon } from 'lucide-react';
import themeManifestData from '../config/theme-manifest.json';
import { compressHero, compressService, compressLogo } from '../utils/imageCompression';
import { getAuthHeaders, clearAdminToken } from '../lib/auth';
import { normalizeMediaUrl, deleteOrphanR2Image } from '../utils/r2Media';

interface ThemeImageItem {
  key: string;
  label: string;
  default_src: string;
}

const themeManifest = themeManifestData as { themeImages?: ThemeImageItem[] };

export default function StorefrontMediaAdmin() {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [liveImages, setLiveImages] = useState<Record<string, string>>({});
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    fetch('/api/theme-media')
      .then(async (res) => {
        if (res.status === 401) {
          clearAdminToken();
          try {
            localStorage.clear();
          } catch {}
          window.location.href = '/admin';
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted.current || !data) return;
        const map: Record<string, string> = {};
        if (Array.isArray(data)) {
          data.forEach((row: any) => {
            map[row.slot_id] = row.image_url;
          });
        }
        setLiveImages(map);
      })
      .catch(() => {});

    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
    // Prevent double-execution if upload is already in progress
    if (isUploading) return;

    // 1. Trace the existing file assignment.
    const existingFileVar = e.target.files?.[0];

    // 2. Inject Payload Gate & DOM Reset
    if (!existingFileVar || !existingFileVar.type.startsWith('image/')) {
      e.target.value = '';
      return alert('Please select a valid image file.');
    }

    // 3. Lock UI using Double-Tap Shield state
    setIsUploading(true);
    setUploadingSlot(slotId);

    try {
      // 4. --- INJECTED COMPRESSION STEP ---
      let compressedTarget: File;
      if (slotId.includes('hero') || slotId.includes('banner')) {
        compressedTarget = await compressHero(existingFileVar);
      } else if (slotId.includes('service')) {
        compressedTarget = await compressService(existingFileVar);
      } else {
        compressedTarget = await compressLogo(existingFileVar);
      }
      // ---------------------------------

      // 5. --- FORM DATA CREATION (Token NOT appended to FormData) ---
      const formData = new FormData();
      formData.append('file', compressedTarget);

      // 6. --- STRICT HEADER MANDATE & BOUNDARY CRASH SHIELD ---
      // Inject Authorization header without setting Content-Type (browser generates multipart boundary)
      const authHeaders = getAuthHeaders();
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
        body: formData,
      });

      // 7. --- 401 SOFT-LOCK GATE ---
      if (uploadRes.status === 401) {
        clearAdminToken();
        try {
          localStorage.clear();
        } catch {}
        window.location.href = '/admin';
        return;
      }

      if (!uploadRes.ok) {
        throw new Error(`Upload failed with status ${uploadRes.status}`);
      }

      const uploadData = await uploadRes.json();

      const rawUrl = (Array.isArray(uploadData?.imageUrls) && uploadData.imageUrls[0]) || uploadData?.imageUrl || uploadData?.url;

      // 1. THE NULL-POINTER SHIELD: Verify URL exists and is a string
      if (!rawUrl || typeof rawUrl !== 'string') {
        throw new Error('Upload succeeded but returned an invalid image URL');
      }

      // 2. Preserve external R2 public URLs (R2_PUBLIC_URL / *.r2.dev) and origin-relative /api/media/... paths
      const cleanUrl = normalizeMediaUrl(rawUrl);
      if (!cleanUrl) {
        throw new Error('Upload succeeded but normalized URL was empty');
      }

      const previousUrl = liveImages[slotId];

      // 4. THE SYNCHRONIZED PAYLOAD: Use cleanUrl for BOTH the database payload AND React UI state
      // 8. --- PERSIST TO THEME MEDIA WITH AUTH HEADERS ---
      const themeMediaRes = await fetch('/api/theme-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ slot_id: slotId, image_url: cleanUrl }),
      });

      // 401 Soft-Lock Gate for theme-media persistence
      if (themeMediaRes.status === 401) {
        clearAdminToken();
        try {
          localStorage.clear();
        } catch {}
        window.location.href = '/admin';
        return;
      }

      if (!themeMediaRes.ok) {
        throw new Error(`Theme media persistence failed with status ${themeMediaRes.status}`);
      }

      // 9. --- MEMORY LEAK PROTECTOR FOR STATE UPDATES ---
      if (isMounted.current) {
        setLiveImages((prev) => ({ ...prev, [slotId]: cleanUrl }));
      }

      // Clean up the replaced R2 object after DB update (server verifies no shared references remain)
      if (previousUrl && previousUrl !== cleanUrl) {
        await deleteOrphanR2Image(previousUrl, getAuthHeaders);
      }
    } catch (err) {
      console.error(err);
      if (isMounted.current) {
        alert('Upload failed.');
      }
    } finally {
      // 10. --- MEMORY LEAK PROTECTOR FOR CLEANUP & UI UNLOCK ---
      if (isMounted.current) {
        setIsUploading(false);
        setUploadingSlot(null);
      }
      if (e.target) {
        e.target.value = ''; // Crucial DOM memory reset
      }
    }
  };

  if (!themeManifest.themeImages || themeManifest.themeImages.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-12 text-center">
        <ImageIcon className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
        <h3 className="text-zinc-900 font-bold">No Theme Images Detected</h3>
        <p className="text-xs text-zinc-500 mt-1">When an AI theme is deployed via n8n, image slots will automatically appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {themeManifest.themeImages.map((img) => (
        <div key={img.key} className="bg-white p-5 border border-zinc-200 rounded-2xl flex flex-col gap-3 shadow-xs hover:border-zinc-300 transition-all">
          <h3 className="font-bold text-zinc-900 text-sm">{img.label}</h3>
          <div className="relative w-full h-40 bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200">
            <img src={liveImages[img.key] || img.default_src} className="w-full h-full object-cover" alt={img.label} />
          </div>
          <div className="relative mt-1">
            <input
              type="file"
              onChange={(e) => handleUpload(e, img.key)}
              accept="image/*"
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <button
              disabled={isUploading}
              className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              {uploadingSlot === img.key ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              <span className="text-xs">{uploadingSlot === img.key ? 'Uploading & Syncing...' : 'Replace Image'}</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
