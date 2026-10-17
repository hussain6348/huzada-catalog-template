export async function onRequest(context) {
  const { request } = context;
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.includes("Bearer waas_auth_token_")) {
    return context.next();
  }
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}
