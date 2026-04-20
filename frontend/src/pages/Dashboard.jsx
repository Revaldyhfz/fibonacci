import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Header from "../components/layout/Header";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";
import AssetLogo from "../components/portfolio/AssetLogo";

/* ────────────────────────────────────────────────────────────────────────── */
/* Session banner — unchanged; the existing gradient header already looks good */
/* ────────────────────────────────────────────────────────────────────────── */

const SESSIONS = [
  { key: "sydney", start: 22, end: 7, name: "Sydney" },
  { key: "tokyo", start: 0, end: 9, name: "Tokyo" },
  { key: "london", start: 8, end: 17, name: "London" },
  { key: "newYork", start: 13, end: 22, name: "New York" },
];

const LOCATION_BY_TZ = {
  "America/New_York": "New York",
  "Australia/Brisbane": "Brisbane",
  "Asia/Jakarta": "Jakarta",
  "Asia/Makassar": "Bali",
};

function computeSession(now = new Date()) {
  const utcHour = now.getUTCHours();
  const active = SESSIONS.filter((s) =>
    s.start < s.end
      ? utcHour >= s.start && utcHour < s.end
      : utcHour >= s.start || utcHour < s.end
  ).map((s) => s.name);

  const isOverlap = utcHour >= 13 && utcHour < 17;

  let nextEvent = null;
  const at = (h) => {
    const t = new Date(now);
    t.setUTCHours(h, 0, 0, 0);
    return t;
  };
  if (isOverlap) nextEvent = { message: "Overlap ends", time: at(17) };
  else if (utcHour >= 8 && utcHour < 13)
    nextEvent = { message: "NY opens · overlap begins", time: at(13) };
  else if (utcHour < 8) nextEvent = { message: "London opens", time: at(8) };
  else if (utcHour >= 17 && utcHour < 22)
    nextEvent = { message: "New York closes", time: at(22) };

  let remaining = "";
  if (nextEvent) {
    const diff = nextEvent.time - now;
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    remaining = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmtTime = (opts) =>
    now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, ...opts });
  const fmtDate = () =>
    now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: tz,
    });

  return {
    currentSession: active[0] || "No active session",
    activeSessions: active,
    isOverlap,
    nextEvent,
    timeRemaining: remaining,
    localTime: fmtTime({ timeZone: tz }),
    localDate: fmtDate(),
    userLocation: LOCATION_BY_TZ[tz] || tz.replace("_", " "),
    utcTime: fmtTime({ timeZone: "UTC" }),
  };
}

