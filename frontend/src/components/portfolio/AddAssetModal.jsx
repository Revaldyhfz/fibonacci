import { useEffect, useRef, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Input, Textarea } from "../ui/Input";
import Spinner from "../ui/Spinner";
import AssetLogo from "./AssetLogo";
import MarketBadge from "./MarketBadge";
import useDebounce from "../../hooks/useDebounce";

const FILTERS = [
  { key: "all",    label: "All" },
  { key: "crypto", label: "Crypto" },
  { key: "stock",  label: "Stocks" },
];

const emptyForm = {
  amount: "",
  purchase_price: "",
  purchase_date: "",
  notes: "",
};

/**
 * AddAssetModal — unified crypto + stock picker with live price preview.
 *
 * Props:
 *   open      boolean
 *   onClose   () => void
 *   onSubmit  (payload) => Promise<void>   // parent POSTs to Django
 *   authHeaders object                      // { Authorization: 'Bearer ...' }
 */
export default function AddAssetModal({ open, onClose, onSubmit, authHeaders }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);

  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [selected, setSelected] = useState(null);       // { id, symbol, name, asset_type, market }
  const [price, setPrice] = useState(null);             // { price_usd, native_price, currency, change_24h }
  const [priceLoading, setPriceLoading] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const searchAbort = useRef(null);
  const priceAbort = useRef(null);
  const searchInputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setFilter("all");
    setQuery("");
    setResults([]);
    setSelected(null);
    setPrice(null);
    setForm(emptyForm);
    setErrors({});
    // Focus search input
    const t = setTimeout(() => searchInputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  // Search as user types
  useEffect(() => {
    if (!open) return;
    if (!debounced || debounced.trim().length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    if (searchAbort.current) searchAbort.current.abort();
    const ctl = new AbortController();
    searchAbort.current = ctl;

    setSearching(true);
    fetch(`/portfolio/search/${encodeURIComponent(debounced.trim())}?limit=30`, {
      headers: authHeaders,
      signal: ctl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data) => setResults(data.results || []))
      .catch((e) => {
        if (e.name !== "AbortError") setResults([]);
      })
      .finally(() => {
        if (!ctl.signal.aborted) setSearching(false);
      });

    return () => ctl.abort();
  }, [debounced, open, authHeaders]);

  // Fetch live price on selection
  useEffect(() => {
    if (!selected) {
      setPrice(null);
      return;
    }
    if (priceAbort.current) priceAbort.current.abort();
    const ctl = new AbortController();
    priceAbort.current = ctl;

    setPriceLoading(true);
    setPrice(null);

    const url = `/portfolio/price/${encodeURIComponent(selected.id)}?asset_type=${selected.asset_type}`;
    fetch(url, { headers: authHeaders, signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data) => setPrice(data))
      .catch((e) => {
        if (e.name !== "AbortError") setPrice(null);
      })
      .finally(() => {
        if (!ctl.signal.aborted) setPriceLoading(false);
      });

    return () => ctl.abort();
  }, [selected, authHeaders]);

  const filtered = results.filter(
    (r) => filter === "all" || r.asset_type === filter,
  );
  const countCrypto = results.filter((r) => r.asset_type === "crypto").length;
  const countStock  = results.filter((r) => r.asset_type === "stock").length;

  const valuation = (() => {
    const amt = parseFloat(form.amount);
    if (!price?.price_usd || !amt || amt <= 0) return null;
    return amt * price.price_usd;
  })();

  const useLivePrice = () => {
    if (price?.price_usd) {
      setForm((f) => ({ ...f, purchase_price: price.price_usd.toFixed(price.price_usd < 1 ? 6 : 2) }));
    }
  };

  const validate = () => {
    const e = {};
    if (!selected) e.selected = "Search and select an asset.";
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) e.amount = "Enter a positive amount.";
    if (form.purchase_price) {
      const pp = parseFloat(form.purchase_price);
      if (isNaN(pp) || pp < 0) e.purchase_price = "Price must be non-negative.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        symbol: selected.symbol.toUpperCase(),
        coin_id: selected.id,
        asset_type: selected.asset_type,
        market: selected.market || "",
        amount: parseFloat(form.amount),
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        purchase_date: form.purchase_date ? new Date(form.purchase_date).toISOString() : null,
        notes: form.notes || "",
      };
      await onSubmit(payload);
      onClose?.();
    } catch {
      // parent shows toast; keep modal open so user can retry
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to portfolio"
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!selected || !form.amount}
          >
            {selected ? `Add ${selected.symbol.toUpperCase()}` : "Add"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#0a0a0a] border border-neutral-800 rounded-lg w-fit">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? results.length : f.key === "crypto" ? countCrypto : countStock;
            const active = filter === f.key;
            return (
              <button
                type="button"
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={[
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  active
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800",
                ].join(" ")}
              >
                {f.label}
                {debounced && (
                  <span className={`ml-1.5 text-[10px] ${active ? "text-white/70" : "text-neutral-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div>
          <Input
            ref={searchInputRef}
            label="Search asset"
            placeholder="e.g. BTC, AAPL, BBCA, Tesla, Bank Central Asia"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-neutral-500">
            Crypto (Binance + CoinGecko) and global stocks (US, IDX, Tokyo, London, HK, AU, more).
          </p>
        </div>

        {/* Search results */}
        {query && (
          <div className="border border-neutral-800 rounded-lg bg-[#0a0a0a] max-h-64 overflow-y-auto">
            {searching && (
              <div className="p-4 flex items-center gap-2 text-neutral-400 text-sm">
                <Spinner size="sm" label="" /> Searching…
              </div>
            )}
            {!searching && filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-neutral-500">
                No matches for “{query}”.
              </div>
            )}
            {!searching && filtered.length > 0 && (
              <ul className="divide-y divide-neutral-800">
                {filtered.slice(0, 20).map((r) => {
                  const isSelected = selected?.id === r.id;
                  return (
                    <li key={`${r.asset_type}-${r.id}`}>
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className={[
                          "w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors",
                          isSelected
                            ? "bg-blue-500/10 border-l-2 border-blue-500"
                            : "hover:bg-neutral-900",
                        ].join(" ")}
                      >
                        <AssetLogo symbol={r.symbol} src={r.logo_url} size={28} />
                        <MarketBadge market={r.market} assetType={r.asset_type} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {r.symbol.toUpperCase()}
                          </div>
                          <div className="text-xs text-neutral-400 truncate">{r.name}</div>
                        </div>
                        {r.exchange && (
                          <span className="text-[10px] text-neutral-500 whitespace-nowrap">
                            {r.exchange}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Selected preview */}
        {selected && (
          <div className="rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-[#0a0a0a] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <AssetLogo symbol={selected.symbol} src={price?.logo_url || selected.logo_url} size={40} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-bold text-white">{selected.symbol.toUpperCase()}</span>
                    <MarketBadge market={selected.market} assetType={selected.asset_type} />
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{selected.name}</div>
                </div>
              </div>
              <div className="text-right">
                {priceLoading && <Spinner size="sm" label="" />}
                {!priceLoading && price && (
                  <>
                    <div className="text-lg font-bold text-white">
                      ${price.price_usd < 1
                        ? price.price_usd.toFixed(6)
                        : price.price_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    {price.currency && price.currency !== "USD" && price.native_price != null && (
                      <div className="text-[11px] text-neutral-500">
                        {price.native_price.toLocaleString()} {price.currency}
                      </div>
                    )}
                    {typeof price.change_24h === "number" && price.change_24h !== 0 && (
                      <div className={`text-xs font-medium ${price.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {price.change_24h >= 0 ? "+" : ""}
                        {price.change_24h.toFixed(2)}% 24h
                      </div>
                    )}
                  </>
                )}
                {!priceLoading && !price && (
                  <div className="text-xs text-neutral-500">No live price</div>
                )}
              </div>
            </div>
          </div>
        )}
        {errors.selected && <p className="text-xs text-red-400">{errors.selected}</p>}
        {/* close outer flex wrapper for the selected preview header */}

        {/* Form fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Amount *"
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            error={errors.amount}
          />
          <div>
            <Input
              label="Purchase price (USD)"
              type="number"
              step="any"
              min="0"
              placeholder={price?.price_usd ? `market: $${price.price_usd.toFixed(price.price_usd < 1 ? 6 : 2)}` : "optional"}
              value={form.purchase_price}
              onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
              error={errors.purchase_price}
            />
            {price?.price_usd && (
              <button
                type="button"
                onClick={useLivePrice}
                className="mt-1 text-[11px] text-blue-400 hover:text-blue-300"
              >
                Use current market price
              </button>
            )}
          </div>
          <Input
            label="Purchase date"
            type="date"
            value={form.purchase_date}
            onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
          />
          {/* Valuation preview */}
          <div className="flex flex-col justify-end">
            <div className="text-xs text-neutral-400 mb-1">Estimated value</div>
            <div className="text-xl font-bold text-white">
              {valuation != null
                ? `$${valuation.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : <span className="text-neutral-600">—</span>}
            </div>
            {valuation != null && form.purchase_price && (() => {
              const cost = parseFloat(form.amount) * parseFloat(form.purchase_price);
              if (!isFinite(cost) || cost <= 0) return null;
              const pnl = valuation - cost;
              const pct = (pnl / cost) * 100;
              const pos = pnl >= 0;
              return (
                <div className={`text-xs font-medium mt-0.5 ${pos ? "text-green-400" : "text-red-400"}`}>
                  {pos ? "+" : ""}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })} ({pos ? "+" : ""}{pct.toFixed(2)}%)
                </div>
              );
            })()}
          </div>
        </div>

        <Textarea
          label="Notes"
          placeholder="Thesis, plan, stop, anything you want to remember…"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </form>
    </Modal>
  );
}
