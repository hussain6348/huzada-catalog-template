import { safeEqual, json } from "../_lib/guard";

export async function onRequestPost(context: any) {
  const { request, env } = context;
  if (!env.ADMIN_PASSWORD) return json({ error: "Server misconfigured" }, 500);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }
  if (typeof body?.password !== "string") return json({ error: "Bad request" }, 400);

  const isMatch = await safeEqual(body.password, env.ADMIN_PASSWORD);
  if (isMatch) {
    return json({ success: true });
  }
  return json({ error: "Invalid password" }, 401);
}
