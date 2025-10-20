import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState("Unknown");

  useEffect(() => {
    fetchStats();
    updateCurrentSession();
    const interval = setInterval(updateCurrentSession, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const res = await fetch("http://127.0.0.1:8000/api/trades/stats/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateCurrentSession = () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    
    if (utcHour >= 13 && utcHour < 22) setCurrentSession("New York");
    else if (utcHour >= 8 && utcHour < 17) setCurrentSession("London");
    else if (utcHour >= 0 && utcHour < 9) setCurrentSession("Tokyo");
    else setCurrentSession("Sydney");
  };

  const getSessionColor = () => {
    switch (currentSession) {
      case "New York": return "bg-blue-500";
      case "London": return "bg-green-500";
      case "Tokyo": return "bg-purple-500";
      case "Sydney": return "bg-orange-500";
      default: return "bg-neutral-500";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-semibold">Trading Journal</h1>
              <nav className="hidden md:flex gap-6">
                <Link to="/dashboard" className="text-sm font-medium text-neutral-900">Dashboard</Link>
                <Link to="/trades" className="text-sm text-neutral-600 hover:text-neutral-900">Trades</Link>
                <Link to="/analytics" className="text-sm text-neutral-600 hover:text-neutral-900">Analytics</Link>
              </nav>
            </div>
            <button onClick={() => { logout(); nav("/"); }} className="text-sm text-neutral-600 hover:text-neutral-900">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className={`rounded-lg ${getSessionColor()} p-4 mb-6`}>
          <div className="flex items-center justify-between text-white">
            <div>
              <div className="text-sm opacity-90">Current Trading Session</div>
              <div className="text-2xl font-semibold mt-1">{currentSession}</div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-90">Local Time</div>
              <div className="text-lg font-medium mt-1">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-sm text-neutral-500">Total Trades</div>
            <div className="mt-2 text-3xl font-semibold">{stats?.total_trades || 0}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-sm text-neutral-500">Win Rate</div>
            <div className="mt-2 text-3xl font-semibold">{stats?.winrate_percent || 0}%</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-sm text-neutral-500">Total P&L</div>
            <div className={`mt-2 text-3xl font-semibold ${stats?.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${stats?.total_pnl?.toFixed(2) || '0.00'}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-sm text-neutral-500">Winning Trades</div>
            <div className="mt-2 text-3xl font-semibold text-green-600">{stats?.wins || 0}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold mb-4">Average Performance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Avg Win</span>
                <span className="text-lg font-semibold text-green-600">+${Math.abs(stats?.avg_win || 0).toFixed(2)}</span>
              </div>
              <div className="h-px bg-neutral-200" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Avg Loss</span>
                <span className="text-lg font-semibold text-red-600">${(stats?.avg_loss || 0).toFixed(2)}</span>
              </div>
              <div className="h-px bg-neutral-200" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Win/Loss Ratio</span>
                <span className="text-lg font-semibold">
                  {stats?.avg_loss ? Math.abs((stats.avg_win / stats.avg_loss)).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold mb-4">Best & Worst</h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-neutral-600 mb-2">Best Trade</div>
                {stats?.best_trade && (
                  <div className="flex items-center justify-between bg-green-50 p-3 rounded">
                    <span className="text-sm font-medium">{stats.best_trade.symbol}</span>
                    <span className="text-lg font-semibold text-green-600">+${stats.best_trade.pnl.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-2">Worst Trade</div>
                {stats?.worst_trade && (
                  <div className="flex items-center justify-between bg-red-50 p-3 rounded">
                    <span className="text-sm font-medium">{stats.worst_trade.symbol}</span>
                    <span className="text-lg font-semibold text-red-600">${stats.worst_trade.pnl.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link to="/trades" className="inline-flex items-center justify-center rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800">
            Add New Trade
          </Link>
          <Link to="/analytics" className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-6 py-3 text-sm font-medium hover:bg-neutral-50">
            View Analytics
          </Link>
        </div>
      </main>
    </div>
  );
}