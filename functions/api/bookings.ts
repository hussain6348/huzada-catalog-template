import { createClient } from "@libsql/client/web";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export async function onRequestGet(context: any) {
  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: "Turso database credentials missing in environment" }), {
        headers: jsonHeaders,
        status: 503,
      });
    }

    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const searchDate = url.searchParams.get("date") || url.searchParams.get("booking_date");
    
    const offset = Math.max(0, (page - 1) * limit);

    const client = createClient({
      url: (env.TURSO_DATABASE_URL as string).trim(),
      authToken: (env.TURSO_AUTH_TOKEN as string).trim(),
    });

    let sql = "";
    let args: any[] = [];

    if (searchDate) {
      sql = "SELECT * FROM bookings WHERE (booking_date = ? OR date = ?) ORDER BY rowid DESC LIMIT ? OFFSET ?";
      args = [searchDate, searchDate, limit, offset];
    } else {
      sql = "SELECT * FROM bookings ORDER BY rowid DESC LIMIT ? OFFSET ?";
      args = [limit, offset];
    }

    const result = await client.execute({ sql, args });

    return new Response(JSON.stringify(result.rows || []), {
      headers: jsonHeaders,
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to fetch bookings" }), {
      headers: jsonHeaders,
      status: 500,
    });
  }
}
