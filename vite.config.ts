import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In-memory mock store for local dev / preview when Turso credentials are not connected
const devOrders: any[] = [
  {
    id: 'ORD-9021',
    customerName: 'Ayesha Khan',
    customerPhone: '03008765432',
    customerAddress: 'House 42, Street 7, F-8/2, Islamabad',
    notes: 'Please call before arriving, deliver after 2 PM',
    items: [
      {
        id: 'prod-1',
        name: 'Minimalist Steel Water Bottle',
        price: 1250,
        quantity: 2,
        category: 'Lifestyle',
        images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80'],
        image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80'
      },
      {
        id: 'prod-2',
        name: 'Walnut Desktop Organizer',
        price: 1850,
        quantity: 1,
        category: 'Workspace',
        images: ['https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80'],
        image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80'
      }
    ],
    total: 4350,
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString()
  },
  {
    id: 'ORD-8942',
    customerName: 'Zainab Fatima',
    customerPhone: '03219876543',
    customerAddress: 'Flat 304, Creek Vistas, Phase 8, DHA, Karachi',
    notes: 'Leave package with building security desk',
    items: [
      {
        id: 'prod-3',
        name: 'Matte Ceramic Pour-over Mug',
        price: 950,
        quantity: 2,
        category: 'Lifestyle',
        images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80'],
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80'
      }
    ],
    total: 1900,
    status: 'processing',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString()
  },
  {
    id: 'ORD-8810',
    customerName: 'Bilal Ahmed',
    customerPhone: '03335551234',
    customerAddress: 'Suite 12, Tech Hub Plaza, Gulberg III, Lahore',
    notes: '',
    items: [
      {
        id: 'prod-4',
        name: 'Mechanical Keypad Rest',
        price: 1400,
        quantity: 1,
        category: 'Workspace',
        images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80'],
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80'
      }
    ],
    total: 1400,
    status: 'completed',
    createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString()
  }
];

const devProducts: any[] = [
  {
    id: 'prod-1',
    name: 'Minimalist Steel Water Bottle',
    description: 'Double-wall vacuum insulated flask with matte textured finish (750ml).',
    price: 1250,
    category: 'Lifestyle',
    images: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
      'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
      'https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
    stock: 18,
    badge: 'Popular',
  },
  {
    id: 'prod-2',
    name: 'Walnut Desktop Organizer',
    description: 'Precision milled solid walnut tray for pens, phone, and desktop cables.',
    price: 1850,
    category: 'Workspace',
    images: [
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
    stock: 9,
  },
  {
    id: 'prod-3',
    name: 'Matte Ceramic Pour-Over Mug',
    description: 'Artisanal stoneware ceramic mug with ergonomic unglazed clay base (320ml).',
    price: 950,
    category: 'Lifestyle',
    images: [
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
    stock: 24,
  },
  {
    id: 'prod-4',
    name: 'Padded Keyboard Wrist Rest',
    description: 'High-density memory foam wrist rest with anti-fray stitched fabric rim.',
    price: 1400,
    category: 'Workspace',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    stock: 12,
  },
  {
    id: 'prod-5',
    name: 'Anodized Brass Rollerball Pen',
    description: 'Balanced solid brass casing engineered for ultra-smooth fluid ink delivery.',
    price: 850,
    category: 'Accessories',
    images: [
      'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80',
    stock: 35,
  },
  {
    id: 'prod-6',
    name: 'Felt Desk Pad Protector',
    description: 'Premium wool blend desk pad with non-slip natural rubber backing (80x40cm).',
    price: 1650,
    category: 'Workspace',
    images: [
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
    ],
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
    stock: 15,
  },
];

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-endpoints-dev-handler',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const pathname = urlObj.pathname;

          const isAuthorized = () => {
            const authHeader = req.headers['authorization'] || '';
            const token = authHeader.replace(/^Bearer\s+/i, '').trim();
            return !!token && token.length > 5;
          };

          // AUTH ENDPOINT
          if (pathname === '/api/auth' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const password = (parsed.password || '').trim();
                const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

                if (password === expectedPassword) {
                  const token = `token_${Buffer.from(`admin:${Date.now()}`).toString('base64')}.${Date.now()}`;
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, token }));
                } else {
                  res.writeHead(401, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: 'Invalid credentials. Access denied.' }));
                }
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
              }
            });
            return;
          }

          // ORDERS ENDPOINTS
          if (pathname === '/api/order' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const orderId = parsed.orderId || `ORD-${Date.now().toString().slice(-4)}`;
                const newOrder = {
                  id: orderId,
                  customerName: parsed.customerName || 'Anonymous',
                  customerPhone: parsed.customerPhone || '',
                  customerAddress: parsed.customerAddress || '',
                  notes: parsed.notes || '',
                  items: parsed.items || [],
                  total: Number(parsed.total || 0),
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                };
                devOrders.unshift(newOrder);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, orderId }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
              }
            });
            return;
          }

          if (pathname === '/api/orders') {
            if (!isAuthorized()) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Unauthorized: Authentication required.' }));
              return;
            }

            if (req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, orders: devOrders, source: 'dev-memory' }));
              return;
            }

            if (req.method === 'PATCH' || req.method === 'PUT') {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const { id, status } = JSON.parse(body || '{}');
                  const target = devOrders.find(o => o.id === id);
                  if (target) {
                    target.status = status;
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, id, status }));
                } catch {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: 'Invalid update' }));
                }
              });
              return;
            }
          }

          // PRODUCTS ENDPOINTS
          if (pathname === '/api/products') {
            if (req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, products: devProducts }));
              return;
            }

            if (req.method === 'POST') {
              if (!isAuthorized()) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Unauthorized: Authentication required.' }));
                return;
              }
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const product = JSON.parse(body || '{}');
                  const index = devProducts.findIndex(p => p.id === product.id);
                  if (index >= 0) {
                    devProducts[index] = { ...devProducts[index], ...product };
                  } else {
                    devProducts.unshift(product);
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, product }));
                } catch {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: 'Invalid product data' }));
                }
              });
              return;
            }

            if (req.method === 'DELETE') {
              if (!isAuthorized()) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Unauthorized: Authentication required.' }));
                return;
              }
              const id = urlObj.searchParams.get('id');
              if (id) {
                const idx = devProducts.findIndex(p => p.id === id);
                if (idx >= 0) {
                  devProducts.splice(idx, 1);
                }
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, id }));
              return;
            }
          }

          // MEDIA ASSET UPLOAD ENDPOINT
          if (pathname === '/api/upload' && req.method === 'POST') {
            if (!isAuthorized()) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Unauthorized: Authentication required.' }));
              return;
            }
            const sampleFallbackImages = [
              'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
              'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&q=80',
              'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
              'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
              'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
            ];
            const fallbackImage = sampleFallbackImages[Math.floor(Math.random() * sampleFallbackImages.length)];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, imageUrl: fallbackImage, key: `asset-${Date.now()}` }));
            return;
          }

          next();
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
  build: { outDir: 'dist', sourcemap: false }
});
