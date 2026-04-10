import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL || "";
const adminTokenKey = "lc_admin_token";

const client = axios.create({
  baseURL: apiUrl,
  timeout: 10000
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(adminTokenKey);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // In dev, the admin UI is served at `/admin` by Vite.
  // Admin API requests must go through `/admin-api/*` so they reach the backend via proxy.
  if (!apiUrl && typeof config.url === "string") {
    const url = config.url;
    if (url.startsWith("/admin/")) {
      config.url = `/admin-api/${url.slice("/admin/".length)}`;
    } else if (url === "/admin") {
      config.url = "/admin-api";
    }
  }

  return config;
});

export const setAdminToken = (token) => {
  localStorage.setItem(adminTokenKey, token);
};

export const clearAdminToken = () => {
  localStorage.removeItem(adminTokenKey);
};

export const getAdminToken = () => localStorage.getItem(adminTokenKey);

export default client;
