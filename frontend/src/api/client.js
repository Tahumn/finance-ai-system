const inferApiBase = () => {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // Works for local dev and phone testing on LAN:
  // If frontend is opened at http://192.168.1.10:5173, default API becomes http://192.168.1.10:8005/api/v1
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8005/api/v1`;
};

const API_BASE = inferApiBase();

export const getBaseUrl = () => API_BASE.replace(/\/api\/v1$/, "");

const TOKEN_KEY = "finance_token";

export const getToken = () => {
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  if (!token || token === "undefined" || token === "null") return null;
  return token;
};

export const setToken = (token, remember = true) => {
  clearToken();
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

function buildFetchHint() {
  return `Failed to fetch. Khong ket noi duoc API (${API_BASE}). Hay chac chan backend dang chay (vi du: docker compose --profile micro up -d).`;
}

export async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (err) {
    const hint = buildFetchHint();
    const error = new Error(err?.message ? `${err.message}. ${hint}` : hint);
    error.cause = err;
    throw error;
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent("finance:logout"));
    }
    let message = payload?.detail || payload?.message || "Request failed";
    if (Array.isArray(message)) {
      message = message.map((item) => item?.msg || "Invalid input").join(", ");
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function requestForm(path, formData) {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: formData
    });
  } catch (err) {
    const hint = buildFetchHint();
    const error = new Error(err?.message ? `${err.message}. ${hint}` : hint);
    error.cause = err;
    throw error;
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent("finance:logout"));
    }
    let message = payload?.detail || payload?.message || "Request failed";
    if (Array.isArray(message)) {
      message = message.map((item) => item?.msg || "Invalid input").join(", ");
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}
