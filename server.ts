import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createClient } from '@libsql/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(cors());
app.use(express.json());

// In-Memory Storage & Fallback
let inMemoryProducts = [
  {
    id: 'prod-001',
    name: 'Classic Vintage Denim Jacket',
    description: 'Heavyweight premium denim jacket with timeless cut and buttoned chest pockets.',
    category: 'Apparel',
    price: 4500,
    stock: 12,
    badge: 'Popular',
    image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&q=80'],
  },
  {
    id: 'prod-002',
    name: 'Heavyweight Minimalist Tee',
    description: '240 GSM 100% combed cotton basic t-shirt with ribbed collar and relaxed fit.',
    category: 'Apparel',
    price: 1850,
    stock: 25,
    badge: 'Bestseller',
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'],
  },
  {
    id: 'prod-003',
    name: 'Full-Grain Leather Bi-Fold Wallet',
    description: 'Handcrafted genuine leather wallet with 8 card slots, currency divider, and RFID shield.',
    category: 'Accessories',
    price: 2400,
    stock: 15,
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80'],
  },
  {
    id: 'prod-004',
    name: 'Matte Black Chrono Watch',
    description: 'Sleek analog dial with stainless steel mesh strap, quartz movement, and 50m water resistance.',
    category: 'Watches',
    price: 6800,
    stock: 8,
    badge: 'Limited',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80'],
  },
  {
    id: 'prod-005',
    name: 'Rugged Canvas Travel Duffel',
    description: 'Water-resistant waxed canvas weekender bag with reinforced leather handles and luggage strap.',
    category: 'Bags',
    price: 5200,
    stock: 10,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'],
  },
  {
    id: 'prod-006',
    name: 'Polarized Vintage Acetate Shades',
    description: 'UV400 protective polarized sunglasses with lightweight amber acetate frame.',
    category: 'Accessories',
    price: 2950,
    stock: 18,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80'],
  },
];

let inMemoryOrders: any[] = [];

// Optional Turso client initialization
let tursoClient: ReturnType<typeof createClient> | null = null;
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (tursoUrl && tursoToken) {
  try {
    tursoClient = createClient({ url: tursoUrl, authToken: tursoToken });
  } catch (err) {
    console.warn('[AI Studio] Turso initialization warning, using in-memory store:', err);
  }
}

// Token helpers
function createAuthToken(password: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'merchant_admin',
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
      nonce: Math.random().toString(36).substring(2),
    })
  ).toString('base64');
  const signature = crypto.createHmac('sha256', password).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function verifyAuth(req: express.Request): boolean {
  const header = req.headers.authorization;
  if (!header) return false;
  const rawToken = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  const parts = rawToken.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', ADMIN_PASSWORD).update(payloadB64).digest('hex');
    if (signature !== expectedSig) return false;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

// ---------------- API ROUTES ----------------

// Auth route
app.post('/api/auth', (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).trim() !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid credentials. Access denied.' });
  }
  const token = createAuthToken(ADMIN_PASSWORD);
  return res.json({ success: true, token });
});

