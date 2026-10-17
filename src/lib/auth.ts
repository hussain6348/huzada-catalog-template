export const AUTH_CHANGE_EVENT = "auth_change";

export function isAuthenticated() {
  return !!localStorage.getItem("waas_admin_key");
}

export async function loginToAdmin(password: string) {
  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    if (response.ok) {
      localStorage.setItem("waas_admin_key", password);
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
      return { success: true };
    }
    return { success: false, error: "Invalid password" };
  } catch (error) {
    console.error("Login failed", error);
    return { success: false, error: "Network error" };
  }
}

export const loginAdmin = loginToAdmin;

export function clearAdminToken() {
  localStorage.removeItem("waas_admin_key");
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function getAuthHeaders() {
  const key = localStorage.getItem("waas_admin_key");
  return {
    "Content-Type": "application/json",
    "x-admin-key": key || ""
  };
}