function SessionBanner({ info }) {
  const baseText = "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white";
  const isOverlap = info.isOverlap;
  const bgClass = isOverlap
    ? "bg-gradient-to-r from-green-500 via-cyan-500 to-blue-600"
    : info.currentSession === "London"
      ? "bg-gradient-to-r from-green-500 to-green-600"
      : info.currentSession === "New York"
        ? "bg-gradient-to-r from-blue-500 to-blue-600"
        : info.currentSession === "Tokyo"
          ? "bg-gradient-to-r from-purple-500 to-purple-600"
          : info.currentSession === "Sydney"
            ? "bg-gradient-to-r from-orange-500 to-orange-600"
            : "bg-gradient-to-r from-neutral-800 to-neutral-900";

  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-7 shadow-2xl ${bgClass}`}>
      <div className={baseText}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider opacity-90">
              {isOverlap ? "Prime Time Active" : info.currentSession === "No active session" ? "Market Closed" : "Active Now"}
            </span>
          </div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 leading-tight">
            {isOverlap
              ? "London × New York Overlap"
              : info.currentSession === "No active session"
                ? "No Active Trading Session"
                : `${info.currentSession} Session`}
          </div>
          {info.nextEvent && (
            <div className="text-sm sm:text-base opacity-90 font-medium">
              {info.nextEvent.message} in {info.timeRemaining}
            </div>
          )}
        </div>
        <div className="text-left sm:text-right shrink-0">
          <div className="text-xs opacity-80 font-medium mb-0.5">
            Your Time · {info.userLocation}
          </div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold tabular-nums">
            {info.localTime}
          </div>
          <div className="text-xs opacity-80 mt-0.5">{info.localDate}</div>
          <div className="text-[11px] opacity-70 mt-1 tabular-nums">
            UTC · {info.utcTime}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Small presentational helpers                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function formatCurrency(n, { compact = false } = {}) {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "$0";
  const sign = v >= 0 ? "+" : "-";
  const abs = Math.abs(v);
  if (compact && abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 1 : 2)}k`;
  }
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function HeroCard({ pnl, weekPnl, weekTrades, winratePct, loading }) {
  const color = pnl >= 0 ? "text-emerald-400" : "text-red-400";
  const chip =
    weekPnl > 0
      ? { text: `+${formatCurrency(weekPnl).replace("+", "")} this week`, className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" }
      : weekPnl < 0
        ? { text: `${formatCurrency(weekPnl)} this week`, className: "bg-red-500/10 text-red-300 border-red-500/30" }
        : { text: "Flat this week", className: "bg-neutral-900 text-neutral-400 border-neutral-700" };
  return (
    <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-[#141414] via-[#111] to-[#0c0c0c] p-6 sm:p-7 shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">
            All-time P&L
          </div>
          <div className={`text-4xl sm:text-5xl font-bold tabular-nums ${color}`}>
            {loading ? "…" : formatCurrency(pnl)}
          </div>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${chip.className}`}>
              {chip.text}
            </span>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-2 text-right">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
            This week
          </div>
          <div className="text-sm text-neutral-300 tabular-nums">
            {weekTrades ?? 0} trade{weekTrades === 1 ? "" : "s"}
          </div>
          <div className="text-sm text-neutral-300 tabular-nums">
            {Number(winratePct ?? 0).toFixed(1)}% win rate
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint, tone = "neutral", icon }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
        ? "text-red-400"
        : tone === "warning"
          ? "text-yellow-400"
          : tone === "accent"
            ? "text-blue-400"
            : "text-white";
  return (
    <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-neutral-400 font-medium">{label}</div>
        {icon && <div className="text-neutral-600 text-sm">{icon}</div>}
      </div>
      <div className={`text-2xl sm:text-3xl font-bold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="text-[11px] text-neutral-500 mt-1">{hint}</div>}
    </div>
  );
}

function EquityCurveCard({ equityData, loading }) {
  const chartData = useMemo(() => {
    if (!equityData || equityData.length === 0) return [];
    return equityData.map((p) => ({
      date: p.date,
      equity: Number(p.equity ?? 0),
    }));
  }, [equityData]);

  const lastEquity = chartData.length ? chartData[chartData.length - 1].equity : 0;
  const firstEquity = chartData.length ? chartData[0].equity : 0;
  const delta = lastEquity - firstEquity;
  const deltaPct = firstEquity !== 0 ? (delta / Math.abs(firstEquity)) * 100 : 0;
  const isUp = delta >= 0;

  return (
    <Card
      title="Equity Curve"
      subtitle={
        chartData.length === 0
          ? "No trade history yet"
          : `${chartData.length} points · ${formatCurrency(delta)} (${isUp ? "+" : ""}${deltaPct.toFixed(1)}%) since start`
      }
      action={
        <Link to="/analytics" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
          Analytics →
        </Link>
      }
    >
      {loading ? (
        <div className="h-40 flex items-center justify-center text-sm text-neutral-500">Loading…</div>
      ) : chartData.length < 2 ? (
        <div className="h-40 flex flex-col items-center justify-center text-sm text-neutral-500">
          <div className="text-4xl mb-2 opacity-40">📈</div>
          <div>Need at least 2 closed trades to draw the curve.</div>
        </div>
      ) : (
        <div className="h-48 sm:h-56 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#a3a3a3" }}
                formatter={(value) => [formatCurrency(value), "Equity"]}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={isUp ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                fill="url(#eqFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function RecentTradesCard({ trades, loading }) {
  const slice = (trades || []).slice(0, 8);
  return (
    <Card
      title="Recent Trades"
      subtitle={loading ? "Loading…" : slice.length ? `Last ${slice.length} closed trades` : "No trades yet"}
      action={
        <Link to="/trades" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
          All trades →
        </Link>
      }
      padding="p-0"
    >
      {slice.length === 0 ? (
        <div className="p-6 text-center text-sm text-neutral-500">
          <div className="text-3xl mb-2 opacity-40">🧾</div>
          Log your first trade to see it here.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {slice.map((t) => {
            const pnl = Number(t.pnl ?? 0);
            const open = t.pnl == null || t.close_date == null;
            const pnlColor = open
              ? "text-neutral-400"
              : pnl >= 0
                ? "text-emerald-400"
                : "text-red-400";
            return (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#0f0f0f] transition-colors">
                <AssetLogo symbol={t.symbol} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm truncate">{t.symbol}</span>
                    {t.direction && (
                      <span
                        className={`text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 border ${
                          t.direction === "LONG"
                            ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                            : "text-red-300 bg-red-500/10 border-red-500/30"
                        }`}
                      >
                        {t.direction}
                      </span>
                    )}
                    {open && (
                      <span className="text-[9px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 border text-blue-300 bg-blue-500/10 border-blue-500/30">
                        open
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {formatRelativeTime(t.trade_date)}
                    {t.strategy_name ? ` · ${t.strategy_name}` : ""}
                  </div>
                </div>
                <div className={`text-sm font-bold tabular-nums ${pnlColor}`}>
                  {open ? "—" : formatCurrency(pnl, { compact: true })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StrategyLeaderboardCard({ strategies, loading }) {
  const sorted = useMemo(() => {
    if (!strategies) return [];
    return Object.entries(strategies)
      .map(([name, s]) => ({
        name,
        count: s.count ?? 0,
        winrate: Number(s.winrate ?? 0),
        pnl: Number(s.pnl ?? 0),
        sufficient: s.sufficient !== false,
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);
  }, [strategies]);

  const max = Math.max(1, ...sorted.map((s) => Math.abs(s.pnl)));

  return (
    <Card
      title="Strategy Leaderboard"
      subtitle={loading ? "Loading…" : sorted.length ? "Ranked by net P&L" : "No strategies yet"}
    >
      {sorted.length === 0 ? (
        <div className="py-4 text-center text-sm text-neutral-500">
          Tag trades with a strategy to unlock this.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((s) => {
            const pnlColor = s.pnl >= 0 ? "text-emerald-400" : "text-red-400";
            const barColor = s.pnl >= 0 ? "bg-emerald-500/60" : "bg-red-500/60";
            const widthPct = Math.max(4, (Math.abs(s.pnl) / max) * 100);
            return (
              <li key={s.name}>
                <div className="flex items-center justify-between gap-3 text-sm mb-1">
                  <span className="font-medium text-white truncate flex items-center gap-1.5">
                    {s.name}
                    {!s.sufficient && (
                      <span className="text-[9px] uppercase tracking-wider text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded px-1 py-0.5">
                        low n
                      </span>
                    )}
                  </span>
                  <span className={`font-bold tabular-nums ${pnlColor} shrink-0`}>
                    {formatCurrency(s.pnl, { compact: true })}
                  </span>
                </div>
                <div className="relative h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor}`} style={{ width: `${widthPct}%` }} />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-neutral-500 mt-1">
                  <span>{s.count} trades</span>
                  <span>{s.winrate.toFixed(0)}% win rate</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PortfolioSnapshotCard({ portfolio, loading }) {
  const total = Number(portfolio?.total_value_usd ?? 0);
  const pnl = Number(portfolio?.total_pnl ?? 0);
  const pnlPct = Number(portfolio?.total_pnl_percent ?? 0);
  const assets = (portfolio?.assets || [])
    .filter((a) => a.current_value != null)
    .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
    .slice(0, 3);

  const pnlColor = pnl >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <Card
      title="Portfolio"
      subtitle={loading ? "Loading…" : assets.length ? `${portfolio?.assets?.length || 0} holdings` : "No assets"}
      action={
        <Link to="/portfolio" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
          Open →
        </Link>
      }
    >
      {!loading && total === 0 ? (
        <div className="py-6 text-center text-sm text-neutral-500">
          <div className="text-3xl mb-2 opacity-40">💼</div>
          Add your first holding on the Portfolio page.
        </div>
      ) : (
        <>
          <div className="mb-4">
            <div className="text-xs text-neutral-400 mb-1">Total value</div>
            <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
              ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            {pnl !== 0 && (
              <div className={`text-sm font-medium tabular-nums ${pnlColor}`}>
                {pnl >= 0 ? "+" : ""}
                {formatCurrency(pnl).replace("+", "").replace("-", pnl < 0 ? "-" : "")}
                <span className="text-xs text-neutral-500 ml-1.5">
                  ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          {assets.length > 0 && (
            <ul className="space-y-2 pt-3 border-t border-neutral-800">
              {assets.map((a) => (
                <li
                  key={`${a.asset_type}:${a.symbol}`}
                  className="flex items-center gap-2.5"
                >
                  <AssetLogo symbol={a.symbol} src={a.logo_url} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{a.symbol}</div>
                  </div>
                  <div className="text-sm font-medium text-white tabular-nums">
                    ${Number(a.current_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Dashboard page                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [weekStats, setWeekStats] = useState(null);
  const [equityCurve, setEquityCurve] = useState(null);
  const [recentTrades, setRecentTrades] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionInfo, setSessionInfo] = useState(() => computeSession());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens") || "null");
      if (!tokens?.access) throw new Error("Not authenticated");
      const auth = { Authorization: `Bearer ${tokens.access}` };

      const safeJson = async (res) => (res.ok ? await res.json() : null);

      const [s, w, eq, t, p] = await Promise.all([
        fetch("/api/trades/stats/", { headers: auth }).then(safeJson),
        fetch("/analytics/stats/overall?time_filter=week", { headers: auth }).then(safeJson),
        fetch("/analytics/stats/equity_curve", { headers: auth }).then(safeJson),
        fetch("/api/trades/", { headers: auth }).then(safeJson),
        fetch("/api/crypto-assets/portfolio_summary/", { headers: auth }).then(safeJson),
      ]);

      setStats(s);
      setWeekStats(w);
      setEquityCurve(Array.isArray(eq) ? eq : []);
      setRecentTrades(Array.isArray(t) ? t : []);
      setPortfolio(p);
    } catch (err) {
      setError(err.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(() => setSessionInfo(computeSession()), 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const pnl = stats?.total_pnl ?? 0;
  const weekPnl = weekStats?.total_pnl ?? 0;
  const weekTrades = weekStats?.total_trades ?? 0;
  const weekWin = weekStats?.winrate_percent ?? 0;
  const profitFactor = Number(weekStats?.advanced_metrics?.profit_factor ?? 0);
  const overallWin = Number(stats?.winrate_percent ?? 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-12">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {sessionInfo && <SessionBanner info={sessionInfo} />}

        {loading ? (
          <div className="py-20">
            <Spinner label="Loading dashboard…" />
          </div>
        ) : error ? (
          <Card>
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <Button onClick={fetchAll}>Retry</Button>
          </Card>
        ) : (
          <>
            <HeroCard
              pnl={pnl}
              weekPnl={weekPnl}
              weekTrades={weekTrades}
              winratePct={weekWin || overallWin}
              loading={loading}
            />

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Trades (all-time)"
                value={stats?.total_trades ?? 0}
                hint={`${weekTrades} this week`}
                tone="neutral"
                icon="#"
              />
              <StatTile
                label="Win rate"
                value={`${overallWin.toFixed(1)}%`}
                hint={weekStats ? `${weekWin.toFixed(0)}% this week` : null}
                tone={overallWin >= 50 ? "positive" : "warning"}
                icon="%"
              />
              <StatTile
                label="Profit factor"
                value={profitFactor ? profitFactor.toFixed(2) : "—"}
                hint={profitFactor >= 1.5 ? "Healthy edge" : profitFactor >= 1 ? "Marginal edge" : "Needs 30+ trades"}
                tone={profitFactor >= 1.5 ? "positive" : profitFactor >= 1 ? "warning" : "neutral"}
                icon="⚖"
              />
              <StatTile
                label="Avg win / loss"
                value={
                  stats?.avg_loss
                    ? `${Math.abs(stats.avg_win / stats.avg_loss || 0).toFixed(2)}:1`
                    : "—"
                }
                hint={
                  stats?.avg_win || stats?.avg_loss
                    ? `+$${Math.abs(stats.avg_win || 0).toFixed(0)} / -$${Math.abs(stats.avg_loss || 0).toFixed(0)}`
                    : null
                }
                tone="accent"
                icon="Σ"
              />
            </div>

            <EquityCurveCard equityData={equityCurve} loading={false} />

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RecentTradesCard trades={recentTrades} loading={false} />
              </div>
              <StrategyLeaderboardCard
                strategies={weekStats?.strategy_performance}
                loading={false}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <PortfolioSnapshotCard portfolio={portfolio} loading={false} />

              <Card
                title="Best & Worst"
                subtitle="All-time"
                className="lg:col-span-1"
              >
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-1.5">
                      Best trade
                    </div>
                    {stats?.best_trade ? (
                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          <AssetLogo symbol={stats.best_trade.symbol} size={22} />
                          {stats.best_trade.symbol}
                        </span>
                        <span className="text-lg font-bold text-emerald-400 tabular-nums">
                          +${Number(stats.best_trade.pnl).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-500 p-3 border border-neutral-800 rounded-lg">
                        No trades yet
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-1.5">
                      Worst trade
                    </div>
                    {stats?.worst_trade ? (
                      <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          <AssetLogo symbol={stats.worst_trade.symbol} size={22} />
                          {stats.worst_trade.symbol}
                        </span>
                        <span className="text-lg font-bold text-red-400 tabular-nums">
                          ${Number(stats.worst_trade.pnl).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-500 p-3 border border-neutral-800 rounded-lg">
                        No trades yet
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card
                title="Quick Actions"
                className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border-blue-500/30"
              >
                <div className="space-y-2.5">
                  <Link to="/trades" className="block">
                    <Button className="w-full">+ Log a trade</Button>
                  </Link>
                  <Link to="/analytics" className="block">
                    <Button variant="secondary" className="w-full">Analytics</Button>
                  </Link>
                  <Link to="/portfolio" className="block">
                    <Button variant="secondary" className="w-full">Portfolio</Button>
                  </Link>
                </div>
                {sessionInfo?.isOverlap && (
                  <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs text-cyan-300">
                    🔥 Overlap window open — this is the highest-liquidity block
                    of the trading day.
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
