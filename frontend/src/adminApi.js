import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
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
