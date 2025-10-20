import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AnalyticsPage() {
  const { logout } = useAuth();
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
      
      console.log("Fetching analytics data...");
      
      // Fetch all endpoints
      const [overallRes, sessionsRes, symbolsRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/analytics/stats/overall", { headers }),
        fetch("http://127.0.0.1:8000/analytics/stats/session", { headers }),
        fetch("http://127.0.0.1:8000/analytics/stats/symbol", { headers })
      ]);

      console.log("Response statuses:", {
        overall: overallRes.status,
        sessions: sessionsRes.status,
        symbols: symbolsRes.status
      });

      // Check if all responses are ok
      if (!overallRes.ok || !sessionsRes.ok || !symbolsRes.ok) {
        throw new Error(`Failed to fetch analytics: Overall(${overallRes.status}), Sessions(${sessionsRes.status}), Symbols(${symbolsRes.status})`);
      }

      const [overall, sessions, symbols] = await Promise.all([
        overallRes.json(),
        sessionsRes.json(),
        symbolsRes.json()
      ]);

      console.log("Analytics data received:", { overall, sessions, symbols });

      setOverallStats(overall);
      setSessionStats(sessions);
      setSymbolStats(symbols);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
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
          <div className="space-y-2 text-sm text-neutral-400 mb-6">
            <p>Troubleshooting steps:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Make sure the analytics service is running on port 8001</li>
              <li>Check if you have trades in your database</li>
              <li>Verify your authentication token is valid</li>
            </ol>
          </div>
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
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have no data
  const hasNoData = !overallStats?.total_trades || overallStats.total_trades === 0;

  if (hasNoData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="border-b border-neutral-800 bg-[#141414]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-8">
                <h1 className="text-xl font-bold text-white">Trading Journal</h1>
                <nav className="hidden md:flex gap-6">
                  <Link to="/dashboard" className="text-sm text-neutral-400 hover:text-white transition-colors">Dashboard</Link>
                  <Link to="/trades" className="text-sm text-neutral-400 hover:text-white transition-colors">Trades</Link>
                  <Link to="/analytics" className="text-sm font-medium text-white">Analytics</Link>
                </nav>
              </div>
              <button onClick={() => { logout(); nav("/"); }} className="text-sm text-neutral-400 hover:text-white transition-colors">
                Logout
              </button>
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
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-[#141414]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-white">Trading Journal</h1>
              <nav className="hidden md:flex gap-6">
                <Link to="/dashboard" className="text-sm text-neutral-400 hover:text-white transition-colors">Dashboard</Link>
                <Link to="/trades" className="text-sm text-neutral-400 hover:text-white transition-colors">Trades</Link>
                <Link to="/analytics" className="text-sm font-medium text-white">Analytics</Link>
              </nav>
            </div>
            <button onClick={() => { logout(); nav("/"); }} className="text-sm text-neutral-400 hover:text-white transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header with Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Advanced Analytics</h2>
            <p className="text-neutral-400">Deep insights into your trading performance</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["day", "week", "month", "all"].map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeFilter === filter
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-[#141414] border border-neutral-700 text-neutral-300 hover:border-neutral-600"
                }`}
              >
                {filter === "all" ? "All Time" : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Key Insight Banner */}
        {overallStats?.most_successful_session && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-500/30 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Key Insight</h3>
                <p className="text-neutral-300">
                  Your most successful trading session is {overallStats.most_successful_session}. Consider focusing more trades during this period for optimal results.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Performance */}
        {overallStats?.strategy_performance && Object.keys(overallStats.strategy_performance).length > 0 && (
          <div className="mb-8 bg-[#141414] border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-6">Strategy Performance</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(overallStats.strategy_performance).map(([name, stats]) => (
                <div key={name} className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors">
                  <div className="font-bold text-lg text-white mb-4">{name}</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Win Rate</span>
                      <span className="text-lg font-bold text-emerald-500">{stats.winrate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Total Trades</span>
                      <span className="text-lg font-bold text-white">{stats.count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Avg P&L</span>
                      <span className={`text-lg font-bold ${stats.avg_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        ${stats.avg_pnl}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Analysis */}
        {sessionStats && Object.keys(sessionStats).length > 0 && (
          <div className="mb-8 bg-[#141414] border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-6">Performance by Trading Session</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(sessionStats).map(([session, stats]) => (
                <div key={session} className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors">
                  <div className="font-bold text-lg text-white mb-4">{session}</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Trades</span>
                      <span className="text-lg font-bold text-white">{stats.count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Win Rate</span>
                      <span className="text-lg font-bold text-emerald-500">{stats.winrate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Total P&L</span>
                      <span className={`text-lg font-bold ${stats.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        ${stats.pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Symbol Performance Table */}
        {symbolStats && Object.keys(symbolStats).length > 0 && (
          <div className="mb-8 bg-[#141414] border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-neutral-800">
              <h3 className="text-xl font-bold text-white">Performance by Symbol</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0a0a0a]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Symbol</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-400 uppercase tracking-wider">Trades</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-400 uppercase tracking-wider">Wins</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-400 uppercase tracking-wider">Win Rate</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Avg P&L</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Total P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {Object.entries(symbolStats)
                    .sort((a, b) => b[1].pnl - a[1].pnl)
                    .map(([symbol, stats]) => (
                      <tr key={symbol} className="hover:bg-[#0a0a0a] transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-white">{symbol}</td>
                        <td className="px-6 py-4 text-sm text-center text-neutral-300">{stats.count}</td>
                        <td className="px-6 py-4 text-sm text-center text-neutral-300">{stats.wins}</td>
                        <td className="px-6 py-4 text-sm text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                            {stats.winrate}%
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-medium ${stats.avg_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          ${stats.avg_pnl}
                        </td>
                        <td className={`px-6 py-4 text-sm text-right font-bold ${stats.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          ${stats.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Most Traded Symbol Card */}
        {overallStats?.most_traded_symbol && (
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/30 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-neutral-300 mb-2">Most Traded Symbol</h3>
            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              {overallStats.most_traded_symbol}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}