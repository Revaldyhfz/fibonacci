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

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  const fetchAnalytics = async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const headers = { Authorization: `Bearer ${tokens.access}` };
      
      const [overall, sessions, symbols] = await Promise.all([
        fetch("http://127.0.0.1:8000/analytics/stats/overall", { headers }).then(r => r.json()),
        fetch("http://127.0.0.1:8000/analytics/stats/session", { headers }).then(r => r.json()),
        fetch("http://127.0.0.1:8000/analytics/stats/symbol", { headers }).then(r => r.json())
      ]);

      setOverallStats(overall);
      setSessionStats(sessions);
      setSymbolStats(symbols);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-500">Loading analytics...</div>
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
                <Link to="/dashboard" className="text-sm text-neutral-600 hover:text-neutral-900">Dashboard</Link>
                <Link to="/trades" className="text-sm text-neutral-600 hover:text-neutral-900">Trades</Link>
                <Link to="/analytics" className="text-sm font-medium text-neutral-900">Analytics</Link>
              </nav>
            </div>
            <button onClick={() => { logout(); nav("/"); }} className="text-sm text-neutral-600 hover:text-neutral-900">Logout</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Analytics</h2>
          <div className="flex gap-2">
            {["day", "week", "month", "all"].map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  timeFilter === filter
                    ? "bg-black text-white"
                    : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {filter === "all" ? "All Time" : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Key Insights */}
        <div className="mb-6 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Key Insight</h3>
          <p className="text-sm opacity-90">
            {overallStats?.most_successful_session && 
              `Your most successful trading session is ${overallStats.most_successful_session}. Consider focusing more trades during this period.`
            }
          </p>
        </div>

        {/* Strategy Performance */}
        {overallStats?.strategy_performance && Object.keys(overallStats.strategy_performance).length > 0 && (
          <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">Strategy Performance</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(overallStats.strategy_performance).map(([name, stats]) => (
                <div key={name} className="rounded-lg border border-neutral-200 p-4">
                  <div className="font-medium mb-2">{name}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Win Rate:</span>
                      <span className="font-medium">{stats.winrate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Trades:</span>
                      <span className="font-medium">{stats.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Avg P&L:</span>
                      <span className={`font-medium ${stats.avg_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">Performance by Session</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(sessionStats).map(([session, stats]) => (
                <div key={session} className="rounded-lg border border-neutral-200 p-4">
                  <div className="font-medium mb-2">{session}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Trades:</span>
                      <span className="font-medium">{stats.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Win Rate:</span>
                      <span className="font-medium">{stats.winrate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Total P&L:</span>
                      <span className={`font-medium ${stats.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${stats.pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Symbol Performance */}
        {symbolStats && Object.keys(symbolStats).length > 0 && (
          <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">Performance by Symbol</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Symbol</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-neutral-600">Trades</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-neutral-600">Wins</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-neutral-600">Win Rate</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-neutral-600">Avg P&L</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-neutral-600">Total P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {Object.entries(symbolStats)
                    .sort((a, b) => b[1].pnl - a[1].pnl)
                    .map(([symbol, stats]) => (
                      <tr key={symbol} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 text-sm font-medium">{symbol}</td>
                        <td className="px-4 py-3 text-sm text-center">{stats.count}</td>
                        <td className="px-4 py-3 text-sm text-center">{stats.wins}</td>
                        <td className="px-4 py-3 text-sm text-center">{stats.winrate}%</td>
                        <td className={`px-4 py-3 text-sm text-right ${stats.avg_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${stats.avg_pnl}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${stats.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${stats.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Most Traded Symbol */}
        {overallStats?.most_traded_symbol && (
          <div className="rounded-lg border border-neutral-200 bg-white p-6">
            <h3 className="text-lg font-semibold mb-2">Most Traded Symbol</h3>
            <div className="text-3xl font-bold text-blue-600">{overallStats.most_traded_symbol}</div>
          </div>
        )}
      </main>
    </div>
  );
}