import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/layout/Header";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";

const FILTERS = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

function metricColor(value, { excellent, good, acceptable }) {
  if (value == null || Number.isNaN(Number(value))) return "text-neutral-400";
  const n = Number(value);
  if (n >= excellent) return "text-emerald-400";
  if (n >= good) return "text-blue-400";
  if (n >= acceptable) return "text-yellow-400";
  return "text-red-400";
}

const METRIC_HINTS = {
  sharpe_ratio: (v) =>
    v === 0
      ? "Need more trades for calculation"
      : v >= 2
        ? "Excellent risk-adjusted returns"
        : v >= 1
          ? "Good risk-adjusted returns"
          : v >= 0
            ? "Acceptable returns"
            : "Poor risk-adjusted returns",
  sortino_ratio: (v) =>
    v === 0
      ? "Need more trades for calculation"
      : v >= 2
        ? "Excellent downside protection"
        : v >= 1
          ? "Good downside protection"
          : "Needs improvement",
  profit_factor: (v) =>
    v === 0
      ? "No winning or losing trades yet"
      : v >= 2
        ? "Strong profit generation"
        : v >= 1.5
          ? "Good profit generation"
          : v >= 1.25
            ? "Acceptable edge"
            : "Insufficient edge",
  calmar_ratio: (v) =>
    v === 0
      ? "Need drawdown data for calculation"
      : v >= 3
        ? "Excellent return vs drawdown"
        : v >= 2
          ? "Good return vs drawdown"
          : v >= 1
            ? "Acceptable"
            : "High drawdown risk",
};

function authedFetch(url, token) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

