// @ts-nocheck

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export async function onRequestPost({ request, env }) {
  try {
    const bucket = env?.R2_STORAGE || env?.BUCKET || env?.STORAGE;

    if (!bucket) {
      return new Response(
        JSON.stringify({
          error: 'Cloudflare R2 storage binding (R2_STORAGE or BUCKET) is not configured in environment',
          success: false,
        }),
        { status: 503, headers: jsonHeaders }
      );
    }

    const formData = await request.formData();
    // Accept either 'file' or 'files'
    const file = formData.get('file') || formData.get('image');
    const files = formData.getAll('file');

    const targetFiles = file ? [file] : files;

    if (!targetFiles || targetFiles.length === 0 || !(targetFiles[0] instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No valid file provided in multipart request', success: false }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const uploadedUrls = [];
    const publicBaseUrl = env.R2_PUBLIC_URL 
      ? env.R2_PUBLIC_URL.replace(/\/$/, '') 
      : (env.R2_DEV_HASH ? `https://pub-${env.R2_DEV_HASH}.r2.dev` : '');

    for (const f of targetFiles) {
      if (!(f instanceof File)) continue;
      const buffer = await f.arrayBuffer();
      const rawExt = f.name.split('.').pop() || 'png';
      const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const filename = (f.name && f.name.endsWith('.webp')) ? f.name : `asset-${uniqueId}.${ext}`;

      await bucket.put(filename, buffer, {
        httpMetadata: {
          contentType: f.type || (filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg'),
        },
      });

      const safeFileName = encodeURIComponent(filename);
      const publicUrl = publicBaseUrl ? `${publicBaseUrl}/${safeFileName}` : `/api/media/${safeFileName}`;
      uploadedUrls.push(publicUrl.replace(/([^:]\/)\/+/g, "$1"));
    }

    const primaryUrl = uploadedUrls[0] || '';

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: primaryUrl,
        url: primaryUrl,
        imageUrls: uploadedUrls,
        filename: primaryUrl.split('/').pop(),
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error: any) {
    console.error('Upload Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'File upload failed', success: false }),
      { status: 500, headers: jsonHeaders }
    );
  }
}
