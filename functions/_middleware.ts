// @ts-nocheck
import { createClient } from '@libsql/client/web';

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);

  // 1. Strict Route Isolation: Allow API routes and static asset extensions to pass through untouched
  if (
    context.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.match(/\.(js|css|webp|png|jpg|jpeg|svg|ico|json|txt|xml)$/i)
  ) {
    return await context.next();
  }

  // 2. Query-String DDoS Shield: Normalize cache key by stripping search parameters
  const cache = caches.default;
  const cacheKey = new Request(url.origin + url.pathname, context.request);

  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
  } catch {
    // Fail-open: continue to fetch if cache lookup errors
  }

  // 3. Fetch static HTML response from upstream
  const response = await context.next();

  // If response is not HTML, return untouched
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  // 4. Fail-Open Turso Database Fetch
  let businessName = 'Huzada Storefront';
  let businessDesc = 'Curated Storefront Catalog & Direct Ordering';
  let businessLogo = '';

  try {
    const env = context.env || {};
    if (env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN) {
      const client = createClient({
        url: env.TURSO_DATABASE_URL.trim(),
        authToken: env.TURSO_AUTH_TOKEN.trim(),
      });

      const res = await client.execute({
        sql: 'SELECT data FROM business_info WHERE id = ?',
        args: ['default'],
      });

      if (res.rows && res.rows.length > 0 && res.rows[0]?.data) {
        const parsed = JSON.parse(res.rows[0].data as string);
        if (parsed) {
          if (parsed.name) businessName = parsed.name;
          if (parsed.tagline) businessDesc = parsed.tagline;
          else if (parsed.aboutDescription) businessDesc = parsed.aboutDescription;
          businessLogo = parsed.logo || parsed.imageSlots?.logo || '';
        }
      }
    }
  } catch {
    // Fail-open DB rule: if DB fetch fails, return response untouched without SEO failure
    return response;
  }

  // 5. XSS Sanitizer: HTML-escape database strings before injection
  const escapedName = escapeHtml(businessName);
  const escapedDesc = escapeHtml(businessDesc);
  const escapedLogo = escapeHtml(businessLogo);

  // 6. HTMLRewriter Protocol (No double tags)
  const rewriter = new HTMLRewriter()
    .on('title', {
      element(e) {
        e.setInnerContent(escapedName);
      },
    })
    .on('head', {
      element(e) {
        e.append(
          `<meta name="description" content="${escapedDesc}"><meta property="og:image" content="${escapedLogo}">`,
          { html: true }
        );
      },
    });

  const transformedResponse = rewriter.transform(response);

  // Set Edge & Browser Cache headers
  const newHeaders = new Headers(transformedResponse.headers);
  newHeaders.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');

  const finalResponse = new Response(transformedResponse.body, {
    status: transformedResponse.status,
    statusText: transformedResponse.statusText,
    headers: newHeaders,
  });

  // Safely populate edge cache with normalized cacheKey
  if (finalResponse.status === 200) {
    try {
      await cache.put(cacheKey, finalResponse.clone());
    } catch {
      // Fail-safe cache put
    }
  }

  return finalResponse;
};
