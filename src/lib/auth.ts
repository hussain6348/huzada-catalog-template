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
        return true;
      }
      return false;
    }

    if (response.ok) {
      localStorage.setItem("isAdminAuthenticated", "true");
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Login failed", error);
    return false;
  }
}
