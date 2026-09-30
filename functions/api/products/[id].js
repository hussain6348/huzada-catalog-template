import { createClient } from '@libsql/client/web';
export async function onRequestPut(context) {
    try {
        const id = context.params.id;
        const { name, price, description, image_path } = await context.request.json();
        const client = createClient({ url: context.env.TURSO_DATABASE_URL, authToken: context.env.TURSO_AUTH_TOKEN });
        await client.execute({
            sql: 'UPDATE products SET name = ?, price = ?, description = ?, image_path = ? WHERE id = ?',
            args: [name, price, description || '', image_path, id]
        });
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
export async function onRequestDelete(context) {
    try {
        const id = context.params.id;
        const client = createClient({ url: context.env.TURSO_DATABASE_URL, authToken: context.env.TURSO_AUTH_TOKEN });
        await client.execute({
            sql: 'DELETE FROM products WHERE id = ?',
            args: [id]
        });
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
