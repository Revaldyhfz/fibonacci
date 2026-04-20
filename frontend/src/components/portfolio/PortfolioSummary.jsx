/**
 * PortfolioSummary — 4-card KPI grid (value, cost, pnl, pnl%).
 * Safe against null portfolio (returns null).
 */
function fmt(n, opts = {}) {
  if (n == null || !isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  });
}

function colorFor(n) {
  if (n == null) return "text-neutral-300";
  return n >= 0 ? "text-emerald-500" : "text-red-500";
}

export default function PortfolioSummary({ portfolio }) {
  if (!portfolio) return null;

  const cards = [
    { label: "Total Value", value: `$${fmt(portfolio.total_value_usd)}`, tone: "text-white" },
    { label: "Total Cost",  value: `$${fmt(portfolio.total_cost)}`,      tone: "text-neutral-300" },
    {
      label: "Total P&L",
      value: `${portfolio.total_pnl >= 0 ? "+" : ""}$${fmt(Math.abs(portfolio.total_pnl || 0))}`,
      tone: colorFor(portfolio.total_pnl),
    },
    {
      label: "P&L %",
      value: `${portfolio.total_pnl_percent != null ? portfolio.total_pnl_percent.toFixed(2) : "0.00"}%`,
      tone: colorFor(portfolio.total_pnl_percent),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors"
        >
          <div className="text-xs text-neutral-400 mb-1">{c.label}</div>
          <div className={`text-3xl font-bold ${c.tone}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
