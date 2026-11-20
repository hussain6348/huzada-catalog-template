// @ts-nocheck
import { createClient } from "@libsql/client/web";

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};

export const onRequestGet = async (context: any) => {
  const env = context?.env || {};
  const tursoUrl = (env.TURSO_DATABASE_URL || "").trim();
  const tursoToken = (env.TURSO_AUTH_TOKEN || "").trim();

  // 1. Detailed Diagnostic Check for Environment Variables
  const missingKeys: string[] = [];
  if (!tursoUrl) missingKeys.push("TURSO_DATABASE_URL");
  if (!tursoToken) missingKeys.push("TURSO_AUTH_TOKEN");

  if (missingKeys.length > 0) {
    const envKeysPresent = Object.keys(env).filter(
      (k) => !k.startsWith("CF_") && !k.startsWith("__")
    );
    return jsonResponse({
      connected: false,
      error: `Missing required environment variable(s): ${missingKeys.join(", ")}.`,
      detail:
        envKeysPresent.length === 0
          ? "No custom environment variables detected in this Cloudflare deployment. In Cloudflare Pages, environment variables apply to subsequent builds."
          : `Active variables detected: [${envKeysPresent.join(", ")}], but ${missingKeys.join(", ")} is missing.`,
      code: "DB_PENDING",
      missingKeys,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Validate URL protocol and completeness
  if (
    tursoUrl === "libsql://" ||
    tursoUrl === "https://" ||
    tursoUrl === "http://" ||
    tursoUrl.endsWith("://")
  ) {
    return jsonResponse({
      connected: false,
      error: `TURSO_DATABASE_URL is incomplete ('${tursoUrl}'). The database hostname was not appended.`,
      code: "DB_INVALID_URL",
      timestamp: new Date().toISOString(),
    });
  }

  if (
    !tursoUrl.startsWith("libsql://") &&
    !tursoUrl.startsWith("https://") &&
    !tursoUrl.startsWith("http://") &&
    !tursoUrl.startsWith("wss://")
  ) {
    return jsonResponse({
      connected: false,
      error: `Invalid database URL protocol: ${tursoUrl.substring(0, 15)}... Expected libsql:// or https://`,
      code: "DB_INVALID_URL",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const db = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });

    // 3. Ping database
    await db.execute("SELECT 1 as ping");

    // 4. Ensure tables exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_name TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        notes TEXT,
        items TEXT,
        total REAL,
        status TEXT DEFAULT 'pending',
        created_at TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        category TEXT,
        price REAL,
        stock INTEGER DEFAULT 10,
        image TEXT,
        image_path TEXT,
        images TEXT,
        badge TEXT,
        created_at TEXT
      )
    `);

    // 5. Inspect tables and counts
    const tablesResult = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%'"
    );
    const tables = (tablesResult.rows || []).map((r: any) => String(r.name || r[0]));

    let ordersCount = 0;
    let productsCount = 0;

    try {
      const ordersRes = await db.execute("SELECT count(*) as total FROM orders");
      ordersCount = Number(ordersRes.rows?.[0]?.total ?? 0);
    } catch {}

    try {
      const productsRes = await db.execute("SELECT count(*) as total FROM products");
      productsCount = Number(productsRes.rows?.[0]?.total ?? 0);
    } catch {}

    // Mask URL for safe display
    const maskedUrl = tursoUrl.replace(/(libsql:\/\/|https:\/\/)([^.]+)\./, "$1***.");

    return jsonResponse({
      connected: true,
      service: "huzada-catalog-template",
      databaseUrl: maskedUrl,
      tables,
      ordersCount,
      productsCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const errorMessage = error?.message || "Connection failed";
    const isAuthError =
      errorMessage.includes("401") ||
      errorMessage.includes("400") ||
      errorMessage.toLowerCase().includes("unauthorized") ||
      errorMessage.toLowerCase().includes("jwt");

    return jsonResponse({
      connected: false,
      error: errorMessage,
      code: isAuthError ? "TURSO_AUTH_ERROR" : "TURSO_CONN_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
};
