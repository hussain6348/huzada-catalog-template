/// <reference types="@cloudflare/workers-types" />
import { verifyAuthToken, unauthorizedResponse } from './_auth';

interface Env {
  CATALOG_BUCKET?: R2Bucket;
  R2_BUCKET?: R2Bucket;
  R2_PUBLIC_URL?: string;
  PUBLIC_R2_URL?: string;
  CDN_URL?: string;
  ADMIN_PASSWORD?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const authHeader = request.headers.get('Authorization');
    const isAuthorized = await verifyAuthToken(authHeader, env);
    if (!isAuthorized) {
      return unauthorizedResponse('Authentication required to upload media assets.');
    }

    const contentType = request.headers.get('content-type') || '';
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

    const bucket = env.CATALOG_BUCKET || env.R2_BUCKET;

    if (bucket) {
      const arrayBuffer = await file.arrayBuffer();
      await bucket.put(uniqueKey, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || 'image/jpeg',
        },
      });

      const publicBase = env.R2_PUBLIC_URL || env.PUBLIC_R2_URL || env.CDN_URL || 'https://pub-r2.dev';
      const imageUrl = `${publicBase.replace(/\/$/, '')}/${uniqueKey}`;

      return new Response(JSON.stringify({ success: true, imageUrl, key: uniqueKey }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Graceful fallback for local development / preview environment without active R2 bindings
    const sampleFallbackImages = [
      'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
      'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80',
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
    ];
    const fallbackImage = sampleFallbackImages[Math.floor(Math.random() * sampleFallbackImages.length)];

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: fallbackImage,
        key: uniqueKey,
        previewMode: true,
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
