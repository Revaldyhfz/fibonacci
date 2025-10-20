import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    fetchStats();
    updateSessions();
    const interval = setInterval(updateSessions, 60000); // Update every minute
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

  const updateSessions = () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    
    // Session times in UTC
    const sessionData = [
      { name: "Sydney", start: 22, end: 7, color: "from-orange-500 to-orange-600", active: false },
      { name: "Tokyo", start: 0, end: 9, color: "from-purple-500 to-purple-600", active: false },
      { name: "London", start: 8, end: 17, color: "from-green-500 to-green-600", active: false },
      { name: "New York", start: 13, end: 22, color: "from-blue-500 to-blue-600", active: false },
    ];

    // Check which sessions are active
    sessionData.forEach(session => {
      if (session.start < session.end) {
        session.active = utcHour >= session.start && utcHour < session.end;
      } else {
        // Session crosses midnight
        session.active = utcHour >= session.start || utcHour < session.end;
      }
    });

    // Check for London/New York overlap (13:00-17:00 UTC)
    const isLondonNYOverlap = utcHour >= 13 && utcHour < 17;

    setSessions({
      active: sessionData.filter(s => s.active),
      all: sessionData,
      isLondonNYOverlap,
      currentTime: now
    });
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
        {/* Trading Sessions Banner */}
        <div className="mb-8 space-y-4">
          {/* London/NY Overlap - Special Treatment */}
          {sessions.isLondonNYOverlap && (
            <div className="relative overflow-hidden rounded-2xl p-6 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-cyan-500 to-blue-600 opacity-90"></div>
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
              <div className="relative flex items-center justify-between text-white">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-xs font-bold uppercase tracking-wider">Prime Time</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold mb-1">London × New York Overlap</div>
                  <div className="text-sm opacity-90 font-medium">Highest liquidity & volatility period</div>
                </div>
                <div className="text-right">
                  <div className="text-sm opacity-90 font-medium">Local Time</div>
                  <div className="text-2xl font-bold mt-1">
                    {sessions.currentTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Sessions */}
          {!sessions.isLondonNYOverlap && sessions.active.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {sessions.active.map(session => (
                <div key={session.name} className={`rounded-2xl bg-gradient-to-r ${session.color} p-6 shadow-xl`}>
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <div className="text-sm opacity-90 font-medium">Active Now</div>
                      </div>
                      <div className="text-3xl font-bold">{session.name} Session</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm opacity-90 font-medium">Local Time</div>
                      <div className="text-2xl font-bold mt-1">
                        {sessions.currentTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All Sessions Overview */}
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-neutral-400 mb-3 uppercase tracking-wider">All Sessions (UTC)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sessions.all?.map(session => (
                <div 
                  key={session.name}
                  className={`rounded-lg border-2 p-3 transition-all ${
                    session.active 
                      ? 'border-white bg-white/5' 
                      : 'border-neutral-700 bg-neutral-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-bold ${session.active ? 'text-white' : 'text-neutral-400'}`}>
                      {session.name}
                    </span>
                    {session.active && (
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <div className={`text-xs ${session.active ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    {String(session.start).padStart(2, '0')}:00 - {String(session.end).padStart(2, '0')}:00
                  </div>
                </div>
              ))}
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
                <span className="text-xl font-bold text-emerald-500">
                  +${Math.abs(stats?.avg_win || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-neutral-800">
                <span className="text-sm text-neutral-400 font-medium">Avg Loss</span>
                <span className="text-xl font-bold text-red-500">
                  ${(stats?.avg_loss || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-neutral-400 font-medium">Win/Loss Ratio</span>
                <span className="text-xl font-bold text-white">
                  {stats?.avg_loss && stats?.avg_loss !== 0
                    ? Math.abs((stats.avg_win / stats.avg_loss)).toFixed(2)
                    : '0.00'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">Best & Worst</h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-neutral-400 font-medium mb-3">Best Trade</div>
                {stats?.best_trade ? (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
                    <span className="text-sm font-bold text-white">{stats.best_trade.symbol}</span>
                    <span className="text-xl font-bold text-emerald-500">
                      +${stats.best_trade.pnl.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-neutral-500 p-4 border border-neutral-800 rounded-lg">No trades yet</div>
                )}
              </div>
              <div>
                <div className="text-sm text-neutral-400 font-medium mb-3">Worst Trade</div>
                {stats?.worst_trade ? (
                  <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                    <span className="text-sm font-bold text-white">{stats.worst_trade.symbol}</span>
                    <span className="text-xl font-bold text-red-500">
                      ${stats.worst_trade.pnl.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-neutral-500 p-4 border border-neutral-800 rounded-lg">No trades yet</div>
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