import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [access, setAccess] = useState(() => localStorage.getItem("access"));
  const [refresh, setRefresh] = useState(() => localStorage.getItem("refresh"));
  const [user, setUser] = useState(null); // optional: store username later
  const isAuthenticated = !!access;

  // Persist to localStorage whenever tokens change
  useEffect(() => {
    if (access) localStorage.setItem("access", access);
    else localStorage.removeItem("access");
  }, [access]);

  useEffect(() => {
    if (refresh) localStorage.setItem("refresh", refresh);
    else localStorage.removeItem("refresh");
  }, [refresh]);

  const login = async ({ username, password }) => {
    // SimpleJWT default endpoint
    const { data } = await api.post("/api/token/", { username, password });
    setAccess(data.access);
    setRefresh(data.refresh);
    // (Optional) fetch profile if you have /me endpoint
    // const me = await api.get("/api/me/");
    // setUser(me.data);
  };

  const logout = () => {
    setAccess(null);
    setRefresh(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ access, refresh, user, isAuthenticated, login, logout }),
    [access, refresh, user, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}