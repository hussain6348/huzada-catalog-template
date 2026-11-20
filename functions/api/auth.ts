import { timingSafeEqual, json } from '../_lib/guard';

interface Env {
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
}

export const onRequestPost = async (context: any) => {
  try {
    const { request, env } = context as { request: Request; env: Env };
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: 'Malformed JSON payload' }, 400);
    }

    const providedPassword = typeof body?.password === 'string' ? body.password.trim() : '';
    const configuredPassword = (env.ADMIN_PASSWORD || 'admin123').trim();
    const adminSecret = (env.ADMIN_SECRET || configuredPassword).trim();

    if (!providedPassword || !timingSafeEqual(providedPassword, configuredPassword)) {
      return json({ success: false, error: 'Access denied: Invalid credentials' }, 401);
    }

    // Standardized E-Commerce Store Admin Token Payload
    const payload = JSON.stringify({
      role: 'store_admin',
      scope: 'orders_catalog_inventory',
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
      nonce: Math.random().toString(36).substring(2),
    });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(adminSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const sigHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const token = `${btoa(payload)}.${sigHex}`;
    return json({ success: true, token, role: 'store_admin' });
  } catch (err: any) {
    return json({ success: false, error: err?.message || 'Authentication error' }, 500);
  }
};
