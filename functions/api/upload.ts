/// <reference types="@cloudflare/workers-types" />
import { verifyAuthToken, unauthorizedResponse } from './_auth';

interface Env {
  CATALOG_BUCKET?: R2Bucket;
  R2_BUCKET?: R2Bucket;
  UPLOAD_BUCKET?: R2Bucket;
  R2_PUBLIC_URL?: string;
  PUBLIC_R2_URL?: string;
  CDN_URL?: string;
  ADMIN_PASSWORD?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const bucket = env.CATALOG_BUCKET || env.R2_BUCKET || env.UPLOAD_BUCKET;

  if (!key || !bucket) {
    return new Response('Not found', { status: 404 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return new Response('Asset not found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const authHeader = request.headers.get('Authorization');
    const isAuthorized = await verifyAuthToken(authHeader, env);
    if (!isAuthorized) {
      return unauthorizedResponse('Authentication required to upload media assets.');
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload: any = await request.json();
      const imageUrl = payload?.dataUrl || payload?.imageUrl;
      if (!imageUrl) {
        return new Response(JSON.stringify({ success: false, error: 'No image data provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          success: true,
          imageUrl,
          key: `catalog-media/asset-${Date.now()}`,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ success: false, error: 'Expected multipart/form-data payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ success: false, error: 'No media file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const uniqueKey = `catalog-media/asset-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const mimeType = file.type || 'image/jpeg';
    const arrayBuffer = await file.arrayBuffer();

    const bucket = env.CATALOG_BUCKET || env.R2_BUCKET || env.UPLOAD_BUCKET;
    const publicBase = (env.R2_PUBLIC_URL || env.PUBLIC_R2_URL || env.CDN_URL || '').trim();

    if (bucket) {
      try {
        await bucket.put(uniqueKey, arrayBuffer, {
          httpMetadata: {
            contentType: mimeType,
          },
        });

        if (publicBase) {
          const imageUrl = `${publicBase.replace(/\/$/, '')}/${uniqueKey}`;
          return new Response(JSON.stringify({ success: true, imageUrl, key: uniqueKey }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (r2Err) {
        console.warn('R2 bucket put warning, falling back to inline data URL:', r2Err);
      }
    }

    const base64 = arrayBufferToBase64(arrayBuffer);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: dataUrl,
        key: uniqueKey,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message || 'Asset upload failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
