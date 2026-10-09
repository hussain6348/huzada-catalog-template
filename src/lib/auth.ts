const AUTH_STORAGE_KEY = 'merchant_admin_session_token';
export const AUTH_CHANGE_EVENT = 'merchant_auth_change';

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string, persist = false): void {
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, token);
    if (persist) {
      localStorage.setItem(AUTH_STORAGE_KEY, token);
    }
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { token } }));
  } catch (err) {
    console.warn('Failed to store auth session token:', err);
  }
}

export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { token: null } }));
  } catch (err) {
    console.warn('Failed to clear auth session token:', err);
  }
}

export function isAuthenticated(): boolean {
  const token = getAdminToken();
  return typeof token === 'string' && token.length > 5;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }
  return {};
}

export async function loginAdmin(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    const data: any = await res.json();
    if (res.ok && data.success && data.token) {
      setAdminToken(data.token, true);
      return { success: true, token: data.token };
    }

    return {
      success: false,
      error: data.error || 'Invalid credentials. Access denied.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Unable to establish secure connection.',
    };
  }
}
