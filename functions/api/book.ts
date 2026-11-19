// @ts-nocheck
import { createClient } from "@libsql/client/web";
import { sendBookingPushAlerts } from "../_lib/push";

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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};

export const onRequestPost = async (context: any) => {
  try {
    const env = context?.env || {};
    const tursoUrl = (env.TURSO_DATABASE_URL || "").trim();
    const tursoToken = (env.TURSO_AUTH_TOKEN || "").trim();

    if (!tursoUrl || !tursoToken) {
      return jsonResponse({ success: false, error: "Database pending keys: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set", code: "DB_PENDING" }, 400);
    }

    if (tursoUrl === "libsql://" || tursoUrl === "https://" || tursoUrl === "http://" || tursoUrl.endsWith("://")) {
      return jsonResponse({ success: false, error: `Database URL is incomplete ('${tursoUrl}'). Missing database hostname.`, code: "DB_INVALID_URL" }, 400);
    }

    if (!tursoUrl.startsWith("libsql://") && !tursoUrl.startsWith("https://") && !tursoUrl.startsWith("http://") && !tursoUrl.startsWith("wss://")) {
      return jsonResponse({ success: false, error: "Invalid database URL protocol. Expected libsql:// or https://", code: "DB_INVALID_URL" }, 400);
    }

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      body = {};
    }

    const db = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });

    // 1. Auto-Migration: Ensure bookings table exists with the new customer_email column
    await db.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_email TEXT,
        service_name TEXT,
        booking_date TEXT,
        booking_time TEXT,
        status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Safe Patch: Add customer_email to the existing bookings table if it was created previously
    try {
      await db.execute("ALTER TABLE bookings ADD COLUMN customer_email TEXT;");
    } catch (e) {
      // Safely ignore: column already exists
    }

    // 3. Extract the email from the frontend body
    const clientId = body.client_id || body.client_name || "default";
    const customerName = body.customer_name || body.client_name || "Unknown";
    const customerPhone = body.customer_phone || body.client_phone || "Unknown";
    const customerEmail = body.customer_email || body.email || "Unknown";
    const serviceName = body.service_name || "Service";
    const bookingDate = body.booking_date || body.date || "Unknown";
    const bookingTime = body.booking_time || body.time || "Unknown";

    // 4. Save everything, including the email, to Turso
    const insertResult = await db.execute({
      sql: "INSERT INTO bookings (client_id, customer_name, customer_phone, customer_email, service_name, booking_date, booking_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [clientId, customerName, customerPhone, customerEmail, serviceName, bookingDate, bookingTime],
    });

    const name = (customerName && customerName !== 'Unknown') ? customerName : 'New Customer';
    const service = (serviceName && serviceName !== 'Unknown') ? serviceName : 'Appointment';
    const when = [bookingDate, bookingTime].filter((x) => x && x !== 'Unknown').join(' at ');

    const pushPromise = sendBookingPushAlerts(db, {
      title: 'New Booking Received',
      body: `${name} booked ${service}${when ? ` (${when})` : ''}`,
      url: '/admin',
    }).catch((err) => console.error('Push failed:', err));

    if (typeof context.waitUntil === 'function') {
      context.waitUntil(pushPromise);
    }

    const bookingId = insertResult?.lastInsertRowid ? String(insertResult.lastInsertRowid) : undefined;

    return jsonResponse({
      success: true,
      message: "Booking saved to Turso database",
      bookingId,
      whatsapp: env.WHATSAPP_NUMBER || undefined,
    });
  } catch (error: any) {
    const errorMessage = error?.message || "Internal server error";
    const isAuthError = errorMessage.includes("401") || errorMessage.includes("400") || errorMessage.toLowerCase().includes("unauthorized") || errorMessage.toLowerCase().includes("jwt");

    console.error("[API/BOOK ERROR]", { message: errorMessage, code: isAuthError ? "TURSO_AUTH_ERROR" : "TURSO_EXEC_ERROR" });

    return jsonResponse({ success: false, error: errorMessage, code: isAuthError ? "TURSO_AUTH_ERROR" : "TURSO_EXEC_ERROR" }, 500);
  }
};
