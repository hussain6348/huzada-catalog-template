/**
 * Ghost Lock Authentication & Security Guard
 * Enforces constant-time verification, safe JSON helpers, and uniform responses.
 */

export const json = (data: any, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      ...headers,
    },
  });

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Returns false if either input is missing or byte lengths mismatch.
 * Wraps crypto.timingSafeEqual with safe constant-time XOR fallback.
 */
export function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  try {
    const enc = new TextEncoder();
    const aBuf = enc.encode(a);
    const bBuf = enc.encode(b);

    if (aBuf.byteLength === 0 || bBuf.byteLength === 0 || aBuf.byteLength !== bBuf.byteLength) {
      return false;
    }

    if (typeof (crypto as any)?.timingSafeEqual === 'function') {
      try {
        return (crypto as any).timingSafeEqual(aBuf, bBuf);
      } catch {}
    }
    if (typeof (crypto?.subtle as any)?.timingSafeEqual === 'function') {
      try {
        return (crypto.subtle as any).timingSafeEqual(aBuf, bBuf);
      } catch {}
    }

    let mismatch = 0;
    for (let i = 0; i < aBuf.byteLength; i++) {
      mismatch |= aBuf[i] ^ bBuf[i];
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

/**
 * Validates administrator credentials across Cloudflare edge and local dev.
 * Supports:
 * 1. Bearer token in Authorization header
 * 2. Raw token in X-Admin-Token header
 * 3. Session cookie (huzada_catalog_admin_token, huzada_booking_admin_token, admin_token, auth_token, token)
 * 
 * Verifies against:
 * 1. Direct match with configured ADMIN_PASSWORD / ADMIN_SECRET / 'admin123'
 * 2. HMAC-SHA256 signed session token from /api/auth (<btoa(payload)>.<sigHex>)
 * 
 * Never downgrades security; eliminates unauthenticated bypass when env is unset,
 * purges 'admin123' when production secrets are set, and enforces token expiration.
 */
export async function requireAdmin(request: Request, env: any): Promise<Response | null> {
  // CORS Preflight bypass
  if (request.method === 'OPTIONS') {
    return null;
  }

  // Extract token from Authorization header, X-Admin-Token header, or cookies
  let token: string | null = null;

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader) {
    if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (!token) {
    const xToken = request.headers.get('X-Admin-Token') || request.headers.get('x-admin-token');
    if (xToken) {
      token = xToken.trim();
    }
  }

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)(?:huzada_catalog_admin_token|huzada_booking_admin_token|admin_token|auth_token|token)=([^;]+)/i);
      if (match && match[1]) {
        try {
          token = decodeURIComponent(match[1].trim());
        } catch {
          token = match[1].trim();
        }
      }
    }
  }

  if (!token) {
    return json({ error: 'Unauthorized', success: false }, 401);
  }

  // When production secrets are configured, use ONLY the configured secrets.
  // 'admin123' is permitted ONLY as a local development fallback when NO secrets are set in env.
  const adminPassword = (env?.ADMIN_PASSWORD || '').trim();
  const adminSecret = (env?.ADMIN_SECRET || '').trim();
  const configuredSecrets = [adminPassword, adminSecret].filter(Boolean);
  const candidateSecrets = configuredSecrets.length > 0 ? Array.from(new Set(configuredSecrets)) : ['admin123'];

  // 1. Direct constant-time match against candidate secrets
  for (const secret of candidateSecrets) {
    if (timingSafeEqual(token, secret)) {
      return null;
    }
  }

  // 2. Validate HMAC-SHA256 Signed Token format (base64Payload.signatureHex)
  if (token.includes('.')) {
    const parts = token.split('.');
    if (parts.length === 2) {
      const [encodedPayload, providedSig] = parts;
      try {
        const payloadStr = atob(encodedPayload);
        const payload = JSON.parse(payloadStr);

        // Check expiration if present
        if (payload?.exp && typeof payload.exp === 'number' && Date.now() > payload.exp) {
          return json({ error: 'Unauthorized: Session expired', success: false }, 401);
        }

        // Verify HMAC signature across candidate secrets
        const encoder = new TextEncoder();
        const payloadBytes = encoder.encode(payloadStr);

        for (const secret of candidateSecrets) {
          try {
            const key = await crypto.subtle.importKey(
              'raw',
              encoder.encode(secret),
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign']
            );
            const sigBuffer = await crypto.subtle.sign('HMAC', key, payloadBytes);
            const calculatedSig = Array.from(new Uint8Array(sigBuffer))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');

            if (timingSafeEqual(calculatedSig.toLowerCase(), providedSig.toLowerCase())) {
              return null; // Validated successfully
            }
          } catch {}
        }
      } catch {}
    }
  }

  return json({ error: 'Forbidden', success: false }, 403);
}
