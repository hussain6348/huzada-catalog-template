export const AUTH_CHANGE_EVENT = 'auth-changed';
const TOKEN_KEY = 'huzada_admin_token';

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

export async function loginAdmin(
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
      return { success: true, token: data.token };
    }
    return {
      success: false,
      error: data.error || 'Invalid credentials. Access denied.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error during authentication.',
    };
  }
}

export function logoutAdmin(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}
