const inferApiBase = () => {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  // Works for local dev and phone testing on LAN:
  // If frontend is opened at http://192.168.1.10:5173, default API becomes http://192.168.1.10:8000/api/v1
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8000/api/v1`;
};

const API_BASE = inferApiBase();

const TOKEN_KEY = "finance_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(payload?.detail || payload?.message || "Request failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}
