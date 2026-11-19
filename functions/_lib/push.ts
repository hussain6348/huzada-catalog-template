import { createClient } from '@libsql/client/web';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { PushMessage, PushSubscription, VapidKeys } from '@block65/webcrypto-web-push';

export function createDbClient(env: any) {
  const tursoUrl = (env?.TURSO_DATABASE_URL || '').trim();
  const tursoToken = (env?.TURSO_AUTH_TOKEN || '').trim();
  if (!tursoUrl || !tursoToken) return null;
  return createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function ensurePushTables(db: any): Promise<void> {
  if (!db) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS push_config (
      id TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      subject TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export async function getOrCreateVapidConfig(db: any): Promise<{
  publicKey: string;
  privateKey: string;
  subject: string;
}> {
  await ensurePushTables(db);

  const existing = await db.execute({
    sql: "SELECT public_key, private_key, subject FROM push_config WHERE id = 'default'",
    args: [],
  });

  const row = existing.rows?.[0];
  if (row && row.public_key && row.private_key) {
    return {
      publicKey: String(row.public_key),
      privateKey: String(row.private_key),
      subject: String(row.subject || 'mailto:alerts@huzada.app'),
    };
  }

  // Generate extractable ECDSA P-256 key pair via standard Web Crypto
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const rawPub = await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKey = arrayBufferToBase64Url(rawPub);

  const jwkPriv = (await globalThis.crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey;
  const privateKey = String(jwkPriv.d);
  const subject = 'mailto:alerts@huzada.app';
  const createdAt = new Date().toISOString();

  await db.execute({
    sql: "INSERT OR IGNORE INTO push_config (id, public_key, private_key, subject, created_at) VALUES ('default', ?, ?, ?, ?)",
    args: [publicKey, privateKey, subject, createdAt],
  });

  const winning = await db.execute({
    sql: "SELECT public_key, private_key, subject FROM push_config WHERE id = 'default'",
    args: [],
  });
  const winRow = winning.rows?.[0];

  return {
    publicKey: String(winRow?.public_key || publicKey),
    privateKey: String(winRow?.private_key || privateKey),
    subject: String(winRow?.subject || subject),
  };
}

export async function sendBookingPushAlerts(
  db: any,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!db) return;
  await ensurePushTables(db);

  const vapid = await getOrCreateVapidConfig(db);

  const subsResult = await db.execute({
    sql: 'SELECT endpoint, p256dh, auth FROM push_subscriptions',
    args: [],
  });
  const rows = subsResult.rows || [];
  if (rows.length === 0) return;

  const vapidKeys: VapidKeys = {
    subject: vapid.subject,
    publicKey: vapid.publicKey,
    privateKey: vapid.privateKey,
  };

  const message: PushMessage = {
    data: JSON.stringify(payload),
    options: { ttl: 86400 },
  };

  await Promise.allSettled(
    rows.map(async (row: any) => {
      const endpoint = String(row.endpoint || '');
      const p256dh = String(row.p256dh || '');
      const auth = String(row.auth || '');
      if (!endpoint || !p256dh || !auth) return;

      const subscription: PushSubscription = {
        endpoint,
        expirationTime: null,
        keys: {
          p256dh,
          auth,
        },
      };

      try {
        const req = await buildPushPayload(message, subscription, vapidKeys);
        const res = await fetch(subscription.endpoint, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });

        // Self-healing cleanup: if expired or unregistered, remove from DB
        if (res.status === 404 || res.status === 410) {
          await db.execute({
            sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
            args: [endpoint],
          });
        }
      } catch (err) {
        console.error('Failed to send push notification to', endpoint, err);
      }
    })
  );
}
