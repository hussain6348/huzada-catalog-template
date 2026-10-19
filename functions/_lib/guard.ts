const enc = new TextEncoder();
const sha = (s: string) => crypto.subtle.digest("SHA-256", enc.encode(s));

export async function safeEqual(a: string, b: string) {
  const [x, y] = await Promise.all([sha(a), sha(b)]);
  return (crypto.subtle as any).timingSafeEqual(x, y);
}

export const json = (o: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

export async function requireAdmin(req: Request, env: any): Promise<Response | null> {
  if (!env.ADMIN_PASSWORD) return json({ error: "Server misconfigured" }, 500);
  const key = req.headers.get("x-admin-key") ?? "";
  return (await safeEqual(key, env.ADMIN_PASSWORD)) ? null : json({ error: "Unauthorized" }, 401);
}
