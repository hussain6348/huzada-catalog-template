export const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const requireAdmin = async (request: Request, env: any) => {
  if (!env.ADMIN_PASSWORD) return null;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = authHeader.split(" ")[1];
  if (token !== env.ADMIN_PASSWORD) return json({ error: "Forbidden" }, 403);
  return null;
};
