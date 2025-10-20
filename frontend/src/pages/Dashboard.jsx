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
      case "New York": return "from-blue-500 to-blue-600";
      case "London": return "from-green-500 to-green-600";
      case "Tokyo": return "from-purple-500 to-purple-600";
      case "Sydney": return "from-orange-500 to-orange-600";
      default: return "from-neutral-500 to-neutral-600";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-[#141414]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-white">Trading Journal</h1>
              <nav className="hidden md:flex gap-6">
                <Link to="/dashboard" className="text-sm font-medium text-white">Dashboard</Link>
                <Link to="/trades" className="text-sm text-neutral-400 hover:text-white transition-colors">Trades</Link>
                <Link to="/analytics" className="text-sm text-neutral-400 hover:text-white transition-colors">Analytics</Link>
              </nav>
            </div>
            <button 
              onClick={() => { logout(); nav("/"); }} 
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Trading Session Banner */}
        <div className={`rounded-2xl bg-gradient-to-r ${getSessionColor()} p-6 mb-8 shadow-xl`}>
          <div className="flex items-center justify-between text-white">
            <div>
              <div className="text-sm opacity-90 font-medium">Current Trading Session</div>
              <div className="text-3xl font-bold mt-1">{currentSession}</div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-90 font-medium">Local Time</div>
              <div className="text-2xl font-bold mt-1">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 transition-colors">
            <div className="text-sm text-neutral-400 font-medium mb-2">Total Trades</div>
            <div className="text-4xl font-bold text-white">{stats?.total_trades || 0}</div>
          </div>
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 transition-colors">
            <div className="text-sm text-neutral-400 font-medium mb-2">Win Rate</div>
            <div className="text-4xl font-bold text-emerald-500">{stats?.winrate_percent || 0}%</div>
          </div>
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 transition-colors">
            <div className="text-sm text-neutral-400 font-medium mb-2">Total P&L</div>
            <div className={`text-4xl font-bold ${stats?.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              ${stats?.total_pnl?.toFixed(2) || '0.00'}
            </div>
          </div>
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 transition-colors">
            <div className="text-sm text-neutral-400 font-medium mb-2">Winning Trades</div>
            <div className="text-4xl font-bold text-emerald-500">{stats?.wins || 0}</div>
          </div>
        </div>

        {/* Performance Cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">Average Performance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-neutral-800">
                <span className="text-sm text-neutral-400 font-medium">Avg Win</span>
                <span className="text-xl font-bold text-emerald-500">+${Math.abs(stats?.avg_win || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-neutral-800">
                <span className="text-sm text-neutral-400 font-medium">Avg Loss</span>
                <span className="text-xl font-bold text-red-500">${(stats?.avg_loss || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-neutral-400 font-medium">Win/Loss Ratio</span>
                <span className="text-xl font-bold text-white">
                  {stats?.avg_loss ? Math.abs((stats.avg_win / stats.avg_loss)).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">Best & Worst</h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-neutral-400 font-medium mb-3">Best Trade</div>
                {stats?.best_trade && (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
                    <span className="text-sm font-bold text-white">{stats.best_trade.symbol}</span>
                    <span className="text-xl font-bold text-emerald-500">+${stats.best_trade.pnl.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-neutral-400 font-medium mb-3">Worst Trade</div>
                {stats?.worst_trade && (
                  <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                    <span className="text-sm font-bold text-white">{stats.worst_trade.symbol}</span>
                    <span className="text-xl font-bold text-red-500">${stats.worst_trade.pnl.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <Link 
            to="/trades" 
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all"
          >
            View Trades Calendar
          </Link>
          <Link 
            to="/analytics" 
            className="inline-flex items-center justify-center px-6 py-3 bg-[#141414] border border-neutral-700 hover:border-neutral-600 text-white font-medium rounded-lg transition-colors"
          >
            View Analytics
          </Link>
        </div>
      </main>
    </div>
  );
}