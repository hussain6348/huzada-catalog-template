import { createClient } from "@libsql/client/web";
import { requireAdmin, json } from "../_lib/guard";
import { deleteR2UrlsIfUnreferenced, parseImageList } from "../_lib/r2";

async function initProductsTable(db: any) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'General',
      price REAL DEFAULT 0,
      stock INTEGER DEFAULT 10,
      image TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      images TEXT DEFAULT '[]',
      badge TEXT DEFAULT '',
      created_at TEXT
    )
  `);

  const migrations = [
    "ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'General'",
    "ALTER TABLE products ADD COLUMN price REAL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10",
    "ALTER TABLE products ADD COLUMN image TEXT DEFAULT ''",
    "ALTER TABLE products ADD COLUMN image_path TEXT DEFAULT ''",
    "ALTER TABLE products ADD COLUMN images TEXT DEFAULT '[]'",
    "ALTER TABLE products ADD COLUMN description TEXT DEFAULT ''",
    "ALTER TABLE products ADD COLUMN badge TEXT DEFAULT ''",
    "ALTER TABLE products ADD COLUMN created_at TEXT",
  ];

  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch {}
  }
}

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);

  const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
  const rawLimit = parseInt(url.searchParams.get("limit") || url.searchParams.get("pageSize") || "50", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
  const offset = (page - 1) * limit;

  const categoryParam = (url.searchParams.get("category") || "").trim();
  const searchParam = (url.searchParams.get("search") || url.searchParams.get("q") || "").trim();

  const tursoUrl = env?.TURSO_DATABASE_URL;
  const tursoToken = env?.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken && typeof tursoUrl === "string" && typeof tursoToken === "string" && tursoUrl.trim() && tursoToken.trim()) {
    try {
      const db = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });

      const whereClauses: string[] = [];
      const queryArgs: any[] = [];

      if (categoryParam && categoryParam.toLowerCase() !== "all") {
        whereClauses.push("LOWER(category) = LOWER(?)");
        queryArgs.push(categoryParam);
      }

      if (searchParam) {
        whereClauses.push("(name LIKE ? OR description LIKE ? OR category LIKE ?)");
        const pattern = `%${searchParam}%`;
        queryArgs.push(pattern, pattern, pattern);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const dataArgs = [...queryArgs, limit, offset];

      const fetchProductsData = async () => {
        const countRes = await db.execute({
          sql: `SELECT COUNT(*) as total FROM products ${whereSql}`,
          args: [...queryArgs],
        });
        const totalCount = Number(countRes.rows?.[0]?.total ?? 0);
        const totalPages = Math.ceil(totalCount / limit) || 1;
        const hasMore = page < totalPages;

        const result = await db.execute({
          sql: `SELECT id, name, description, category, price, stock, image, image_path, images, badge, created_at 
                FROM products ${whereSql} 
                ORDER BY rowid DESC 
                LIMIT ? OFFSET ?`,
          args: dataArgs,
        });

        return { totalCount, totalPages, hasMore, rows: result.rows || [] };
      };

      // High-speed fast-path query first; self-healing migration on catch
      let queryData;
      try {
        queryData = await fetchProductsData();
      } catch (err: any) {
        const errMsg = String(err?.message || "").toLowerCase();
        if (errMsg.includes("no such table") || errMsg.includes("no such column") || errMsg.includes("has no column")) {
          await initProductsTable(db);
          queryData = await fetchProductsData();
        } else {
          throw err;
        }
      }

      const { totalCount, totalPages, hasMore, rows } = queryData;

      const products = rows.map((row: any) => {
        let parsedImages: string[] = [];
        if (typeof row.images === "string" && row.images.trim()) {
          try {
            const parsed = JSON.parse(row.images);
            if (Array.isArray(parsed)) parsedImages = parsed.filter((img) => typeof img === "string" && img.trim().length > 0);
            else if (typeof parsed === "string" && parsed) parsedImages = [parsed];
          } catch {
            parsedImages = [];
          }
        } else if (Array.isArray(row.images)) {
          parsedImages = row.images.filter((img: any) => typeof img === "string" && img.trim().length > 0);
        }

        const primaryCandidate = row.image_path || row.image || parsedImages[0] || "";
        const primaryImage = typeof primaryCandidate === "string" ? primaryCandidate.trim() : "";

        return {
          id: String(row.id || ""),
          name: String(row.name || "Product"),
          description: String(row.description || ""),
          price: Number(parseFloat(row.price as any) || 0),
          category: String(row.category || "General"),
          images: parsedImages.length > 0 ? parsedImages : (primaryImage ? [primaryImage] : []),
          image: primaryImage,
          image_path: primaryImage,
          stock: Number(parseInt(row.stock as any, 10) || 0),
          badge: row.badge ? String(row.badge).trim() : undefined,
          createdAt: String(row.created_at || ""),
        };
      });

      return json({
        success: true,
        products,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasMore,
        },
      });
    } catch (e: any) {
      console.error("Fetch products error:", e);
      return json({ success: false, error: "Database error fetching products", products: [] }, 500);
    }
  }

  return json({
    success: true,
    products: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 1, hasMore: false },
    source: "fallback",
  });
};

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON format" }, 400);
  }

  const rawId = String(body.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50);
  const name = String(body.name || "Untitled Product").trim().substring(0, 150);
  const description = String(body.description || "").trim().substring(0, 1000);
  const category = String(body.category || "General").trim().substring(0, 60);
  const price = Math.max(0, Math.min(Number(parseFloat(body.price)) || 0, 9999999));
  const stock = Math.max(0, Math.min(Number(parseInt(body.stock, 10)) || 0, 999999));
  const badge = body.badge ? String(body.badge).trim().substring(0, 40) : null;
  const imagesArray = Array.isArray(body.images)
    ? body.images.map((img: any) => String(img || "").trim()).filter(Boolean).slice(0, 5)
    : [];
  const imagePath = String(imagesArray[0] || body.image || body.image_path || "").trim();

  const tursoUrl = env?.TURSO_DATABASE_URL;
  const tursoToken = env?.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken && typeof tursoUrl === "string" && typeof tursoToken === "string" && tursoUrl.trim() && tursoToken.trim()) {
    try {
      const db = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
      const nextUrls = new Set(imagesArray.length > 0 ? imagesArray : imagePath ? [imagePath] : []);

      let oldUrls: string[] = [];
      try {
        const existingRes = await db.execute({
          sql: "SELECT image_path, image, images FROM products WHERE id = ?",
          args: [id],
        });
        if (existingRes.rows && existingRes.rows.length > 0) {
          const row = existingRes.rows[0] as any;
          oldUrls = [row.image_path, row.image, ...parseImageList(row.images)]
            .map((u) => (typeof u === "string" ? u.trim() : ""))
            .filter(Boolean);
        }
      } catch {
        // Table or columns may not exist yet before initProductsTable runs
      }

      const cols = ["id", "name", "description", "category", "price", "stock", "image", "image_path", "images", "badge", "created_at"];
      const placeholders = cols.map(() => "?").join(", ");
      const setClause = cols.filter(c => c !== "id" && c !== "created_at").map(c => `${c} = excluded.${c}`).join(", ");
      const args = [id, name, description, category, price, stock, imagePath, imagePath, JSON.stringify(imagesArray), badge, new Date().toISOString()];
      
      const insertProduct = () => db.execute({
        sql: `INSERT INTO products (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${setClause}`,
        args,
      });

      try {
        await insertProduct();
      } catch (insertErr: any) {
        const errMsg = String(insertErr?.message || "").toLowerCase();
        if (errMsg.includes("no such table") || errMsg.includes("no such column") || errMsg.includes("has no column")) {
          await initProductsTable(db);
          await insertProduct();
        } else {
          throw insertErr;
        }
      }

      const removedUrls = oldUrls.filter((u) => !nextUrls.has(u));
      if (removedUrls.length > 0) {
        await deleteR2UrlsIfUnreferenced(env, removedUrls);
      }

      return json({
        success: true,
        product: {
          id,
          name,
          description,
          category,
          price,
          stock,
          images: imagesArray,
          image_path: imagePath,
          badge: badge || undefined,
        },
      });
    } catch (e: any) {
      console.error("Save product error:", e);
      return json({ success: false, error: "Database error saving product" }, 500);
    }
  }

  return json({
    success: true,
    product: {
      id,
      name,
      description,
      category,
      price,
      stock,
      images: imagesArray,
      image_path: imagePath,
      badge: badge || undefined,
    },
    source: "fallback",
  });
};

export const onRequestDelete = async (context: any) => {
  const { request, env } = context;
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return json({ error: "Missing product id" }, 400);
  }

  const tursoUrl = env?.TURSO_DATABASE_URL;
  const tursoToken = env?.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken && typeof tursoUrl === "string" && typeof tursoToken === "string" && tursoUrl.trim() && tursoToken.trim()) {
    try {
      const db = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });
      let oldUrls: string[] = [];
      try {
        const existingRes = await db.execute({
          sql: "SELECT image_path, image, images FROM products WHERE id = ?",
          args: [id],
        });
        if (existingRes.rows && existingRes.rows.length > 0) {
          const row = existingRes.rows[0] as any;
          oldUrls = [row.image_path, row.image, ...parseImageList(row.images)]
            .map((u) => (typeof u === "string" ? u.trim() : ""))
            .filter(Boolean);
        }
      } catch {
        // Ignore lookup error on missing schema
      }

      await db.execute({ sql: "DELETE FROM products WHERE id = ?", args: [id] });
      if (oldUrls.length > 0) {
        await deleteR2UrlsIfUnreferenced(env, oldUrls);
      }
      return json({ success: true, id });
    } catch (e: any) {
      console.error("Delete product error:", e);
      return json({ success: false, error: "Failed to delete product" }, 500);
    }
  }

  return json({ success: true, id, source: "mock" });
};