// Products & Catalog Routes
app.get(['/api/products', '/api/catalog'], async (_req, res) => {
  if (tursoClient) {
    try {
      const result = await tursoClient.execute('SELECT * FROM products ORDER BY rowid DESC');
      if (result.rows.length > 0) {
        const products = result.rows.map((row: any) => {
          let parsedImages: string[] = [];
          if (typeof row.images === 'string' && row.images.trim()) {
            try {
              const parsed = JSON.parse(row.images);
              if (Array.isArray(parsed)) parsedImages = parsed.filter(Boolean);
            } catch {
              parsedImages = [row.images];
            }
          }
          const primary = row.image || row.image_path || parsedImages[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80';
          return {
            id: String(row.id),
            name: String(row.name || ''),
            description: String(row.description || ''),
            price: Number(parseFloat(row.price) || 0),
            category: String(row.category || 'General'),
            stock: Number(parseInt(row.stock, 10) || 10),
            image: primary,
            image_path: primary,
            images: parsedImages.length > 0 ? parsedImages : [primary],
            badge: row.badge ? String(row.badge) : undefined,
          };
        });
        return res.json({ success: true, products });
      }
    } catch (err) {
      console.warn('[AI Studio] Turso query error, returning in-memory products:', err);
    }
  }
  return res.json({ success: true, products: inMemoryProducts });
});

app.post('/api/products', async (req, res) => {
  if (!verifyAuth(req)) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  const body = req.body || {};
  const id = String(body.id || `prod-${Date.now().toString().slice(-6)}`);
  const name = String(body.name || '');
  const description = String(body.description || '');
  const category = String(body.category || 'General');
  const price = Number(parseFloat(body.price) || 0);
  const stock = Number(parseInt(body.stock, 10) || 10);
  const image = String(body.image || (Array.isArray(body.images) && body.images[0]) || '');
  const images = Array.isArray(body.images) ? body.images : (image ? [image] : []);

  const newProduct = {
    ...body,
    id,
    name,
    description,
    category,
    price,
    stock,
    image,
    images,
  };

  if (tursoClient) {
    try {
      await tursoClient.execute({
        sql: `INSERT INTO products (id, name, description, category, price, stock, image, images)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, category = excluded.category, price = excluded.price, stock = excluded.stock, image = excluded.image, images = excluded.images`,
        args: [id, name, description, category, price, stock, image, JSON.stringify(images)],
      });
    } catch (err) {
      console.warn('[AI Studio] Turso insert error, saved to in-memory store:', err);
    }
  }

  const existingIdx = inMemoryProducts.findIndex((p) => p.id === id);
  if (existingIdx >= 0) {
    inMemoryProducts[existingIdx] = newProduct;
  } else {
    inMemoryProducts.unshift(newProduct);
  }

  return res.json({ success: true, product: newProduct });
});

app.delete('/api/products', async (req, res) => {
  if (!verifyAuth(req)) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  const id = String(req.query.id || '');
  if (!id) {
    return res.status(400).json({ success: false, error: 'Product id is required.' });
  }

  if (tursoClient) {
    try {
      await tursoClient.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [id] });
    } catch (err) {
      console.warn('[AI Studio] Turso delete error:', err);
    }
  }
  inMemoryProducts = inMemoryProducts.filter((p) => p.id !== id);
  return res.json({ success: true, id });
});

app.put('/api/products/:id', async (req, res) => {
  if (!verifyAuth(req)) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  const { id } = req.params;
  const body = req.body || {};
  const existingIdx = inMemoryProducts.findIndex((p) => p.id === id);
  if (existingIdx >= 0) {
    inMemoryProducts[existingIdx] = { ...inMemoryProducts[existingIdx], ...body };
  }
  return res.json({ success: true });
});

app.delete('/api/products/:id', async (req, res) => {
  if (!verifyAuth(req)) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  const { id } = req.params;
  inMemoryProducts = inMemoryProducts.filter((p) => p.id !== id);
  return res.json({ success: true });
});

// Orders Routes
app.post('/api/order', async (req, res) => {
  const body = req.body || {};
  const orderId = body.orderId || `ORD-${Date.now().toString().slice(-6)}`;
  const order = {
    id: orderId,
    customerName: body.customerName || '',
    customerPhone: body.customerPhone || '',
    customerAddress: body.customerAddress || '',
    notes: body.notes || '',
    items: body.items || [],
    total: Number(body.total || 0),
    status: body.status || 'pending',
    createdAt: new Date().toISOString(),
  };

  if (tursoClient) {
    try {
      await tursoClient.execute({
        sql: `INSERT INTO orders (id, customer_name, customer_phone, customer_address, notes, items, total, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          order.id,
          order.customerName,
          order.customerPhone,
          order.customerAddress,
          order.notes,
          JSON.stringify(order.items),
          order.total,
          order.status,
          order.createdAt,
        ],
      });
    } catch (err) {
      console.warn('[AI Studio] Turso order insert error:', err);
    }
  }

  inMemoryOrders.unshift(order);
  return res.json({ success: true, orderId });
});

app.get('/api/orders', (req, res) => {
  if (!verifyAuth(req)) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  return res.json({ success: true, orders: inMemoryOrders });
});

app.patch('/api/orders', (req, res) => {
  if (!verifyAuth(req)) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  const { id, status } = req.body || {};
  const order = inMemoryOrders.find((o) => o.id === id);
  if (order) {
    order.status = status;
  }
  return res.json({ success: true, id, status });
});

// Media upload endpoint
app.post('/api/upload', (req, res) => {
  if (!verifyAuth(req)) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  const sampleFallbackImages = [
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
    'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80',
    'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
    'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80',
  ];
  const imageUrl = sampleFallbackImages[Math.floor(Math.random() * sampleFallbackImages.length)];
  return res.json({ success: true, imageUrl, previewMode: true });
});

// ---------------- SERVING FRONTEND ----------------

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

startServer();
