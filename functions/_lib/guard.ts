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
      ...headers,
    },
  });

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  let mismatch = aBuf.byteLength === bBuf.byteLength ? 0 : 1;
  const maxLen = Math.max(aBuf.byteLength, bBuf.byteLength);
  for (let i = 0; i < maxLen; i++) {
    const aByte = i < aBuf.byteLength ? aBuf[i] : 0;
    const bByte = i < bBuf.byteLength ? bBuf[i] : 0;
    mismatch |= aByte ^ bByte;
  }
  return mismatch === 0;
}

/**
 * Validates Ghost Lock administrator credentials via HMAC signed token or direct password.
 */
export async function requireAdmin(request: Request, env: any): Promise<Response | null> {
  // CORS Preflight bypass
  if (request.method === 'OPTIONS') {
    return null;
  }

  const adminPassword = (env?.ADMIN_PASSWORD || '').trim();
  const adminSecret = (env?.ADMIN_SECRET || adminPassword || 'huzada_default_secret_2026').trim();

  // If no password configured in environment, allow access during setup
  if (!adminPassword && !env?.ADMIN_SECRET) {
    return null;
  }

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  const xAdminToken = request.headers.get('x-admin-token') || '';
  
  let candidateToken = '';
  if (authHeader.startsWith('Bearer ')) {
    candidateToken = authHeader.slice(7).trim();
  } else if (xAdminToken) {
    candidateToken = xAdminToken.trim();
  }

  if (!candidateToken) {
    return json({ error: 'Unauthorized', success: false }, 401);
  }

  // 1. Direct constant-time match against ADMIN_PASSWORD
  if (adminPassword && timingSafeEqual(candidateToken, adminPassword)) {
    return null;
  }

  // 2. Validate HMAC-SHA256 Signed Token format (base64Payload.signatureHex)
  const parts = candidateToken.split('.');
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
      const candidateSecrets = Array.from(new Set([adminSecret, adminPassword].filter(Boolean)));

      for (const secret of candidateSecrets) {
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
        const calculatedSig = Array.from(new Uint8Array(sigBuffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        if (timingSafeEqual(calculatedSig.toLowerCase(), providedSig.toLowerCase())) {
          return null; // Validated successfully
        }
      }
    } catch {
      // Malformed token payload
    }
  }

  return json({ error: 'Unauthorized: Access denied', success: false }, 401);
}
