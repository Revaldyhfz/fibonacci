import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <button
            onClick={() => {
              logout();
              nav("/");
            }}
            className="h-9 rounded-md border border-neutral-300 px-3 hover:bg-neutral-100"
          >
            Logout
          </button>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-sm text-neutral-500">Total Trades</div>
            <div className="mt-1 text-3xl font-semibold">—</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-sm text-neutral-500">Win Rate</div>
            <div className="mt-1 text-3xl font-semibold">—</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-sm text-neutral-500">Total PnL</div>
            <div className="mt-1 text-3xl font-semibold">—</div>
          </div>
        </div>

        <p className="mt-8 text-neutral-500">
          We’ll hook this to your API next.
        </p>
      </div>
    </div>
  );
}