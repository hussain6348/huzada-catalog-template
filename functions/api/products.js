import { createClient } from '@libsql/client/web';
export async function onRequestPost(context) {
    try {
        const { name, price, description, image_path } = await context.request.json();
        const client = createClient({ url: context.env.TURSO_DATABASE_URL, authToken: context.env.TURSO_AUTH_TOKEN });
        await client.execute({
            sql: 'INSERT INTO products (name, price, description, image_path) VALUES (?, ?, ?, ?)',
            args: [name, price, description || '', image_path]
        });
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
export async function onRequestGet(context) {
    try {
        const client = createClient({ url: context.env.TURSO_DATABASE_URL, authToken: context.env.TURSO_AUTH_TOKEN });
        const result = await client.execute('SELECT * FROM products ORDER BY created_at DESC');
        return new Response(JSON.stringify({ success: true, products: result.rows }), { headers: { 'Content-Type': 'application/json' } });
    }
    catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
