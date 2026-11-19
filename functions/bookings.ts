// @ts-nocheck
import { createClient } from "@libsql/client/web";

export const onRequestGet = async (context: any) => {
  const jsonHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const env = context?.env || {};
    const tursoUrl = env.TURSO_DATABASE_URL;
    const tursoToken = env.TURSO_AUTH_TOKEN;

    if (
      !tursoUrl ||
      !tursoToken ||
      typeof tursoUrl !== "string" ||
      typeof tursoToken !== "string" ||
      tursoUrl.trim() === "" ||
      tursoUrl.trim() === "libsql://" ||
      tursoUrl.trim() === "https://" ||
      tursoToken.trim() === ""
    ) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const cleanUrl = tursoUrl.trim();
    if (
      !cleanUrl.startsWith("libsql://") &&
      !cleanUrl.startsWith("https://") &&
      !cleanUrl.startsWith("http://") &&
      !cleanUrl.startsWith("wss://")
    ) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const db = createClient({
      url: cleanUrl,
      authToken: tursoToken.trim(),
    });

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

    const result = await db.execute("SELECT * FROM bookings ORDER BY created_at DESC");
    return new Response(JSON.stringify(result.rows || []), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to fetch bookings" }),
      {
        status: 500,
        headers: jsonHeaders,
      }
    );
  }
};
