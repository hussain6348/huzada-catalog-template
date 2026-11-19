// @ts-nocheck
import { createClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { storefrontSettings } from '../../src/db/schema';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export async function onRequestGet(context: any) {
  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return new Response(JSON.stringify({
        id: 1,
        primaryColor: '#0ea5e9',
        bgColor: '#0f172a',
        textColor: '#ffffff'
      }), {
        headers: jsonHeaders,
        status: 200,
      });
    }

    const client = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    await client.execute(`
      CREATE TABLE IF NOT EXISTS storefront_settings (
        id INTEGER PRIMARY KEY,
        primary_color TEXT NOT NULL DEFAULT '#0ea5e9',
        bg_color TEXT NOT NULL DEFAULT '#0f172a',
        text_color TEXT NOT NULL DEFAULT '#ffffff'
      )
    `);

    const db = drizzle(client);
    const result = await db.select().from(storefrontSettings).where(eq(storefrontSettings.id, 1));

    // Separate, safe query for logo (NO SQL JOINS)
    let logo: string | null = null;
    try {
      await client.execute('CREATE TABLE IF NOT EXISTS business_info (id TEXT PRIMARY KEY, data TEXT)');
      const bizRes = await client.execute({
        sql: 'SELECT data FROM business_info WHERE id = ?',
        args: ['default'],
      });

      if (bizRes.rows && bizRes.rows.length > 0 && bizRes.rows[0]?.data) {
        try {
          const parsed = JSON.parse(bizRes.rows[0].data as string);
          logo = parsed?.logo || parsed?.imageSlots?.logo || null;
        } catch {
          logo = null;
        }
      }
    } catch {
      logo = null;
    }

    if (!logo) {
      try {
        await client.execute('CREATE TABLE IF NOT EXISTS theme_settings (slot_id TEXT PRIMARY KEY, image_url TEXT)');
        const themeMediaRes = await client.execute({
          sql: 'SELECT image_url FROM theme_settings WHERE slot_id = ?',
          args: ['logo'],
        });
        if (themeMediaRes.rows && themeMediaRes.rows.length > 0 && themeMediaRes.rows[0]?.image_url) {
          logo = themeMediaRes.rows[0].image_url as string;
        }
      } catch {
        logo = null;
      }
    }

    if (result && result.length > 0) {
      return new Response(JSON.stringify({
        ...result[0],
        logo,
      }), {
        headers: jsonHeaders,
        status: 200,
      });
    }

    return new Response(JSON.stringify({
      id: 1,
      primaryColor: '#0ea5e9',
      bgColor: '#0f172a',
      textColor: '#ffffff',
      logo,
    }), {
      headers: jsonHeaders,
      status: 200,
    });
  } catch (err: any) {
    console.error("GET Theme Error:", err);
    return new Response(JSON.stringify({
      id: 1,
      primaryColor: '#0ea5e9',
      bgColor: '#0f172a',
      textColor: '#ffffff',
      logo: null,
      error: err.message
    }), {
      headers: jsonHeaders,
      status: 200,
    });
  }
}

export async function onRequestPost(context: any) {
  try {
    const env = context.env || {};
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: 'Turso database credentials missing in environment' }), {
        headers: jsonHeaders,
        status: 503,
      });
    }

    const client = createClient({
      url: env.TURSO_DATABASE_URL.trim(),
      authToken: env.TURSO_AUTH_TOKEN.trim(),
    });

    await client.execute(`
      CREATE TABLE IF NOT EXISTS storefront_settings (
        id INTEGER PRIMARY KEY,
        primary_color TEXT NOT NULL DEFAULT '#0ea5e9',
        bg_color TEXT NOT NULL DEFAULT '#0f172a',
        text_color TEXT NOT NULL DEFAULT '#ffffff'
      )
    `);

    const db = drizzle(client);

    const payload = await context.request.json();
    const primaryColor = payload.primaryColor || '#0ea5e9';
    const bgColor = payload.bgColor || '#0f172a';
    const textColor = payload.textColor || '#ffffff';

    await db.insert(storefrontSettings)
      .values({ id: 1, primaryColor, bgColor, textColor })
      .onConflictDoUpdate({
        target: storefrontSettings.id,
        set: { primaryColor, bgColor, textColor }
      });

    return new Response(JSON.stringify({
      success: true,
      data: { id: 1, primaryColor, bgColor, textColor }
    }), {
      headers: jsonHeaders,
      status: 200,
    });
  } catch (err: any) {
    console.error("POST Theme Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to save theme' }), {
      headers: jsonHeaders,
      status: 500,
    });
  }
}
