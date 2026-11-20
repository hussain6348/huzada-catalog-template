import { requireAdmin, json } from '../_lib/guard';
import { getR2Bucket, getR2PublicUrl } from '../_lib/r2';

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  try {
    const bucket = getR2Bucket(env);

    if (!bucket) {
      return json(
        {
          error: 'Cloudflare R2 storage binding (R2_STORAGE or BUCKET) is not configured in environment',
          success: false,
        },
        503
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') || formData.get('image');
    const files = formData.getAll('file');

    const targetFiles: any[] = file ? [file] : files;

    if (!targetFiles || targetFiles.length === 0 || !(targetFiles[0] instanceof File)) {
      return json({ error: 'No valid file provided in multipart request', success: false }, 400);
    }

    const uploadedUrls: string[] = [];

    for (const f of targetFiles) {
      if (!(f instanceof File)) continue;
      const buffer = await f.arrayBuffer();
      const rawExt = f.name.split('.').pop() || 'webp';
      const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const filename = (f.name && f.name.endsWith('.webp')) ? f.name : `product-${uniqueId}.${ext}`;

      await bucket.put(filename, buffer, {
        httpMetadata: {
          contentType: f.type || (filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg'),
        },
      });

      const publicUrl = getR2PublicUrl(env, filename);
      uploadedUrls.push(publicUrl);
    }

    const primaryUrl = uploadedUrls[0] || '';

    return json({
      success: true,
      imageUrl: primaryUrl,
      url: primaryUrl,
      imageUrls: uploadedUrls,
      filename: primaryUrl.split('/').pop(),
    });
  } catch (error: any) {
    console.error('Storefront media upload error:', error);
    return json({ error: error?.message || 'File upload failed', success: false }, 500);
  }
}
