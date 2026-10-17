export async function onRequest(context) {
  const { request } = context;

  // 1. Browser ki hidden OPTIONS (preflight) request ko block mat karo
  if (request.method === "OPTIONS") {
    return context.next();
  }

  // 2. Simple aur saaf token check (Single-Tenant ke mutabiq)
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.includes("waas_auth_token_")) {
    return context.next();
  }

  // 3. Agar token nahi hai toh block karo
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}
