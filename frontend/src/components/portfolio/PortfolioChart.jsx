import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const RANGES = [
  { label: "24H", value: 1 },
  { label: "7D",  value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-[#1e1e1e] border border-neutral-700 rounded-lg p-3 shadow-xl text-xs">
      <div className="text-neutral-400 mb-1">{data.fullDate || label}</div>
      <div className="text-base font-bold text-emerald-400">
        Value: ${data.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

/**
 * PortfolioChart — time-range controls + recharts line chart.
 *
 * Props:
 *   data            [{ date, value, fullDate, timestamp }]
 *   timeRange       number (days)
 *   onTimeRangeChange (days) => void
 *   loading         boolean
 *   cachedRanges    Record<number, boolean>  // for "cached" check-marks
 *   missingDates    boolean  // show "missing dates" warning banner
 *   missingCount    number
 */
export default function PortfolioChart({
  data = [],
  timeRange = 7,
  onTimeRangeChange,
  loading = false,
  cachedRanges = {},
  missingDates = false,
  missingCount = 0,
}) {
  return (
    <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 sm:p-6 mb-6">
      {missingDates && (
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
          <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 text-sm">
            <div className="font-medium text-yellow-400 mb-1">Chart accuracy notice</div>
            <div className="text-yellow-200/80">
              {missingCount} asset{missingCount === 1 ? "" : "s"} missing purchase dates. These are shown as held for the entire period, which may not reflect reality.
              <span className="block mt-1 text-xs">
                Add purchase dates to your assets for accurate historical charts.
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Portfolio Value</h3>
          <p className="text-sm text-neutral-400 hidden sm:block">
            Historical performance based on holdings
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {RANGES.map((range) => {
            const active = timeRange === range.value;
            return (
              <button
                key={range.value}
                onClick={() => onTimeRangeChange?.(range.value)}
                disabled={loading}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  active
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-[#0a0a0a] border border-neutral-700 text-neutral-300 hover:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {range.label}
                {cachedRanges[range.value] && (
                  <span className="ml-1 text-[10px] opacity-60">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full h-80">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-neutral-600 border-t-blue-500 mb-2" />
              <div className="text-sm text-neutral-400">Loading chart data ({timeRange}D)…</div>
            </div>
          </div>
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false}/>
              <XAxis
                dataKey="date"
                stroke="#737373"
                style={{ fontSize: "10px" }}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#737373"
                style={{ fontSize: "10px" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                dx={-10}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#525252", strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                fill="url(#colorValue)"
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-neutral-400 mb-2">No chart data available for this period.</p>
            <p className="text-sm text-neutral-500">
              This might happen if no assets were held or price data is missing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
