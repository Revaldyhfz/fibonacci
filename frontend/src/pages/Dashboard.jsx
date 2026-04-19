import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import Card, { Stat } from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";

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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionInfo, setSessionInfo] = useState(() => computeSession());

  const fetchStats = useCallback(async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens") || "null");
      if (!tokens?.access) throw new Error("Not authenticated");
      const res = await fetch("/api/trades/stats/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (!res.ok) throw new Error("Failed to load stats");
      setStats(await res.json());
    } catch (err) {
      setError(err.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(() => setSessionInfo(computeSession()), 60_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const pnl = stats?.total_pnl ?? 0;
  const wlRatio =
    stats?.avg_loss && stats.avg_loss !== 0
      ? Math.abs(stats.avg_win / stats.avg_loss)
      : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-12">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {sessionInfo && <SessionBanner info={sessionInfo} />}

        {loading ? (
          <div className="py-20">
            <Spinner label="Loading dashboard…" />
          </div>
        ) : error ? (
          <Card className="mt-6">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mt-6">
              <Stat label="Total Trades" value={stats?.total_trades || 0} />
              <Stat
                label="Win Rate"
                value={`${stats?.winrate_percent?.toFixed?.(1) ?? stats?.winrate_percent ?? 0}%`}
                tone="positive"
              />
              <Stat
                label="Total P&L"
                value={`${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`}
                tone={pnl >= 0 ? "positive" : "negative"}
              />
              <Stat
                label="Winning Trades"
                value={stats?.wins || 0}
                tone="positive"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3 mt-6">
              <Card title="Average Performance">
                <dl className="divide-y divide-neutral-800">
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-xs text-neutral-400 font-medium">Avg Win</dt>
                    <dd className="text-lg font-bold text-emerald-400 tabular-nums">
                      +${Math.abs(stats?.avg_win || 0).toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-xs text-neutral-400 font-medium">Avg Loss</dt>
                    <dd className="text-lg font-bold text-red-400 tabular-nums">
                      ${(stats?.avg_loss || 0).toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-xs text-neutral-400 font-medium">W/L Ratio</dt>
                    <dd className="text-lg font-bold text-white tabular-nums">
                      {wlRatio.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              </Card>

              <Card title="Best & Worst">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-neutral-400 font-medium mb-2">Best Trade</div>
                    {stats?.best_trade ? (
                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg">
                        <span className="text-sm font-bold text-white">{stats.best_trade.symbol}</span>
                        <span className="text-lg font-bold text-emerald-400 tabular-nums">
                          +${stats.best_trade.pnl.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-500 p-3 border border-neutral-800 rounded-lg">
                        No trades yet
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-neutral-400 font-medium mb-2">Worst Trade</div>
                    {stats?.worst_trade ? (
                      <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                        <span className="text-sm font-bold text-white">{stats.worst_trade.symbol}</span>
                        <span className="text-lg font-bold text-red-400 tabular-nums">
                          ${stats.worst_trade.pnl.toFixed(2)}
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
                <div className="space-y-3">
                  <Link to="/trades" className="block">
                    <Button className="w-full">Trades Calendar</Button>
                  </Link>
                  <Link to="/analytics" className="block">
                    <Button variant="secondary" className="w-full">Analytics</Button>
                  </Link>
                  <Link to="/portfolio" className="block">
                    <Button variant="secondary" className="w-full">Portfolio</Button>
                  </Link>
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
