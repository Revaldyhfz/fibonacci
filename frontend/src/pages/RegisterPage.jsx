import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Input } from "../components/ui/Input";
import Button from "../components/ui/Button";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";
import { useToast } from "../context/ToastContext";

export default function RegisterPage() {
  const nav = useNavigate();
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined, form: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.username.length < 3) next.username = "At least 3 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email.";
    if (form.password.length < 8) next.password = "At least 8 characters.";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
      });
      toast.success("Account created. Welcome!");
      nav("/dashboard");
    } catch (err) {
      setErrors({ form: err.message || "Registration failed." });
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
          <h1 className="text-3xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-neutral-400">Start tracking your trades</p>
        </div>

        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Input
              label="Username"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={onChange}
              error={errors.username}
              placeholder="trader42"
              required
            />
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={onChange}
              error={errors.email}
              placeholder="you@example.com"
              required
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={onChange}
              error={errors.password}
              placeholder="Minimum 8 characters"
              required
            />
            <Input
              label="Confirm password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={onChange}
              error={errors.confirm}
              placeholder="Repeat your password"
              required
            />

            {errors.form && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3">
                <p className="text-sm text-red-400">{errors.form}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <div className="mt-6">
            <GoogleSignInButton
              onError={(msg) => setErrors({ form: msg })}
              onBusy={setLoading}
            />
          </div>

          <p className="mt-6 pt-6 border-t border-neutral-800 text-center text-sm text-neutral-400">
            Already registered?{" "}
            <Link to="/" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
