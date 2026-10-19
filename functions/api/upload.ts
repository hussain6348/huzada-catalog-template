import { requireAdmin, json } from "../_lib/guard";

interface Env {
  CATALOG_BUCKET?: R2Bucket; R2_BUCKET?: R2Bucket; R2_PUBLIC_URL?: string;
  PUBLIC_R2_URL?: string; CDN_URL?: string; ADMIN_PASSWORD?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) return json({ success: false, error: "Expected multipart/form-data" }, 400);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return json({ success: false, error: "No media file provided" }, 400);

    const fileExt = file.name.split(".").pop() || "jpg";
    const uniqueKey = `catalog-media/asset-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const bucket = env.CATALOG_BUCKET || env.R2_BUCKET;

    if (bucket) {
      const arrayBuffer = await file.arrayBuffer();
      await bucket.put(uniqueKey, arrayBuffer, { httpMetadata: { contentType: file.type || "image/jpeg" } });
      const publicBase = env.R2_PUBLIC_URL || env.PUBLIC_R2_URL || env.CDN_URL || "https://pub-r2.dev";
      const imageUrl = `${publicBase.replace(/\/$/, "")}/${uniqueKey}`;
      return json({ success: true, imageUrl, key: uniqueKey });
    }
    return json({ success: true, imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80", key: uniqueKey, previewMode: true });
  } catch (error: any) {
    return json({ success: false, error: error.message || "Asset upload failed" }, 500);
  }
};
