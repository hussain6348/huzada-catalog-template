export const json = (data, status = 200, headers = {}) =>
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

export function timingSafeEqual(a, b) {
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

    if (typeof crypto?.timingSafeEqual === 'function') {
      try {
        return crypto.timingSafeEqual(aBuf, bBuf);
      } catch {}
    }
    if (typeof crypto?.subtle?.timingSafeEqual === 'function') {
      try {
        return crypto.subtle.timingSafeEqual(aBuf, bBuf);
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

export const requireAdmin = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return null;
  }

  let token = null;

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

  const adminPassword = (env?.ADMIN_PASSWORD || '').trim();
  const adminSecret = (env?.ADMIN_SECRET || '').trim();
  const configuredSecrets = [adminPassword, adminSecret].filter(Boolean);
  const candidateSecrets = configuredSecrets.length > 0 ? Array.from(new Set(configuredSecrets)) : ['admin123'];

  for (const secret of candidateSecrets) {
    if (timingSafeEqual(token, secret)) {
      return null;
    }
  }

  if (token.includes('.')) {
    const parts = token.split('.');
    if (parts.length === 2) {
      const [encodedPayload, providedSig] = parts;
      try {
        const payloadStr = atob(encodedPayload);
        const payload = JSON.parse(payloadStr);

        if (payload?.exp && typeof payload.exp === 'number' && Date.now() > payload.exp) {
          return json({ error: 'Unauthorized: Session expired', success: false }, 401);
        }

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
            const signature = await crypto.subtle.sign('HMAC', key, payloadBytes);
            const calculatedSig = Array.from(new Uint8Array(signature))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');

            if (timingSafeEqual(calculatedSig.toLowerCase(), providedSig.toLowerCase())) {
              return null;
            }
          } catch {}
        }
      } catch {}
    }
  }

  return json({ error: 'Forbidden', success: false }, 403);
};
