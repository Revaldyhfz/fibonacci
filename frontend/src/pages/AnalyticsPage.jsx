import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AnalyticsPage() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const [timeFilter, setTimeFilter] = useState("all");
  const [overallStats, setOverallStats] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [symbolStats, setSymbolStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens || !tokens.access) {
        throw new Error("No authentication token found");
      }

      const headers = { Authorization: `Bearer ${tokens.access}` };
      
      const [overallRes, sessionsRes, symbolsRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/analytics/stats/overall", { headers }),
        fetch("http://127.0.0.1:8000/analytics/stats/session", { headers }),
        fetch("http://127.0.0.1:8000/analytics/stats/symbol", { headers })
      ]);

      if (!overallRes.ok || !sessionsRes.ok || !symbolsRes.ok) {
        throw new Error(`Failed to fetch analytics`);
      }

      const [overall, sessions, symbols] = await Promise.all([
        overallRes.json(),
        sessionsRes.json(),
        symbolsRes.json()
      ]);

      // Filter by time period
      let filteredData = { overall, sessions, symbols };
      if (timeFilter !== "all") {
        filteredData = filterByTimePeriod(overall, sessions, symbols, timeFilter);
      }

      setOverallStats(filteredData.overall);
      setSessionStats(filteredData.sessions);
      setSymbolStats(filteredData.symbols);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterByTimePeriod = (overall, sessions, symbols, period) => {
    // This is a simplified version - you'd need to fetch filtered data from backend
    // For now, just return the same data
    return { overall, sessions, symbols };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-neutral-600 border-t-blue-500 mb-4"></div>
          <div className="text-neutral-400">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="bg-[#141414] border border-red-500/30 rounded-xl p-8 max-w-md">
          <div className="text-red-500 text-xl font-bold mb-4">⚠️ Analytics Error</div>
          <p className="text-neutral-300 mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={fetchAnalytics}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => nav("/dashboard")}
              className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasNoData = !overallStats?.total_trades || overallStats.total_trades === 0;

  if (hasNoData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="sticky top-0 z-50 border-b border-neutral-800 bg-[#141414]/95 backdrop-blur-sm shadow-lg">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-8">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Trading Journal
                </h1>
                <nav className="hidden md:flex gap-6">
                  <Link to="/dashboard" className="text-sm text-neutral-400 hover:text-white transition-colors">Dashboard</Link>
                  <Link to="/trades" className="text-sm text-neutral-400 hover:text-white transition-colors">Trades</Link>
                  <Link to="/analytics" className="text-sm font-medium text-white">Analytics</Link>
                </nav>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-neutral-400">
                  <span className="hidden sm:inline">Welcome, </span>
                  <span className="font-medium text-white">{user?.username || 'Trader'}</span>
                </div>
                <button onClick={() => { logout(); nav("/"); }} className="text-sm px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>
        
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Trading Data Yet</h2>
            <p className="text-neutral-400 mb-6 text-center max-w-md">
              Start adding trades to see detailed analytics and insights about your trading performance.
            </p>
            <Link
              to="/trades"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all"
            >
              Add Your First Trade
            </Link>
          </div>
        </main>
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
                <Link to="/dashboard" className="text-sm text-neutral-400 hover:text-white transition-colors">Dashboard</Link>
                <Link to="/trades" className="text-sm text-neutral-400 hover:text-white transition-colors">Trades</Link>
                <Link to="/analytics" className="text-sm font-medium text-white">Analytics</Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-neutral-400">
                <span className="hidden sm:inline">Welcome, </span>
                <span className="font-medium text-white">{user?.username || 'Trader'}</span>
              </div>
              <button onClick={() => { logout(); nav("/"); }} className="text-sm px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between my-6 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Advanced Analytics</h2>
            <p className="text-sm text-neutral-400">Deep insights into your trading performance</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["day", "week", "month", "all"].map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  timeFilter === filter
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-[#141414] border border-neutral-700 text-neutral-300 hover:border-neutral-600"
                }`}
              >
                {filter === "all" ? "All Time" : filter === "day" ? "Today" : filter === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
        </div>

        {overallStats?.most_successful_session && (
          <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-500/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Key Insight</h3>
                <p className="text-sm text-neutral-300">
                  Your most successful trading session is {overallStats.most_successful_session}. Consider focusing more trades during this period.
                </p>
              </div>
            </div>
          </div>
        )}

        {overallStats?.strategy_performance && Object.keys(overallStats.strategy_performance).length > 0 && (
          <div className="mb-6 bg-[#141414] border border-neutral-800 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-4">Strategy Performance</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(overallStats.strategy_performance).map(([name, stats]) => (
                <div key={name} className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4 hover:border-neutral-700 transition-colors">
                  <div className="font-bold text-base text-white mb-3">{name}</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">Win Rate</span>
                      <span className="text-base font-bold text-emerald-500">{stats.winrate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">Trades</span>
                      <span className="text-base font-bold text-white">{stats.count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">Avg P&L</span>
                      <span className={`text-base font-bold ${stats.avg_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        ${stats.avg_pnl}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          {sessionStats && Object.keys(sessionStats).length > 0 && (
            <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-4">Performance by Session</h3>
              <div className="space-y-3">
                {Object.entries(sessionStats).map(([session, stats]) => (
                  <div key={session} className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-3 hover:border-neutral-700 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-base text-white">{session}</div>
                      <div className="text-xs text-neutral-400">{stats.count} trades</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-xs text-neutral-400 mb-1">Win Rate</div>
                        <div className="text-base font-bold text-emerald-500">{stats.winrate}%</div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-neutral-400 mb-1">Total P&L</div>
                        <div className={`text-base font-bold ${stats.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          ${stats.pnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {overallStats?.most_traded_symbol && (
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/30 rounded-xl p-4 flex flex-col justify-center">
              <h3 className="text-base font-semibold text-neutral-300 mb-2">Most Traded Symbol</h3>
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
                {overallStats.most_traded_symbol}
              </div>
              <div className="text-sm text-neutral-400">
                Focus symbol for {timeFilter === "all" ? "all time" : timeFilter === "day" ? "today" : `this ${timeFilter}`}
              </div>
            </div>
          )}
        </div>

        {symbolStats && Object.keys(symbolStats).length > 0 && (
          <div className="bg-[#141414] border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-neutral-800">
              <h3 className="text-lg font-bold text-white">Performance by Symbol</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0a0a0a]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase">Symbol</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase">Trades</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase">Wins</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase">Win Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase">Avg P&L</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase">Total P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {Object.entries(symbolStats)
                    .sort((a, b) => b[1].pnl - a[1].pnl)
                    .map(([symbol, stats]) => (
                      <tr key={symbol} className="hover:bg-[#0a0a0a] transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-white">{symbol}</td>
                        <td className="px-4 py-3 text-sm text-center text-neutral-300">{stats.count}</td>
                        <td className="px-4 py-3 text-sm text-center text-neutral-300">{stats.wins}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                            {stats.winrate}%
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${stats.avg_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          ${stats.avg_pnl}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${stats.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          ${stats.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}