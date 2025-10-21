import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    fetchStats();
    updateSessionInfo();
    const interval = setInterval(updateSessionInfo, 60000);
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

  const updateSessionInfo = () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    
    const sessions = {
      sydney: { start: 22, end: 7, name: 'Sydney' },
      tokyo: { start: 0, end: 9, name: 'Tokyo' },
      london: { start: 8, end: 17, name: 'London' },
      newYork: { start: 13, end: 22, name: 'New York' }
    };
    
    const timezones = {
      'America/New_York': 'New York',
      'Australia/Brisbane': 'Brisbane',
      'Asia/Jakarta': 'Jakarta',
      'Asia/Makassar': 'Bali'
    };
    
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const active = [];
    Object.entries(sessions).forEach(([key, session]) => {
      const isActive = session.start < session.end
        ? utcHour >= session.start && utcHour < session.end
        : utcHour >= session.start || utcHour < session.end;
      if (isActive) active.push(session.name);
    });
    
    const isOverlap = utcHour >= 13 && utcHour < 17;
    
    let nextEvent = null;
    if (isOverlap) {
      const endTime = new Date(now);
      endTime.setUTCHours(17, 0, 0, 0);
      nextEvent = {
        type: 'overlap_ends',
        time: endTime,
        message: 'Overlap ends'
      };
    } else if (utcHour >= 8 && utcHour < 13) {
      const startTime = new Date(now);
      startTime.setUTCHours(13, 0, 0, 0);
      nextEvent = {
        type: 'overlap_starts',
        time: startTime,
        message: 'NY opens - Overlap begins'
      };
    } else if (utcHour < 8) {
      const startTime = new Date(now);
      startTime.setUTCHours(8, 0, 0, 0);
      nextEvent = {
        type: 'london_opens',
        time: startTime,
        message: 'London opens'
      };
    } else if (utcHour >= 17 && utcHour < 22) {
      const endTime = new Date(now);
      endTime.setUTCHours(22, 0, 0, 0);
      nextEvent = {
        type: 'ny_closes',
        time: endTime,
        message: 'New York closes'
      };
    }
    
    let timeRemaining = '';
    if (nextEvent) {
      const diff = nextEvent.time - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      timeRemaining = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    
    setSessionInfo({
      currentSession: active[0] || 'No active session',
      activeSessions: active,
      isOverlap,
      nextEvent,
      timeRemaining,
      localTime: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: userTz
      }),
      localDate: now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: userTz
      }),
      userLocation: timezones[userTz] || 'UTC',
      utcTime: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      })
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
    <div className="min-h-screen bg-[#0a0a0a] pb-8">
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-[#141414]/95 backdrop-blur-sm shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Trading Journal
              </h1>
              <nav className="hidden md:flex gap-6">
                <Link to="/dashboard" className="text-sm font-medium text-white">Dashboard</Link>
                <Link to="/trades" className="text-sm text-neutral-400 hover:text-white transition-colors">Trades</Link>
                <Link to="/analytics" className="text-sm text-neutral-400 hover:text-white transition-colors">Analytics</Link>
                <Link to="/portfolio" className="text-sm text-neutral-400 hover:text-white transition-colors">Portfolio</Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-neutral-400">
                <span className="hidden sm:inline">Welcome, </span>
                <span className="font-medium text-white">{user?.username || 'Trader'}</span>
              </div>
              <button 
                onClick={() => { logout(); nav("/"); }} 
                className="text-sm px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {sessionInfo && (
          <div className="my-6">
            {sessionInfo.isOverlap ? (
              <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-cyan-500 to-blue-600 opacity-90"></div>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full">
                        <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold uppercase tracking-wider">Prime Time Active</span>
                      </div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-bold mb-2">London × New York Overlap</div>
                    <div className="text-sm sm:text-base opacity-90 font-medium mb-1">
                      Highest liquidity & volatility period
                    </div>
                    {sessionInfo.nextEvent && (
                      <div className="text-sm opacity-80">
                        {sessionInfo.nextEvent.message} in {sessionInfo.timeRemaining}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm opacity-90 font-medium mb-1">Your Time ({sessionInfo.userLocation})</div>
                    <div className="text-3xl sm:text-4xl font-bold mb-1">{sessionInfo.localTime}</div>
                    <div className="text-sm opacity-80">{sessionInfo.localDate}</div>
                    <div className="text-xs opacity-70 mt-2">UTC: {sessionInfo.utcTime}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl p-6 sm:p-8 shadow-xl ${
                sessionInfo.currentSession === 'London' 
                  ? 'bg-gradient-to-r from-green-500 to-green-600' 
                  : sessionInfo.currentSession === 'New York'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                  : sessionInfo.currentSession === 'Tokyo'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600'
                  : sessionInfo.currentSession === 'Sydney'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                  : 'bg-gradient-to-r from-neutral-700 to-neutral-800'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                      <div className="text-sm opacity-90 font-medium">
                        {sessionInfo.currentSession === 'No active session' ? 'Market Closed' : 'Active Now'}
                      </div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-bold mb-2">
                      {sessionInfo.currentSession === 'No active session' 
                        ? 'No Active Trading Session' 
                        : `${sessionInfo.currentSession} Session`}
                    </div>
                    {sessionInfo.nextEvent && (
                      <div className="text-sm sm:text-base opacity-90 font-medium">
                        {sessionInfo.nextEvent.message} in {sessionInfo.timeRemaining}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm opacity-90 font-medium mb-1">Your Time ({sessionInfo.userLocation})</div>
                    <div className="text-3xl sm:text-4xl font-bold mb-1">{sessionInfo.localTime}</div>
                    <div className="text-sm opacity-80">{sessionInfo.localDate}</div>
                    <div className="text-xs opacity-70 mt-2">UTC: {sessionInfo.utcTime}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
            <div className="text-xs text-neutral-400 font-medium mb-1">Total Trades</div>
            <div className="text-3xl font-bold text-white">{stats?.total_trades || 0}</div>
          </div>
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
            <div className="text-xs text-neutral-400 font-medium mb-1">Win Rate</div>
            <div className="text-3xl font-bold text-emerald-500">{stats?.winrate_percent || 0}%</div>
          </div>
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
            <div className="text-xs text-neutral-400 font-medium mb-1">Total P&L</div>
            <div className={`text-3xl font-bold ${stats?.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              ${stats?.total_pnl?.toFixed(2) || '0.00'}
            </div>
          </div>
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
            <div className="text-xs text-neutral-400 font-medium mb-1">Winning Trades</div>
            <div className="text-3xl font-bold text-emerald-500">{stats?.wins || 0}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
            <h2 className="text-base font-bold text-white mb-4">Average Performance</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-neutral-800">
                <span className="text-xs text-neutral-400 font-medium">Avg Win</span>
                <span className="text-lg font-bold text-emerald-500">
                  +${Math.abs(stats?.avg_win || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-neutral-800">
                <span className="text-xs text-neutral-400 font-medium">Avg Loss</span>
                <span className="text-lg font-bold text-red-500">
                  ${(stats?.avg_loss || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-neutral-400 font-medium">W/L Ratio</span>
                <span className="text-lg font-bold text-white">
                  {stats?.avg_loss && stats?.avg_loss !== 0
                    ? Math.abs((stats.avg_win / stats.avg_loss)).toFixed(2)
                    : '0.00'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
            <h2 className="text-base font-bold text-white mb-4">Best & Worst</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-neutral-400 font-medium mb-2">Best Trade</div>
                {stats?.best_trade ? (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                    <span className="text-sm font-bold text-white">{stats.best_trade.symbol}</span>
                    <span className="text-lg font-bold text-emerald-500">
                      +${stats.best_trade.pnl.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 p-3 border border-neutral-800 rounded-lg">No trades yet</div>
                )}
              </div>
              <div>
                <div className="text-xs text-neutral-400 font-medium mb-2">Worst Trade</div>
                {stats?.worst_trade ? (
                  <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                    <span className="text-sm font-bold text-white">{stats.worst_trade.symbol}</span>
                    <span className="text-lg font-bold text-red-500">
                      ${stats.worst_trade.pnl.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 p-3 border border-neutral-800 rounded-lg">No trades yet</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/30 rounded-xl p-4 flex flex-col justify-center">
            <h2 className="text-base font-bold text-white mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link 
                to="/trades" 
                className="block w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all text-center"
              >
                📅 Trades Calendar
              </Link>
              <Link 
                to="/analytics" 
                className="block w-full px-4 py-3 bg-[#141414] border border-neutral-700 hover:border-neutral-600 text-white text-sm font-medium rounded-lg transition-colors text-center"
              >
                📊 Analytics
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}