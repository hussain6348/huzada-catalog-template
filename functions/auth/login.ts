export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const validPassword = context.env.ADMIN_PASSWORD;
    if (body.password === validPassword) {
      const secureToken = "waas_auth_token_" + Date.now();
      return new Response(JSON.stringify({ success: true, token: secureToken }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
}
