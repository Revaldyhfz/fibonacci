import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Minimal styling via Tailwind (works even without it; just looks plain)
export default function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form);
      nav("/dashboard");
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Login failed. Check your username/password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-50">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Use your account to access your trades & analytics.
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm text-neutral-700">Username</label>
            <input
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={onChange}
              required
              className="h-10 rounded-md border border-neutral-300 px-3 outline-none focus:border-neutral-500"
              placeholder="johndoe"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm text-neutral-700">Password</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={onChange}
              required
              className="h-10 rounded-md border border-neutral-300 px-3 outline-none focus:border-neutral-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="mt-2 h-10 rounded-md bg-black text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-neutral-600">
          Don’t have an account?
          {/* You decided to create users manually for now. When ready, link to /register */}
          {" "}
          <Link to="#" className="pointer-events-none text-neutral-400">
            Register (coming soon)
          </Link>
        </div>
      </div>
    </div>
  );
}