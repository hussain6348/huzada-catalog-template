import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-order-handler',
      configureServer(server) {
        server.middlewares.use('/api/order', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const orderId = `ORD-${Date.now()}`;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, orderId }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
              }
            });
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
  },
  build: { outDir: 'dist', sourcemap: false }
});
