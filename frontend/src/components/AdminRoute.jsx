import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  // While we don't yet know the user profile (first render after login),
  // block rather than flash a "forbidden" screen — the /me/ fetch will
  // resolve within a tick.
  if (user === null) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
