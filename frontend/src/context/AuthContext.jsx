import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState(() => {
    const stored = localStorage.getItem("tokens");
    return stored ? JSON.parse(stored) : null;
  });

  // Add isAuthenticated derived from tokens
  const isAuthenticated = !!tokens?.access;

  const login = async ({ username, password }) => {
    try {
      // FIX: Correct endpoint
      const res = await fetch("/api/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Invalid credentials");
      }

      console.log("✅ Login successful:", data);

      setTokens(data);
      localStorage.setItem("tokens", JSON.stringify(data));
      setUser({ username });
      
      // Don't show alert on success, let the component handle navigation
    } catch (error) {
      console.error("❌ Login failed:", error.message);
      // Re-throw so LoginPage can catch it
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem("tokens");
  };

  return (
    <AuthContext.Provider value={{ user, tokens, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}