/// <reference types="@cloudflare/workers-types" />

export interface AuthEnv {
  ADMIN_PASSWORD?: string;
  [key: string]: any;
}

export async function createAuthToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payload = JSON.stringify({
    role: 'merchant_admin',
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days validity
    nonce: Math.random().toString(36).substring(2),
  });
  const payloadB64 = btoa(payload);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const sigHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payloadB64}.${sigHex}`;
}

export async function verifyAuthToken(token: string | null | undefined, env: AuthEnv): Promise<boolean> {
  if (!token) return false;
  const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  const expectedPassword = env?.ADMIN_PASSWORD || (isDev ? 'admin123' : '');
  if (!expectedPassword) return false;

  const rawToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = rawToken.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigHex] = parts;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(expectedPassword),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const hexPairs = sigHex.match(/.{1,2}/g);
    if (!hexPairs) return false;
    const sigBytes = new Uint8Array(hexPairs.map(byte => parseInt(byte, 16)));
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payloadB64));
    if (!isValid) return false;

    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp && payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function unauthorizedResponse(message = 'Unauthorized access'): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
