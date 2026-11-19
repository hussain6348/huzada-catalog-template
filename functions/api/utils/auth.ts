// @ts-nocheck
const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export async function verifyAuth(request: Request, env: any): Promise<Response | null> {
  // CORS preflight bypass
  if (request.method === 'OPTIONS') {
    return null;
  }

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const [encodedPayload, providedSig] = parts;

  try {
    const payloadStr = atob(encodedPayload);
    const payload = JSON.parse(payloadStr);

    // Expiration verification
    if (payload?.exp && typeof payload.exp === 'number' && Date.now() > payload.exp) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    // Mirroring functions/api/auth.ts Web Crypto signature logic
    const encoder = new TextEncoder();
    const primarySecret = env?.ADMIN_SECRET || 'huzada_default_secret_2026';
    const fallbackSecrets = [env?.ADMIN_PASSWORD, 'admin123'].filter(Boolean);
    const candidateSecrets = Array.from(new Set([primarySecret, ...fallbackSecrets]));

    let isSignatureValid = false;

    for (const secret of candidateSecrets) {
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
      const calculatedSig = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (calculatedSig.toLowerCase() === providedSig.toLowerCase()) {
        isSignatureValid = true;
        break;
      }
    }

    if (!isSignatureValid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    return null;
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }
}
