export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    if (body.password === env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
}
