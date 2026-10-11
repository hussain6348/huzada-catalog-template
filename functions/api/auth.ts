/// <reference types="@cloudflare/workers-types" />
import { AuthEnv, createAuthToken } from './_auth';

export const onRequestPost: PagesFunction<AuthEnv> = async (context) => {
  const { request, env } = context;

  try {
    const body: any = await request.json();
    const providedPassword = (body.password || '').trim();

    const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
    const targetPassword = env?.ADMIN_PASSWORD || (isDev ? 'admin123' : '');

    if (!targetPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authentication configuration missing on server.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (providedPassword !== targetPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid credentials. Access denied.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const token = await createAuthToken(targetPassword);

    return new Response(
      JSON.stringify({
        success: true,
        token,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Authentication failed',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
