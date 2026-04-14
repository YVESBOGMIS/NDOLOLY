import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL || "";

const client = axios.create({
  baseURL: apiUrl,
  // Uploads from mobile-hotspot or weak Wi-Fi can exceed 8s.
  timeout: 30000
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("lc_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setToken = (token) => {
  localStorage.setItem("lc_token", token);
};

export const clearToken = () => {
  localStorage.removeItem("lc_token");
};

export const getToken = () => localStorage.getItem("lc_token");

export default client;
