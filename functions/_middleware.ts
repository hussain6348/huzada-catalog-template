// @ts-nocheck
import { createClient } from '@libsql/client/web';

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=960&q=75';

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function optimizeUnsplashUrl(rawUrl: string, width = 960, quality = 75): string {
  if (!rawUrl || !rawUrl.includes('images.unsplash.com')) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set('auto', 'format');
    parsed.searchParams.set('fit', 'crop');
    parsed.searchParams.set('w', String(width));
    parsed.searchParams.set('q', String(quality));
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);

  // 1. Strict Route Isolation: Allow API routes, agentic/discovery files, and static asset extensions to pass through untouched
  if (
    context.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/.well-known/') ||
    url.pathname === '/robots.txt' ||
    url.pathname === '/sitemap.xml' ||
    url.pathname === '/llms.txt' ||
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
  let businessHero = '';
  let businessAddress = '811 6th St N #200, Texas City, TX 77590';
  let businessPhone = '+1 (409) 256-3597';
  let businessHours = 'Mon–Sat, 9:00 AM – 6:00 PM';
  let businessCurrency = 'USD';

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
          businessLogo = parsed.logo || parsed.imageSlots?.logo || parsed.heroImage || parsed.imageSlots?.hero || '';
          businessHero = parsed.heroImage || parsed.imageSlots?.hero || '';
          if (parsed.address) businessAddress = parsed.address;
          if (parsed.phone) businessPhone = parsed.phone;
          if (parsed.hours) businessHours = parsed.hours;
          if (parsed.currency) businessCurrency = parsed.currency;
        }
      }
    }
  } catch {
    // Fail-open DB rule: if DB fetch fails, return response untouched without SEO failure
    return response;
  }

  // 5. Absolute HTTPS Canonical & Media URL Resolution from live request origin
  const isLocalHost = url.hostname === 'localhost' || url.hostname.startsWith('127.');
  const baseOrigin = isLocalHost ? url.origin : `https://${url.host}`;
  const canonicalUrl = baseOrigin + url.pathname;
  let fullLogoUrl = businessLogo;
  if (fullLogoUrl) {
    if (!fullLogoUrl.startsWith('http://') && !fullLogoUrl.startsWith('https://')) {
      fullLogoUrl = baseOrigin + (fullLogoUrl.startsWith('/') ? '' : '/') + fullLogoUrl;
    }
  } else {
    fullLogoUrl = baseOrigin + '/huzada-logo.png';
  }

  let effectiveHeroUrl = businessHero || DEFAULT_HERO_IMAGE;
  if (effectiveHeroUrl && !effectiveHeroUrl.startsWith('http://') && !effectiveHeroUrl.startsWith('https://')) {
    effectiveHeroUrl = baseOrigin + (effectiveHeroUrl.startsWith('/') ? '' : '/') + effectiveHeroUrl;
  }
  const isUnsplashHero = effectiveHeroUrl.includes('images.unsplash.com');
  const heroPreloadHref = isUnsplashHero
    ? optimizeUnsplashUrl(effectiveHeroUrl, 960, 75)
    : effectiveHeroUrl;
  const heroPreloadSrcSet = isUnsplashHero
    ? `${optimizeUnsplashUrl(effectiveHeroUrl, 640, 75)} 640w, ${optimizeUnsplashUrl(effectiveHeroUrl, 1080, 75)} 1080w`
    : '';

  // 6. XSS Sanitizer: HTML-escape database strings before HTML tag injection
  const escapedName = escapeHtml(businessName);
  const escapedDesc = escapeHtml(businessDesc);
  const escapedLogo = escapeHtml(fullLogoUrl);
  const escapedCanonicalUrl = escapeHtml(canonicalUrl);

  // 7. Schema.org Store / OnlineStore JSON-LD Generation
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': ['Store', 'OnlineStore'],
    name: businessName,
    description: businessDesc,
    url: canonicalUrl,
    image: fullLogoUrl,
  };
  if (businessPhone) {
    schema.telephone = businessPhone;
  }
  if (businessAddress) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: businessAddress,
    };
  }
  if (businessHours) {
    schema.openingHours = businessHours;
  }
  if (businessCurrency) {
    schema.currenciesAccepted = businessCurrency;
  }
  schema.priceRange = '$$';

  // Prevent script breakout via Unicode escape for <, while keeping valid JSON quotes
  const safeJsonLd = JSON.stringify(schema).replace(/</g, '\\u003c');

  // 8. HTMLRewriter Protocol (Atomic replacement to prevent duplicate tags)
  const rewriter = new HTMLRewriter()
    .on('title', {
      element(e) {
        e.setInnerContent(escapedName);
      },
    })
    .on('link#hero-lcp-preload', {
      element(e) {
        if (url.pathname !== '/') {
          e.remove();
          return;
        }
        e.setAttribute('href', escapeHtml(heroPreloadHref));
        if (heroPreloadSrcSet) {
          e.setAttribute('imagesrcset', escapeHtml(heroPreloadSrcSet));
          e.setAttribute('imagesizes', '100vw');
        } else {
          e.removeAttribute('imagesrcset');
          e.removeAttribute('imagesizes');
        }
      },
    })
    .on(
      'meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], script#catalog-json-ld, script#storefront-json-ld',
      {
        element(e) {
          e.remove();
        },
      }
    )
    .on('head', {
      element(e) {
        e.append(
          `\n    <meta name="description" content="${escapedDesc}" />` +
          `\n    <link rel="canonical" href="${escapedCanonicalUrl}" />` +
          `\n    <meta property="og:title" content="${escapedName}" />` +
          `\n    <meta property="og:description" content="${escapedDesc}" />` +
          `\n    <meta property="og:type" content="website" />` +
          `\n    <meta property="og:url" content="${escapedCanonicalUrl}" />` +
          `\n    <meta property="og:site_name" content="${escapedName}" />` +
          `\n    <meta property="og:image" content="${escapedLogo}" />` +
          `\n    <meta name="twitter:card" content="summary_large_image" />` +
          `\n    <meta name="twitter:title" content="${escapedName}" />` +
          `\n    <meta name="twitter:description" content="${escapedDesc}" />` +
          `\n    <meta name="twitter:image" content="${escapedLogo}" />` +
          `\n    <script id="catalog-json-ld" type="application/ld+json">${safeJsonLd}</script>`,
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
