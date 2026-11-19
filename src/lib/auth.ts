export const AUTH_CHANGE_EVENT = 'booking_auth_changed';
const TOKEN_KEY = 'huzada_booking_admin_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

export async function loginAdmin(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    let data: any = {};
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (res.ok && data.success && data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
      return { success: true, token: data.token };
    }
    return { success: false, error: data.error || 'Access denied.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function logoutAdmin(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearAdminToken(): void {
  logoutAdmin();
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
