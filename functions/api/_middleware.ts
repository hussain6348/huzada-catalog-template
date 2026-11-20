// @ts-nocheck
import { verifyAuth } from './utils/auth';

export const onRequest = async (context: any) => {
  // Storefront Bypass: Public reads and CORS preflight requests
  if (context.request.method === 'GET' || context.request.method === 'OPTIONS') {
    return await context.next();
  }

  // Public Action Bypass: Allow unauthenticated login and customer orders
  const url = new URL(context.request.url);
  const path = url.pathname.toLowerCase();
  if (
    path.endsWith('/auth') ||
    path.endsWith('/order')
  ) {
    return await context.next();
  }

  // The Lock: For any other method (POST, DELETE, PUT), verify authentication
  const authRes = await verifyAuth(context.request, context.env);

  // The Block: If unauthorized, block immediately
  if (authRes) {
    return authRes;
  }

  // The Allow: Authorized request
  return await context.next();
};
