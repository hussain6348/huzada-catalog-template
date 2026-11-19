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
          ? "No custom environment variables detected in this Cloudflare deployment. In Cloudflare Pages, environment variables only apply to subsequent builds. You must trigger a new deployment ('Manage deployment' -> 'Retry deployment') for added variables to activate."
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
      detail: "Expected format: libsql://[db-name]-[org].turso.io. Check your n8n workflow expression for Hostname extraction.",
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

    // 3. Ping database with basic query
    await db.execute("SELECT 1 as ping");

    // 4. Ensure bookings table exists (self-healing migration)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        service_name TEXT,
        booking_date TEXT,
        booking_time TEXT,
        status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Inspect existing tables and count rows
    const tablesResult = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%'"
    );
    const tables = (tablesResult.rows || []).map((r: any) => String(r.name || r[0]));

    let bookingsCount = 0;
    try {
      const countResult = await db.execute("SELECT count(*) as total FROM bookings");
      bookingsCount = Number(countResult.rows?.[0]?.total ?? countResult.rows?.[0]?.[0] ?? 0);
    } catch {}

    // Mask URL for safe display
    const maskedUrl = tursoUrl.replace(/(libsql:\/\/|https:\/\/)([^.]+)\./, "$1***.");

    return jsonResponse({
      connected: true,
      databaseUrl: maskedUrl,
      tables,
      bookingsCount,
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
