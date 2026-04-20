import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Input } from "../components/ui/Input";
import Button from "../components/ui/Button";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";

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
      setError(err.message || "Login failed. Check your username/password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Fibonacci</h1>
          <p className="text-neutral-400">Sign in to your trading journal</p>
        </div>

        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={onSubmit} className="space-y-5">
            <Input
              label="Username"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={onChange}
              required
              placeholder="Enter your username"
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={onChange}
              required
              placeholder="Enter your password"
            />

            {error && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6">
            <GoogleSignInButton onError={setError} onBusy={setLoading} />
          </div>

          <p className="mt-6 pt-6 border-t border-neutral-800 text-center text-sm text-neutral-400">
            New here?{" "}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
              Create an account
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-neutral-500 mt-6">
          Professional trading journal · Built for serious traders
        </p>
      </div>
    </div>
  );
}
