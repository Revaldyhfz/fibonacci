import { Fragment, useState } from "react";
import AssetLogo from "./AssetLogo";
import MarketBadge from "./MarketBadge";

function formatAmount(n, assetType) {
  if (n == null || !isFinite(n)) return "—";
  // stocks usually whole-share quantities; crypto needs precision
  if (assetType === "stock") return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toFixed(6);
}

function formatUsd(n, { small = false } = {}) {
  if (n == null || !isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: small || n < 1 ? 6 : 2,
  })}`;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysAgo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
}

/**
 * AssetsTable — aggregated view with per-purchase drill-down.
 *
 * Props:
 *   aggregatedAssets:  portfolio.assets[]   (summary rows from backend)
 *   rawAssets:         raw /api/crypto-assets/ records[]
 *   onOpenChart:       (asset) => void
 *   onDelete:          (rawAssetId) => void    // each purchase is individually deletable
 */
export default function AssetsTable({
  aggregatedAssets = [],
  rawAssets = [],
  onOpenChart,
  onDelete,
}) {
  const [expandedKey, setExpandedKey] = useState(null);

  // Group raw purchases by (asset_type, symbol) — mirrors backend aggregation key
  const purchasesByKey = new Map();
  rawAssets.forEach((a) => {
    const key = `${a.asset_type || "crypto"}:${(a.symbol || "").toUpperCase()}`;
    if (!purchasesByKey.has(key)) purchasesByKey.set(key, []);
    purchasesByKey.get(key).push(a);
  });

  return (
    <div className="bg-[#141414] border border-neutral-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[#0a0a0a]">
            <tr>
              <th className="px-4 py-3 text-left  text-xs font-semibold text-neutral-400 uppercase tracking-wider">Asset</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Value</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">24h %</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">P&L</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase tracking-wider">Purchases</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {aggregatedAssets.map((asset, idx) => {
              const assetType = asset.asset_type || "crypto";
              const market = asset.market;
              const key = `${assetType}:${(asset.symbol || "").toUpperCase()}`;
              const purchases = purchasesByKey.get(key) || [];
              const hasMultiple = purchases.length > 1;
              const expanded = expandedKey === key;

              return (
                <Fragment key={asset.coin_id || `${key}-${idx}`}>
                  <tr
                    className={`transition-colors group ${
                      hasMultiple ? "cursor-pointer" : ""
                    } ${expanded ? "bg-[#0a0a0a]" : "hover:bg-[#0a0a0a]"}`}
                    onClick={() => hasMultiple && setExpandedKey(expanded ? null : key)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {hasMultiple ? (
                          <svg
                            className={`w-3 h-3 text-neutral-500 transition-transform ${expanded ? "rotate-90" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        ) : (
                          <span className="w-3 h-3 inline-block" />
                        )}
                        <AssetLogo symbol={asset.symbol} src={asset.logo_url} size={30} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{asset.symbol}</span>
                            <MarketBadge market={market} assetType={assetType} />
                          </div>
                          <div className="text-xs text-neutral-500 truncate">{asset.coin_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white">
                      {formatAmount(asset.total_amount ?? asset.amount, assetType)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white">
                      {formatUsd(asset.current_price, { small: true })}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-white">
                      {formatUsd(asset.current_value)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {asset.change_24h != null ? (
                        <span className={`text-sm ${asset.change_24h >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {asset.change_24h >= 0 ? "+" : ""}
                          {asset.change_24h.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {asset.pnl != null ? (
                        <div>
                          <div className={`text-sm font-bold ${asset.pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {asset.pnl >= 0 ? "+" : ""}
                            {formatUsd(Math.abs(asset.pnl))}
                          </div>
                          <div className={`text-xs ${asset.pnl_percent >= 0 ? "text-emerald-400/80" : "text-red-400/80"}`}>
                            {asset.pnl_percent != null ? asset.pnl_percent.toFixed(2) : "0.00"}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {purchases.length > 0 ? (
                        <span className="text-xs text-neutral-300">
                          {purchases.length === 1
                            ? (formatDate(purchases[0].purchase_date) || <span className="text-yellow-500">No date</span>)
                            : (
                              <span className="inline-flex items-center gap-1">
                                <span className="inline-block min-w-[1.25rem] text-center bg-blue-500/10 text-blue-300 rounded px-1.5 text-[10px] font-semibold">
                                  {purchases.length}
                                </span>
                                lots
                              </span>
                            )}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenChart?.(asset); }}
                          className="p-1.5 text-neutral-400 hover:text-blue-500 transition-colors"
                          title="View chart"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                          </svg>
                        </button>
                        {purchases.length === 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete?.(purchases[0].id); }}
                            className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                            title="Delete asset"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expanded && hasMultiple && (
                    <tr className="bg-[#080808]">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="border border-neutral-800 rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#0a0a0a]">
                              <tr>
                                <th className="px-3 py-2 text-left  text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Purchased</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Amount</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Buy price</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Cost</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Current value</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Lot P&L</th>
                                <th className="px-3 py-2 text-center text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Notes</th>
                                <th className="px-3 py-2 text-center text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Remove</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800">
                              {purchases.map((p) => {
                                const amt = parseFloat(p.amount) || 0;
                                const buy = p.purchase_price != null ? parseFloat(p.purchase_price) : null;
                                const cost = buy != null ? amt * buy : null;
                                const value = asset.current_price != null ? amt * asset.current_price : null;
                                const lotPnl = (value != null && cost != null) ? value - cost : null;
                                const pnlPct = (lotPnl != null && cost) ? (lotPnl / cost) * 100 : null;
                                const dstr = formatDate(p.purchase_date);
                                const ago = daysAgo(p.purchase_date);
                                return (
                                  <tr key={p.id} className="hover:bg-[#0a0a0a] transition-colors">
                                    <td className="px-3 py-2 text-xs">
                                      {dstr ? (
                                        <div>
                                          <div className="text-neutral-200">{dstr}</div>
                                          {ago != null && <div className="text-[10px] text-neutral-500">{ago}d ago</div>}
                                        </div>
                                      ) : (
                                        <span className="text-yellow-500">No date</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs text-neutral-200">
                                      {formatAmount(amt, assetType)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs text-neutral-200">
                                      {buy != null ? formatUsd(buy, { small: true }) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs text-neutral-200">
                                      {cost != null ? formatUsd(cost) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs text-neutral-200">
                                      {value != null ? formatUsd(value) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs">
                                      {lotPnl != null ? (
                                        <>
                                          <div className={lotPnl >= 0 ? "text-emerald-500 font-semibold" : "text-red-500 font-semibold"}>
                                            {lotPnl >= 0 ? "+" : ""}{formatUsd(Math.abs(lotPnl))}
                                          </div>
                                          {pnlPct != null && (
                                            <div className={`text-[10px] ${pnlPct >= 0 ? "text-emerald-400/80" : "text-red-400/80"}`}>
                                              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-neutral-500">—</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center text-xs text-neutral-400 max-w-[200px] truncate" title={p.notes || ""}>
                                      {p.notes ? p.notes : <span className="text-neutral-600">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onDelete?.(p.id); }}
                                        className="p-1 text-neutral-500 hover:text-red-500 transition-colors"
                                        title="Delete this purchase"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
