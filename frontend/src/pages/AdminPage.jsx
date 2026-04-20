import { useEffect, useMemo, useState } from "react";
import Header from "../components/layout/Header";
import Card, { Stat } from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";
import { Input } from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

function authedFetch(url, token, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tokens?.access) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [ovRes, usersRes] = await Promise.all([
          authedFetch("/api/admin/overview/", tokens.access),
          authedFetch("/api/admin/users/", tokens.access),
        ]);
        if (!ovRes.ok || !usersRes.ok) {
          throw new Error("Failed to load admin data");
        }
        const ov = await ovRes.json();
        const us = await usersRes.json();
        if (cancelled) return;
        setOverview(ov);
        setUsers(Array.isArray(us) ? us : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load admin data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tokens?.access]);

  const filteredUsers = useMemo(() => {
    if (!filter.trim()) return users;
    const q = filter.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        (u.roles || []).some((r) => r.toLowerCase().includes(q))
    );
  }, [users, filter]);

  const onCopyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">Admin Console</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-purple-500/10 text-purple-300 border border-purple-500/30">
              Restricted
            </span>
          </div>
          <p className="text-neutral-400 text-sm">
            Operational overview and user management.
          </p>
        </div>

        {loading ? (
          <div className="py-16">
            <Spinner label="Loading admin data…" />
          </div>
        ) : error ? (
          <Card>
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <Stat label="Users" value={overview?.users_total ?? 0} />
              <Stat
                label="Admins"
                value={overview?.users_admin ?? 0}
                tone="accent"
              />
              <Stat
                label="Active (7d)"
                value={overview?.users_active_7d ?? 0}
                hint="Signed in recently"
                tone="positive"
              />
              <Stat label="Trades" value={overview?.trades_total ?? 0} />
              <Stat
                label="Strategies"
                value={overview?.strategies_total ?? 0}
              />
            </div>

            <Card
              title="Users"
              subtitle={`${filteredUsers.length} of ${users.length} shown`}
              action={
                <div className="w-48 sm:w-64">
                  <Input
                    name="filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter by username, email, role…"
                  />
                </div>
              }
              padding="p-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0f0f0f] text-xs uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="text-left px-5 py-3">User</th>
                      <th className="text-left px-5 py-3 hidden sm:table-cell">Email</th>
                      <th className="text-left px-5 py-3">Role</th>
                      <th className="text-right px-5 py-3">Trades</th>
                      <th className="text-right px-5 py-3 hidden md:table-cell">
                        Strategies
                      </th>
                      <th className="text-right px-5 py-3 hidden md:table-cell">
                        Assets
                      </th>
                      <th className="text-left px-5 py-3 hidden lg:table-cell">
                        Joined
                      </th>
                      <th className="text-left px-5 py-3 hidden lg:table-cell">
                        Last login
                      </th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-center text-neutral-500 py-8"
                        >
                          No users match that filter.
                        </td>
                      </tr>
                    )}
                    {filteredUsers.map((u) => {
                      const roleLabel = u.is_admin
                        ? "Admin"
                        : (u.roles && u.roles[0]) || "User";
                      const roleClass = u.is_admin
                        ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                        : "bg-neutral-800 text-neutral-300 border-neutral-700";
                      return (
                        <tr
                          key={u.id}
                          className="border-t border-neutral-800 hover:bg-[#0f0f0f] transition-colors"
                        >
                          <td className="px-5 py-3">
                            <div className="font-medium text-white">
                              {u.username}
                            </div>
                            <div className="sm:hidden text-xs text-neutral-400 truncate max-w-[180px]">
                              {u.email || "—"}
                            </div>
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell text-neutral-300">
                            {u.email || "—"}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${roleClass}`}
                            >
                              {roleLabel}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-neutral-200">
                            {u.trades_count ?? 0}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-neutral-200 hidden md:table-cell">
                            {u.strategies_count ?? 0}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-neutral-200 hidden md:table-cell">
                            {u.assets_count ?? 0}
                          </td>
                          <td className="px-5 py-3 text-neutral-400 hidden lg:table-cell">
                            {formatDate(u.date_joined)}
                          </td>
                          <td className="px-5 py-3 text-neutral-400 hidden lg:table-cell">
                            {formatDate(u.last_login)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {u.email && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onCopyEmail(u.email)}
                              >
                                Copy email
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
