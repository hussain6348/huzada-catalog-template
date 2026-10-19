import { createClient } from "@libsql/client/web";
import { requireAdmin, json } from "../_lib/guard";

async function initProductsTable(db: any) {
  await db.execute(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, description TEXT, category TEXT, price REAL, stock INTEGER DEFAULT 10, image TEXT, image_path TEXT, images TEXT, created_at TEXT)`);
  const migrations = ["ALTER TABLE products ADD COLUMN category TEXT", "ALTER TABLE products ADD COLUMN price REAL", "ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10", "ALTER TABLE products ADD COLUMN image TEXT", "ALTER TABLE products ADD COLUMN image_path TEXT", "ALTER TABLE products ADD COLUMN images TEXT", "ALTER TABLE products ADD COLUMN description TEXT", "ALTER TABLE products ADD COLUMN created_at TEXT"];
  for (const sql of migrations) { try { await db.execute(sql); } catch {} }
}

export const onRequestGet = async (context: any) => {
  const { env } = context;
  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await initProductsTable(db);
      const result = await db.execute("SELECT * FROM products ORDER BY rowid DESC");
      const products = result.rows.map((row: any) => {
        let parsedImages: string[] = [];
        if (typeof row.images === "string" && row.images.trim()) {
          try { const parsed = JSON.parse(row.images); if (Array.isArray(parsed)) parsedImages = parsed.filter(Boolean); else if (typeof parsed === "string" && parsed) parsedImages = [parsed]; } catch { parsedImages = []; }
        } else if (Array.isArray(row.images)) { parsedImages = row.images.filter(Boolean); }
        const RELIABLE_PLACEHOLDER = "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80";
        let primaryCandidate = row.image || row.image_path || parsedImages[0] || "";
        let primaryImage = typeof primaryCandidate === "string" ? primaryCandidate.trim() : "";
        if (!primaryImage || primaryImage.includes("test-shirt") || primaryImage.includes("default-client")) primaryImage = RELIABLE_PLACEHOLDER;
        return {
          id: String(row.id), name: String(row.name || ""), description: String(row.description || ""),
          price: Number(parseFloat(row.price as any) || 0), category: String(row.category || "General"),
          images: parsedImages.length > 0 ? parsedImages : [primaryImage], image: primaryImage, image_path: primaryImage,
          stock: Number(parseInt(row.stock as any, 10) || 10), badge: row.badge ? String(row.badge) : undefined,
        };
      });
      return json({ success: true, products });
    } catch (e: any) { return json({ success: false, error: "Server error", products: [] }, 500); }
  }
  return json({ success: true, products: [], source: "fallback" });
};

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  let body: any;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const id = String(body.id || "prod_" + Date.now());
  const name = String(body.name || "");
  const description = String(body.description || "");
  const category = String(body.category || "General");
  const price = Number(parseFloat(body.price) || 0);
  const stock = Number(parseInt(body.stock, 10) || 10);
  const imagesArray = Array.isArray(body.images) ? body.images.map(String) : [];
  const imagePath = String(imagesArray[0] || body.image || body.image_path || "");

  if (env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await initProductsTable(db);
      const cols = ["id", "name", "description", "category", "price", "stock", "image", "image_path", "images", "created_at"];
      const placeholders = cols.map(() => "?").join(", ");
      const setClause = cols.filter(c => c !== "id" && c !== "created_at").map(c => c + " = excluded." + c).join(", ");
      const args = [id, name, description, category, price, stock, imagePath, imagePath, JSON.stringify(imagesArray), new Date().toISOString()];
      await db.execute({
        sql: "INSERT INTO products (" + cols.join(", ") + ") VALUES (" + placeholders + ") ON CONFLICT(id) DO UPDATE SET " + setClause,
        args
      });
      return json({ success: true, product: { id, name, description, category, price, stock, images: imagesArray, image_path: imagePath } });
    } catch (e: any) { return json({ success: false, error: "Database error" }, 500); }
  }
  return json({ success: true, product: { id, name, description, category, price, stock, images: imagesArray, image_path: imagePath }, source: "fallback" });
};

export const onRequestDelete = async (context: any) => {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id && env?.TURSO_DATABASE_URL && env?.TURSO_AUTH_TOKEN) {
    try {
      const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
      await db.execute({ sql: "DELETE FROM products WHERE id = ?", args: [id] });
    } catch (e: any) { return json({ success: false, error: "Failed to delete" }, 500); }
  }
  return json({ success: true, id });
};
