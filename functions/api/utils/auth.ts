// @ts-nocheck
import { requireAdmin, timingSafeEqual } from '../../_lib/guard';

export { timingSafeEqual };

export async function verifyAuth(request: Request, env: any): Promise<Response | null> {
  return requireAdmin(request, env);
}
