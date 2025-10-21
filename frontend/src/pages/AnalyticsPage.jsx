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
  const [hourlyStats, setHourlyStats] = useState(null);
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
      
      const [overallRes, sessionsRes, symbolsRes, hourlyRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/analytics/stats/overall", { headers }),
        fetch("http://127.0.0.1:8000/analytics/stats/session", { headers }),
        fetch("http://127.0.0.1:8000/analytics/stats/symbol", { headers }),
        fetch("http://127.0.0.1:8000/analytics/stats/hourly", { headers })
      ]);

      if (!overallRes.ok || !sessionsRes.ok || !symbolsRes.ok || !hourlyRes.ok) {
        throw new Error(`Failed to fetch analytics`);
      }

      const [overall, sessions, symbols, hourly] = await Promise.all([
        overallRes.json(),
        sessionsRes.json(),
        symbolsRes.json(),
        hourlyRes.json()
      ]);

      setOverallStats(overall);
      setSessionStats(sessions);
      setSymbolStats(symbols);
      setHourlyStats(hourly);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMetricColor = (value, thresholds) => {
    if (value >= thresholds.excellent) return 'text-emerald-500';
    if (value >= thresholds.good) return 'text-blue-500';
    if (value >= thresholds.acceptable) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getMetricDescription = (metric, value) => {
    const descriptions = {
      sharpe_ratio: {
        thresholds: { excellent: 2, good: 1, acceptable: 0 },
        desc: value >= 2 ? 'Excellent risk-adjusted returns' : 
              value >= 1 ? 'Good risk-adjusted returns' : 
              value >= 0 ? 'Acceptable returns' : 'Poor risk-adjusted returns'
      },
      sortino_ratio: {
        thresholds: { excellent: 2, good: 1, acceptable: 0 },
        desc: value >= 2 ? 'Excellent downside protection' : 
              value >= 1 ? 'Good downside protection' : 
              'Needs improvement'
      },
      profit_factor: {
        thresholds: { excellent: 2, good: 1.5, acceptable: 1.25 },
        desc: value >= 2 ? 'Strong profit generation' : 
              value >= 1.5 ? 'Good profit generation' : 
              value >= 1.25 ? 'Acceptable edge' : 'Insufficient edge'
      },
      calmar_ratio: {
        thresholds: { excellent: 3, good: 2, acceptable: 1 },
        desc: value >= 3 ? 'Excellent return vs drawdown' : 
              value >= 2 ? 'Good return vs drawdown' : 
              value >= 1 ? 'Acceptable' : 'High drawdown risk'
      }
    };
    return descriptions[metric] || { thresholds: { excellent: 1, good: 0.5, acceptable: 0 }, desc: '' };
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

  const advanced = overallStats?.advanced_metrics || {};

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
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Professional Analytics</h2>
            <p className="text-sm text-neutral-400">Risk-adjusted performance metrics</p>
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

        {/* Risk-Adjusted Performance Metrics */}
        <div className="mb-6 bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Risk-Adjusted Performance
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-[#0a0a0a]/50 backdrop-blur-sm border border-neutral-800 rounded-lg p-4">
              <div className="text-xs text-neutral-400 mb-1">Sharpe Ratio</div>
              <div className={`text-3xl font-bold mb-1 ${getMetricColor(advanced.sharpe_ratio, {excellent: 2, good: 1, acceptable: 0})}`}>
                {advanced.sharpe_ratio || '0.00'}
              </div>
              <div className="text-xs text-neutral-500">
                {getMetricDescription('sharpe_ratio', advanced.sharpe_ratio).desc}
              </div>
            </div>

            <div className="bg-[#0a0a0a]/50 backdrop-blur-sm border border-neutral-800 rounded-lg p-4">
              <div className="text-xs text-neutral-400 mb-1">Sortino Ratio</div>
              <div className={`text-3xl font-bold mb-1 ${getMetricColor(advanced.sortino_ratio, {excellent: 2, good: 1, acceptable: 0})}`}>
                {advanced.sortino_ratio || '0.00'}
              </div>
              <div className="text-xs text-neutral-500">
                {getMetricDescription('sortino_ratio', advanced.sortino_ratio).desc}
              </div>
            </div>

            <div className="bg-[#0a0a0a]/50 backdrop-blur-sm border border-neutral-800 rounded-lg p-4">
              <div className="text-xs text-neutral-400 mb-1">Profit Factor</div>
              <div className={`text-3xl font-bold mb-1 ${getMetricColor(advanced.profit_factor, {excellent: 2, good: 1.5, acceptable: 1.25})}`}>
                {advanced.profit_factor || '0.00'}
              </div>
              <div className="text-xs text-neutral-500">
                {getMetricDescription('profit_factor', advanced.profit_factor).desc}
              </div>
            </div>

            <div className="bg-[#0a0a0a]/50 backdrop-blur-sm border border-neutral-800 rounded-lg p-4">
              <div className="text-xs text-neutral-400 mb-1">Calmar Ratio</div>
              <div className={`text-3xl font-bold mb-1 ${getMetricColor(advanced.calmar_ratio, {excellent: 3, good: 2, acceptable: 1})}`}>
                {advanced.calmar_ratio || '0.00'}
              </div>
              <div className="text-xs text-neutral-500">
                {getMetricDescription('calmar_ratio', advanced.calmar_ratio).desc}
              </div>
            </div>
          </div>
        </div>

        {/* Drawdown & Risk Metrics */}
        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Drawdown Analysis</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Maximum Drawdown</div>
                  <div className="text-2xl font-bold text-red-500">${advanced.max_drawdown || '0.00'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-400 mb-1">Percentage</div>
                  <div className="text-2xl font-bold text-red-400">{advanced.max_drawdown_pct || '0.00'}%</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                <div className="text-sm text-neutral-300">Recovery Factor</div>
                <div className={`text-xl font-bold ${advanced.recovery_factor >= 3 ? 'text-emerald-500' : advanced.recovery_factor >= 2 ? 'text-blue-500' : 'text-yellow-500'}`}>
                  {advanced.recovery_factor || '0.00'}x
                </div>
              </div>
              <div className="text-xs text-neutral-500 p-3 bg-neutral-900/30 rounded-lg">
                💡 A 50% loss requires a 100% gain to recover. Keep drawdowns under 20% for optimal psychological management.
              </div>
            </div>
          </div>

          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Trade Expectancy</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Expectancy per Trade</div>
                  <div className={`text-2xl font-bold ${advanced.expectancy >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    ${advanced.expectancy || '0.00'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-400 mb-1">Avg R-Multiple</div>
                  <div className={`text-2xl font-bold ${advanced.avg_r_multiple >= 0.5 ? 'text-emerald-500' : 'text-yellow-500'}`}>
                    {advanced.avg_r_multiple || '0.00'}R
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                <div className="text-sm text-neutral-300">Win/Loss Ratio</div>
                <div className="text-xl font-bold text-blue-500">
                  {advanced.win_loss_ratio || '0.00'}:1
                </div>
              </div>
              <div className="text-xs text-neutral-500 p-3 bg-neutral-900/30 rounded-lg">
                💡 Positive expectancy is required for long-term profitability. Above 0.50 is strong.
              </div>
            </div>
          </div>
        </div>

        {/* Streak Analysis */}
        <div className="mb-6 bg-[#141414] border border-neutral-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Streak Analysis</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4">
              <div className="text-xs text-neutral-400 mb-2">Max Win Streak</div>
              <div className="text-3xl font-bold text-emerald-500 mb-1">{advanced.max_win_streak || 0}</div>
              <div className="text-xs text-neutral-500">consecutive wins</div>
            </div>
            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4">
              <div className="text-xs text-neutral-400 mb-2">Max Loss Streak</div>
              <div className="text-3xl font-bold text-red-500 mb-1">{advanced.max_loss_streak || 0}</div>
              <div className="text-xs text-neutral-500">consecutive losses</div>
            </div>
            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4">
              <div className="text-xs text-neutral-400 mb-2">Expected Loss Streak</div>
              <div className="text-3xl font-bold text-yellow-500 mb-1">{advanced.expected_loss_streak || 0}</div>
              <div className="text-xs text-neutral-500">probabilistic estimate</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-neutral-500 p-3 bg-neutral-900/30 rounded-lg">
            💡 With {overallStats.winrate_percent}% win rate, expect {Math.ceil(advanced.expected_loss_streak || 0)} consecutive losses eventually. Position sizing must survive this.
          </div>
        </div>

        {/* Strategy Performance */}
        {overallStats?.strategy_performance && Object.keys(overallStats.strategy_performance).length > 0 && (
          <div className="mb-6 bg-[#141414] border border-neutral-800 rounded-xl p-6">
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

        {/* Session Performance */}
        {sessionStats && Object.keys(sessionStats).length > 0 && (
          <div className="mb-6 bg-[#141414] border border-neutral-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Session Performance</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(sessionStats).map(([session, stats]) => (
                <div key={session} className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4 hover:border-neutral-700 transition-colors">
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

        {/* Symbol Performance */}
        {symbolStats && Object.keys(symbolStats).length > 0 && (
          <div className="bg-[#141414] border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-neutral-800">
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