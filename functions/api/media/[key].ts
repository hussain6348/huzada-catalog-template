import { requireAdmin, json } from '../../_lib/guard';
import { getR2Bucket, safeDecodeKey, deleteR2ObjectIfUnreferenced } from '../../_lib/r2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function onRequestGet(context: any) {
  const { request, env, params } = context;

  if (request?.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const rawKey = params?.key;
  const key = rawKey ? decodeURIComponent(rawKey) : '';
  const bucket = getR2Bucket(env);

  if (!bucket) {
    return new Response('Storage binding not configured', {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  try {
    let object = await bucket.get(key);
    if (!object && rawKey && rawKey !== key) {
      object = await bucket.get(rawKey);
    }

    if (!object) {
      return new Response('Media asset not found', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));

    let contentType = headers.get('content-type') || object.httpMetadata?.contentType;
    if (!contentType) {
      const ext = key.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        webp: 'image/webp',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        avif: 'image/avif',
      };
      contentType = (ext && mimeMap[ext]) ? mimeMap[ext] : 'application/octet-stream';
    }
    headers.set('content-type', contentType);

    return new Response(object.body, { headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Failed to retrieve media asset' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestDelete(context: any) {
  const { request, env, params } = context;

  // Protect deletion with Ghost Lock
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const key = params?.key ? safeDecodeKey(String(params.key)) : '';
  if (!key) {
    return json({ error: 'Missing file key to delete', success: false }, 400, corsHeaders);
  }

  const bucket = getR2Bucket(env);
  if (!bucket) {
    return json({ error: 'Storage binding not configured', success: false }, 503, corsHeaders);
  }

  try {
    const outcome = await deleteR2ObjectIfUnreferenced(env, key);
    if (outcome.skipped) {
      return json(
        {
          success: true,
          skipped: true,
          key,
          message: 'Media asset retained because it is still referenced',
        },
        200,
        corsHeaders
      );
    }
    return json({ success: true, key, message: 'Media asset deleted successfully' }, 200, corsHeaders);
  } catch (error: any) {
    return json({ error: error?.message || 'Failed to delete file from R2', success: false }, 500, corsHeaders);
  }
}
