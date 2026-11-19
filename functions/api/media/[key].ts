// @ts-nocheck

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function onRequestGet(context: any) {
  const { request, env, params } = context;

  // 1. The Preflight Interceptor
  if (request?.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const rawKey = params?.key;
  const key = rawKey ? decodeURIComponent(rawKey) : '';
  const bucket = env?.R2_STORAGE || env?.BUCKET || env?.STORAGE;

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

    // 404 Shield with Universal CORS
    if (!object) {
      return new Response('Not found', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000');

    // 2 & 3. Universal Response Shield: Append CORS headers to every response
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));

    // 4. MIME Type Fallback: Derive from R2 metadata, file extension, or fallback to application/octet-stream
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
    // 500 Shield with Universal CORS
    return new Response(JSON.stringify({ error: error.message || 'Failed to retrieve media' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestDelete(context: any) {
  const { request, env, params } = context;

  // Preflight Interceptor
  if (request?.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const key = params?.key;
    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Missing file key to delete', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bucket = env?.R2_STORAGE || env?.BUCKET || env?.STORAGE;
    if (!bucket) {
      return new Response(
        JSON.stringify({ error: 'Storage binding not configured', success: false }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await bucket.delete(key);

    return new Response(
      JSON.stringify({ success: true, key, message: 'R2 asset deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to delete file from R2', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
