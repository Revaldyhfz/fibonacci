import { createContext, useCallback, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

const TOKENS_KEY = "tokens";
const USER_KEY = "user";

function readTokens() {
  try {
    const stored = localStorage.getItem(TOKENS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function readUser() {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function fetchMe(accessToken) {
  const res = await fetch("/api/auth/me/", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Failed to load user profile");
  }
  return res.json();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readUser());
  const [tokens, setTokens] = useState(() => readTokens());

  const isAuthenticated = !!tokens?.access;
  const isAdmin = !!user?.is_admin;

  // On reload, refresh the user profile in the background so role changes
  // made by an admin (e.g. demo promoted → user demoted) land within one
  // page load rather than requiring a logout.
  useEffect(() => {
    if (!tokens?.access) return;
    let cancelled = false;
    fetchMe(tokens.access)
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        localStorage.setItem(USER_KEY, JSON.stringify(me));
      })
      .catch(() => {
        // Silently ignore — stale profile is better than blocking the app.
      });
    return () => {
      cancelled = true;
    };
  }, [tokens?.access]);

  const login = useCallback(async ({ username, password }) => {
    const res = await fetch("/api/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Invalid credentials");
    }

    setTokens(data);
    localStorage.setItem(TOKENS_KEY, JSON.stringify(data));

    try {
      const me = await fetchMe(data.access);
      setUser(me);
      localStorage.setItem(USER_KEY, JSON.stringify(me));
    } catch {
      // Fallback — don't block login if /me/ is momentarily unreachable.
      const fallback = { username, is_admin: false, roles: [] };
      setUser(fallback);
      localStorage.setItem(USER_KEY, JSON.stringify(fallback));
    }
  }, []);

  const register = useCallback(async ({ username, email, password }) => {
    const res = await fetch("/api/auth/register/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const firstError =
        (data && (data.detail ||
          (typeof data === "object" && Object.values(data).flat()[0]))) ||
        "Registration failed.";
      throw new Error(firstError);
    }
    const tokenPayload = { access: data.access, refresh: data.refresh };
    setTokens(tokenPayload);
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokenPayload));
    setUser(data.user);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem(TOKENS_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, tokens, isAuthenticated, isAdmin, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
