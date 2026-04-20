import { useEffect, useRef } from "react";

// Country-code → TradingView exchange prefix
const MARKET_TO_EXCHANGE = {
  US: "",            // TV auto-routes (NASDAQ/NYSE) if omitted
  ID: "IDX",
  JP: "TSE",
  UK: "LSE",
  HK: "HKEX",
  AU: "ASX",
  SG: "SGX",
  KR: "KRX",
  CN: "SSE",
  CA: "TSX",
};

function toTradingViewSymbol(asset) {
  if (!asset) return "";
  const sym = (asset.symbol || "").toUpperCase();
  if (asset.asset_type === "stock") {
    const mkt = asset.market;
    const prefix = MARKET_TO_EXCHANGE[mkt];
    // For stocks with suffix tickers (e.g. "BBCA.JK"), strip the suffix for TV
    const base = sym.includes(".") ? sym.split(".")[0] : sym;
    return prefix ? `${prefix}:${base}` : base;
  }
  return `BINANCE:${sym}USDT`;
}

/**
 * ChartModal — TradingView embed for the selected asset.
 *
 * Props: open, onClose, asset { symbol, asset_type, market, coin_id }
 */
export default function ChartModal({ open, onClose, asset }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open || !asset) return undefined;
    const el = containerRef.current;
    if (!el) return undefined;
    el.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (!window.TradingView || !containerRef.current) return;
      try {
        new window.TradingView.widget({
          container_id: containerRef.current.id,
          width: "100%",
          height: 500,
          symbol: toTradingViewSymbol(asset),
          interval: "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0a0a0a",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          backgroundColor: "#0a0a0a",
          gridColor: "#1a1a1a",
          studies: ["MASimple@tv-basicstudies", "RSI@tv-basicstudies"],
          allow_symbol_change: true,
        });
      } catch {
        if (containerRef.current) {
          containerRef.current.innerHTML =
            '<p class="text-red-500 text-center p-6">Failed to load chart.</p>';
        }
      }
    };
    script.onerror = () => {
      if (containerRef.current) {
        containerRef.current.innerHTML =
          '<p class="text-red-500 text-center p-6">Failed to load TradingView script.</p>';
      }
    };

    document.body.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (el) el.innerHTML = "";
    };
  }, [open, asset]);

  // Escape to close
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !asset) return null;

  const tvSymbol = toTradingViewSymbol(asset);

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-5xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">
              {asset.symbol?.toUpperCase() || "Chart"}{" "}
              <span className="text-neutral-500 text-sm">· {tvSymbol}</span>
            </h3>
            <p className="text-xs text-neutral-400">Powered by TradingView</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chart"
            className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-grow p-1 sm:p-2 overflow-hidden">
          <div id="tv_chart_modal_container" ref={containerRef} className="w-full h-full min-h-[400px]" />
        </div>
      </div>
    </div>
  );
}
