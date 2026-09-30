export async function onRequestPost(context: any) {
  try {
    const formData = await context.request.formData();
    const file = formData.get('file');
    const clientPrefix = formData.get('prefix') || 'default-client';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400 });
    }

    const uniqueFileName = `${clientPrefix}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    await context.env.UPLOAD_BUCKET.put(uniqueFileName, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    return new Response(JSON.stringify({
      success: true,
      filePath: uniqueFileName
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