export default function AnalyticsPage() {
  const nav = useNavigate();
  const [timeFilter, setTimeFilter] = useState("all");
  const [overallStats, setOverallStats] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [symbolStats, setSymbolStats] = useState(null);
  const [hourlyStats, setHourlyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens") || "null");
      if (!tokens?.access) throw new Error("Not authenticated");
      const qs = `?time_filter=${timeFilter}`;
      const [o, s, y, h] = await Promise.all([
        authedFetch(`/analytics/stats/overall${qs}`, tokens.access),
        authedFetch(`/analytics/stats/session${qs}`, tokens.access),
        authedFetch(`/analytics/stats/symbol${qs}`, tokens.access),
        authedFetch(`/analytics/stats/hourly${qs}`, tokens.access),
      ]);
      if (!o.ok || !s.ok || !y.ok || !h.ok) {
        throw new Error("Failed to fetch analytics");
      }
      const [overall, sessions, symbols, hourly] = await Promise.all([
        o.json(),
        s.json(),
        y.json(),
        h.json(),
      ]);
      setOverallStats(overall);
      setSessionStats(sessions);
      setSymbolStats(symbols);
      setHourlyStats(hourly);
    } catch (err) {
      setError(err.message || "Analytics error");
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const advanced = overallStats?.advanced_metrics || {};
  const meta = overallStats?._meta || {};
  const hasData = !!overallStats?.total_trades && overallStats.total_trades > 0;

  // Compact "need N more trades" message used when a metric hasn't hit its
  // minimum sample size. Keeps users from acting on noisy early numbers.
  const shortfallText = (key) => {
    const m = meta[key];
    if (!m || m.sufficient) return null;
    return `Need ${m.shortfall} more trade${m.shortfall === 1 ? "" : "s"} (${m.actual}/${m.required})`;
  };

  const hourlyBins = useMemo(() => {
    if (!hourlyStats) return [];
    const bins = new Array(24).fill(null).map((_, hour) => ({
      hour,
      count: 0,
      pnl: 0,
      winrate: 0,
    }));
    for (const [hourKey, stats] of Object.entries(hourlyStats)) {
      const h = parseInt(hourKey, 10);
      if (Number.isNaN(h) || h < 0 || h > 23) continue;
      bins[h] = {
        hour: h,
        count: stats.count ?? 0,
        pnl: Number(stats.pnl ?? 0),
        winrate: Number(stats.winrate ?? 0),
      };
    }
    return bins;
  }, [hourlyStats]);

  const maxAbsPnl = useMemo(
    () => Math.max(1, ...hourlyBins.map((b) => Math.abs(b.pnl))),
    [hourlyBins]
  );

  const emptyState = (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-white mb-2">No Trading Data Yet</h2>
        <p className="text-neutral-400 mb-6">
          Start adding trades to see professional analytics.
        </p>
        <Link to="/trades">
          <Button>Add your first trade</Button>
        </Link>
      </main>
    </div>
  );

  const errorState = (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-16">
        <Card title="Analytics Error" subtitle="Something went wrong">
          <p className="text-neutral-300 mb-4 text-sm">{error}</p>
          <div className="flex gap-2">
            <Button onClick={fetchAnalytics}>Retry</Button>
            <Button variant="secondary" onClick={() => nav("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-16">
          <Spinner label="Loading analytics…" />
        </main>
      </div>
    );
  }
  if (error) return errorState;
  if (!hasData) return emptyState;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-12">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              Professional Analytics
            </h1>
            <p className="text-sm text-neutral-400">
              Risk-adjusted performance metrics
              {timeFilter !== "all" &&
                ` · ${FILTERS.find((f) => f.value === timeFilter)?.label}`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTimeFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  timeFilter === f.value
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-[#141414] border border-neutral-700 text-neutral-300 hover:border-neutral-600"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {overallStats.total_trades < 20 && (
          <Card className="mb-6 bg-yellow-500/5 border-yellow-500/30">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-yellow-300 mb-1">
                  Limited sample — metrics gated below
                </div>
                <div className="text-xs text-neutral-300">
                  You have {overallStats.total_trades} trade
                  {overallStats.total_trades !== 1 ? "s" : ""}. Each metric unlocks
                  once it has enough samples to be statistically meaningful
                  (win rate & Sharpe 20, Profit Factor 30, streaks 15).
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card
          title="Risk-Adjusted Performance"
          className="mb-6 bg-gradient-to-br from-blue-500/10 to-purple-600/10 border-blue-500/30"
        >
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[
              { key: "sharpe_ratio", label: "Sharpe Ratio", thresholds: { excellent: 2, good: 1, acceptable: 0 } },
              { key: "sortino_ratio", label: "Sortino Ratio", thresholds: { excellent: 2, good: 1, acceptable: 0 } },
              { key: "profit_factor", label: "Profit Factor", thresholds: { excellent: 2, good: 1.5, acceptable: 1.25 } },
              { key: "calmar_ratio", label: "Calmar Ratio", thresholds: { excellent: 3, good: 2, acceptable: 1 } },
            ].map((m) => {
              const value = Number(advanced[m.key] || 0);
              const shortfall = shortfallText(m.key);
              return (
                <div
                  key={m.key}
                  className="bg-[#0a0a0a]/70 border border-neutral-800 rounded-lg p-4"
                >
                  <div className="text-xs text-neutral-400 mb-1">{m.label}</div>
                  {shortfall ? (
                    <>
                      <div className="text-2xl sm:text-3xl font-bold mb-1 tabular-nums text-neutral-600">
                        —
                      </div>
                      <div className="text-xs text-yellow-500/80 leading-snug">
                        {shortfall}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`text-2xl sm:text-3xl font-bold mb-1 tabular-nums ${metricColor(value, m.thresholds)}`}>
                        {value.toFixed(2)}
                      </div>
                      <div className="text-xs text-neutral-500 leading-snug">
                        {METRIC_HINTS[m.key](value)}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          <Card title="Drawdown Analysis">
            {shortfallText("max_drawdown") ? (
              <div className="p-6 text-center text-sm text-neutral-400">
                <div className="text-3xl mb-2 opacity-50">📉</div>
                {shortfallText("max_drawdown")}
                <div className="text-xs text-neutral-500 mt-1">
                  Drawdown stats need at least 10 closed trades.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                  <div>
                    <div className="text-xs text-neutral-400 mb-1">Maximum Drawdown</div>
                    <div className="text-xl sm:text-2xl font-bold text-red-400 tabular-nums">
                      ${advanced.max_drawdown || "0.00"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-neutral-400 mb-1">Percentage</div>
                    <div className="text-xl sm:text-2xl font-bold text-red-400 tabular-nums">
                      {advanced.max_drawdown_pct || "0.00"}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                  <div className="text-sm text-neutral-300">Recovery Factor</div>
                  <div
                    className={`text-lg sm:text-xl font-bold tabular-nums ${
                      advanced.recovery_factor >= 3
                        ? "text-emerald-400"
                        : advanced.recovery_factor >= 2
                          ? "text-blue-400"
                          : "text-yellow-400"
                    }`}
                  >
                    {advanced.recovery_factor || "0.00"}x
                  </div>
                </div>
                <p className="text-xs text-neutral-500 p-3 bg-neutral-900/30 rounded-lg">
                  A 50% loss requires a 100% gain to recover. Keep drawdowns under
                  20% for optimal psychological management.
                </p>
              </div>
            )}
          </Card>

          <Card title="Trade Expectancy">
            {shortfallText("expectancy") ? (
              <div className="p-6 text-center text-sm text-neutral-400">
                <div className="text-3xl mb-2 opacity-50">🎯</div>
                {shortfallText("expectancy")}
                <div className="text-xs text-neutral-500 mt-1">
                  Expectancy stabilises after ~20 trades.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                  <div>
                    <div className="text-xs text-neutral-400 mb-1">Expectancy per Trade</div>
                    <div className={`text-xl sm:text-2xl font-bold tabular-nums ${advanced.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${advanced.expectancy || "0.00"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-neutral-400 mb-1">Avg R-Multiple</div>
                    <div className={`text-xl sm:text-2xl font-bold tabular-nums ${advanced.avg_r_multiple >= 0.5 ? "text-emerald-400" : "text-yellow-400"}`}>
                      {advanced.avg_r_multiple || "0.00"}R
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                  <div className="text-sm text-neutral-300">Win/Loss Ratio</div>
                  <div className="text-lg sm:text-xl font-bold text-blue-400 tabular-nums">
                    {advanced.win_loss_ratio || "0.00"}:1
                  </div>
                </div>
                <p className="text-xs text-neutral-500 p-3 bg-neutral-900/30 rounded-lg">
                  Positive expectancy is required for long-term profitability.
                  Above 0.50 is strong.
                </p>
              </div>
            )}
          </Card>
        </div>

        <Card title="Streak Analysis" className="mb-6">
          {shortfallText("streaks") ? (
            <div className="p-6 text-center text-sm text-neutral-400">
              <div className="text-3xl mb-2 opacity-50">🔥</div>
              {shortfallText("streaks")}
              <div className="text-xs text-neutral-500 mt-1">
                Streak patterns are noisy below 15 trades.
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4">
                  <div className="text-xs text-neutral-400 mb-2">Max Win Streak</div>
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-400 mb-1 tabular-nums">
                    {advanced.max_win_streak || 0}
                  </div>
                  <div className="text-xs text-neutral-500">consecutive wins</div>
                </div>
                <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4">
                  <div className="text-xs text-neutral-400 mb-2">Max Loss Streak</div>
                  <div className="text-2xl sm:text-3xl font-bold text-red-400 mb-1 tabular-nums">
                    {advanced.max_loss_streak || 0}
                  </div>
                  <div className="text-xs text-neutral-500">consecutive losses</div>
                </div>
                <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4">
                  <div className="text-xs text-neutral-400 mb-2">Expected Loss Streak</div>
                  <div className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-1 tabular-nums">
                    {advanced.expected_loss_streak || 0}
                  </div>
                  <div className="text-xs text-neutral-500">probabilistic estimate</div>
                </div>
              </div>
              <p className="mt-4 text-xs text-neutral-500 p-3 bg-neutral-900/30 rounded-lg">
                With {overallStats.winrate_percent}% win rate, expect ~
                {Math.ceil(advanced.expected_loss_streak || 0)} consecutive losses
                eventually. Size positions to survive this.
              </p>
            </>
          )}
        </Card>

        {hourlyBins.some((b) => b.count > 0) && (
          <Card title="Hourly Performance" subtitle="P&L by hour of day (UTC)" className="mb-6">
            <div className="grid grid-cols-12 sm:grid-cols-24 gap-1">
              {hourlyBins.map((b) => {
                const intensity = Math.min(1, Math.abs(b.pnl) / maxAbsPnl);
                const bg =
                  b.count === 0
                    ? "bg-neutral-900/40"
                    : b.pnl >= 0
                      ? "bg-emerald-500"
                      : "bg-red-500";
                const opacity = b.count === 0 ? 1 : 0.15 + intensity * 0.85;
                const label = b.count
                  ? `${b.count} trade${b.count !== 1 ? "s" : ""} · ${b.pnl >= 0 ? "+" : "-"}$${Math.abs(b.pnl).toFixed(2)} · ${b.winrate}%`
                  : "no trades";
                return (
                  <div
                    key={b.hour}
                    title={`${String(b.hour).padStart(2, "0")}:00 — ${label}`}
                    className={`aspect-square rounded ${bg} flex flex-col items-center justify-center`}
                    style={{ opacity }}
                  >
                    <span className="text-[9px] sm:text-[10px] font-semibold text-white/90 tabular-nums">
                      {String(b.hour).padStart(2, "0")}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-neutral-400">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-500" /> Profit
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-500" /> Loss
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-neutral-900/70 border border-neutral-700" />{" "}
                No trades
              </span>
            </div>
          </Card>
        )}

        {overallStats?.strategy_performance &&
          Object.keys(overallStats.strategy_performance).length > 0 && (
            <Card title="Strategy Performance" className="mb-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(overallStats.strategy_performance).map(([name, stats]) => {
                  const insufficient = stats.sufficient === false;
                  const shortfall = insufficient
                    ? `${stats.count}/${stats.required} trades`
                    : null;
                  return (
                    <div
                      key={name}
                      className={`bg-[#0a0a0a] border rounded-lg p-4 ${insufficient ? "border-neutral-900 opacity-60" : "border-neutral-800"}`}
                    >
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="font-bold text-base text-white truncate">{name}</div>
                        {insufficient && (
                          <span className="text-[10px] uppercase tracking-wider text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded px-1.5 py-0.5 shrink-0">
                            {shortfall}
                          </span>
                        )}
                      </div>
                      <dl className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <dt className="text-xs text-neutral-400">Win Rate</dt>
                          <dd className={`font-bold tabular-nums ${insufficient ? "text-neutral-500" : "text-emerald-400"}`}>
                            {insufficient ? "—" : `${stats.winrate}%`}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <dt className="text-xs text-neutral-400">Trades</dt>
                          <dd className="font-bold text-white tabular-nums">{stats.count}</dd>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <dt className="text-xs text-neutral-400">Avg P&L</dt>
                          <dd className={`font-bold tabular-nums ${insufficient ? "text-neutral-500" : stats.avg_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {insufficient ? "—" : `$${stats.avg_pnl}`}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

        {sessionStats && Object.keys(sessionStats).length > 0 && (
          <Card title="Session Performance" className="mb-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(sessionStats).map(([session, stats]) => {
                const insufficient = stats.sufficient === false;
                return (
                  <div
                    key={session}
                    className={`bg-[#0a0a0a] border rounded-lg p-4 ${insufficient ? "border-neutral-900 opacity-60" : "border-neutral-800"}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-base text-white">{session}</div>
                      <div className="flex items-center gap-2">
                        {insufficient && (
                          <span className="text-[10px] uppercase tracking-wider text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded px-1.5 py-0.5">
                            low sample
                          </span>
                        )}
                        <div className="text-xs text-neutral-400">{stats.count} trades</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div>
                        <div className="text-xs text-neutral-400 mb-1">Win Rate</div>
                        <div className={`text-base font-bold tabular-nums ${insufficient ? "text-neutral-500" : "text-emerald-400"}`}>
                          {insufficient ? "—" : `${stats.winrate}%`}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-400 mb-1">Total P&L</div>
                        <div
                          className={`text-base font-bold tabular-nums ${
                            stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          ${Number(stats.pnl).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {symbolStats && Object.keys(symbolStats).length > 0 && (
          <Card title="Performance by Symbol" padding="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0f0f0f] text-xs uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="text-left px-4 py-3">Symbol</th>
                    <th className="text-center px-4 py-3">Trades</th>
                    <th className="text-center px-4 py-3 hidden sm:table-cell">Wins</th>
                    <th className="text-center px-4 py-3">Win Rate</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Avg P&L</th>
                    <th className="text-right px-4 py-3">Total P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {Object.entries(symbolStats)
                    .sort((a, b) => b[1].pnl - a[1].pnl)
                    .map(([symbol, stats]) => {
                      const insufficient = stats.sufficient === false;
                      return (
                        <tr
                          key={symbol}
                          className={`hover:bg-[#0f0f0f] transition-colors ${insufficient ? "opacity-60" : ""}`}
                        >
                          <td className="px-4 py-3 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span>{symbol}</span>
                              {insufficient && (
                                <span className="text-[9px] uppercase tracking-wider text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded px-1 py-0.5">
                                  low n
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-300">{stats.count}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-neutral-300 hidden sm:table-cell">{stats.wins}</td>
                          <td className="px-4 py-3 text-center">
                            {insufficient ? (
                              <span className="text-neutral-500 text-xs">—</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                {stats.winrate}%
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium tabular-nums hidden md:table-cell ${insufficient ? "text-neutral-500" : stats.avg_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {insufficient ? "—" : `$${stats.avg_pnl}`}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold tabular-nums ${stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            ${Number(stats.pnl).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
