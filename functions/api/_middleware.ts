export async function onRequest(context) {
  const { request } = context;
  const cookieHeader = request.headers.get("Cookie");

  if (cookieHeader && cookieHeader.includes("admin_session=waas_auth_token_")) {
    return context.next();
  }

  return new Response(JSON.stringify({ error: "Unauthorized" }), { 
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}
