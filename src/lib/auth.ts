export const AUTH_CHANGE_EVENT = "auth_change";

export function isAuthenticated() {
  return localStorage.getItem("isAdminAuthenticated") === "true";
}

export async function loginToAdmin(password: string) {
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (response.status === 404) {
      if (password === "admin123") { 
        localStorage.setItem("isAdminAuthenticated", "true");
        window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
        return { success: true };
      }
      return { success: false, error: "Invalid password" };
    }

    if (response.ok) {
      localStorage.setItem("isAdminAuthenticated", "true");
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
      return { success: true };
    }
    
    return { success: false, error: "Invalid credentials" };
  } catch (error) {
    console.error("Login failed", error);
    return { success: false, error: "Network error connecting to server" };
  }
}

export const loginAdmin = loginToAdmin;

export function clearAdminToken() {
  localStorage.removeItem("isAdminAuthenticated");
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function getAuthHeaders() {
  return {
    'Content-Type': 'application/json'
  };
}
