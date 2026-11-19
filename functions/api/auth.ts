// @ts-nocheck
interface Env { ADMIN_PASSWORD?: string; }
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const body = await request.json() as { password?: string };
    const adminSecret = env.ADMIN_PASSWORD || 'admin123';
    if (!body?.password || body.password.trim() !== adminSecret) return new Response(JSON.stringify({ success: false, error: 'Access denied.' }), { status: 401 });
    
    const payload = JSON.stringify({ role: 'booking_admin', exp: Date.now() + 1000 * 60 * 60 * 24 * 7, nonce: Math.random().toString(36).substring(2) });
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(adminSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return new Response(JSON.stringify({ success: true, token: `${btoa(payload)}.${sigHex}` }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) { return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 }); }
};

