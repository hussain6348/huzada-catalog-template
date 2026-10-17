export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const validPassword = env.ADMIN_PASSWORD || "agency-default-secure";

  if (body.password === validPassword) {
    const secureToken = "waas_auth_token_" + Date.now();
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Set-Cookie": "admin_session=" + secureToken + "; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400",
        "Content-Type": "application/json"
      }
    });
  }
  return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401 });
}
