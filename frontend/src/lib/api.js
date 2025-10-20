import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// Attach access token from storage on every request
api.interceptors.request.use((config) => {
  const tokens = localStorage.getItem("tokens");
  if (tokens) {
    const parsed = JSON.parse(tokens);
    if (parsed.access) {
      config.headers.Authorization = `Bearer ${parsed.access}`;
    }
  }
  return config;
});