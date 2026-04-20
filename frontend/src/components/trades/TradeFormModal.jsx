import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Input, Select, Textarea } from "../ui/Input";

const EMPTY = {
  symbol: "",
  strategy: "",
  direction: "LONG",
  trade_date: "",
  close_date: "",
  entry_price: "",
  exit_price: "",
  position_size: "",
  fees: "0",
  notes: "",
  tags: "",
};

const QUICK_SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSDT", "ETHUSDT", "SPX", "NDX"];

function Section({ title, hint, children }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0f0f0f] p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">{title}</h4>
        {hint && <span className="text-[10px] text-neutral-500">{hint}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/**
 * TradeFormModal — grouped fields + live P&L preview.
 *
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   onSubmit      (payload) => Promise<void>
 *   strategies    [{ id, name }]
 *   onNewStrategy () => void            // open "new strategy" modal
 *   initial       Partial<form>         // e.g. { trade_date: "2026-04-20T12:00" }
 *   submitting    boolean
 */
export default function TradeFormModal({
  open,
  onClose,
  onSubmit,
  strategies = [],
  onNewStrategy,
  initial,
  submitting = false,
}) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const symbolRef = useRef(null);

  // Reset form whenever the modal opens with fresh initial
  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, ...(initial || {}) });
    setErrors({});
    const t = setTimeout(() => symbolRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, initial]);

  const pnl = useMemo(() => {
    const entry = parseFloat(form.entry_price);
    const exit  = parseFloat(form.exit_price);
    const size  = parseFloat(form.position_size);
    const fees  = parseFloat(form.fees) || 0;
    if (![entry, exit, size].every((v) => !isNaN(v) && isFinite(v))) return null;
    const dir = form.direction === "SHORT" ? -1 : 1;
    const gross = (exit - entry) * size * dir;
    const net = gross - fees;
    const cost = entry * size;
    const pct = cost > 0 ? (net / cost) * 100 : null;
    return { gross, net, pct };
  }, [form.entry_price, form.exit_price, form.position_size, form.direction, form.fees]);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.symbol.trim()) e.symbol = "Symbol required.";
    if (!form.entry_price || isNaN(parseFloat(form.entry_price))) e.entry_price = "Entry required.";
    if (!form.position_size || parseFloat(form.position_size) <= 0) e.position_size = "Size must be > 0.";
    if (!form.trade_date) e.trade_date = "Entry date required.";
    if (form.exit_price && isNaN(parseFloat(form.exit_price))) e.exit_price = "Invalid exit price.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      ...form,
      symbol: form.symbol.trim().toUpperCase(),
      strategy: form.strategy === "" ? null : form.strategy,
      close_date: form.close_date || null,
      exit_price: form.exit_price || null,
    };
    await onSubmit(payload);
  };

  const pickSymbol = (s) => {
    setForm((f) => ({ ...f, symbol: s }));
    // keep focus responsive
    symbolRef.current?.focus();
  };

  const pnlColor = pnl == null ? "text-neutral-400" : pnl.net >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add trade"
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="trade-form" loading={submitting}>
            {submitting ? "Saving…" : "Save trade"}
          </Button>
        </>
      }
    >
      <form id="trade-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Setup */}
        <Section title="Setup" hint="What & why">
          <div className="sm:col-span-2">
            <Input
              ref={symbolRef}
              label="Symbol *"
              name="symbol"
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
              placeholder="XAUUSD"
              error={errors.symbol}
              autoComplete="off"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {QUICK_SYMBOLS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => pickSymbol(s)}
                  className={[
                    "px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors",
                    form.symbol === s
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                      : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Select label="Direction" name="direction" value={form.direction} onChange={change}>
            <option value="LONG">Long (Buy)</option>
            <option value="SHORT">Short (Sell)</option>
          </Select>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Strategy</label>
            <div className="flex gap-2">
              <Select
                name="strategy"
                value={form.strategy}
                onChange={change}
                className="flex-1"
              >
                <option value="">None</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={onNewStrategy}
              >
                + New
              </Button>
            </div>
          </div>
        </Section>

        {/* Entry */}
        <Section title="Entry" hint="When you got in">
          <Input
            label="Entry date & time *"
            type="datetime-local"
            name="trade_date"
            value={form.trade_date}
            onChange={change}
            error={errors.trade_date}
          />
          <Input
            label="Entry price *"
            type="number"
            step="0.0001"
            name="entry_price"
            value={form.entry_price}
            onChange={change}
            error={errors.entry_price}
            placeholder="0.0000"
          />
          <Input
            label="Position size *"
            type="number"
            step="0.0001"
            name="position_size"
            value={form.position_size}
            onChange={change}
            error={errors.position_size}
            placeholder="0.01 lots / shares / contracts"
          />
          <Input
            label="Fees"
            type="number"
            step="0.01"
            name="fees"
            value={form.fees}
            onChange={change}
            placeholder="0.00"
          />
        </Section>

        {/* Exit + live PnL preview */}
        <Section title="Exit" hint="Leave blank if still open">
          <Input
            label="Exit date & time"
            type="datetime-local"
            name="close_date"
            value={form.close_date}
            onChange={change}
          />
          <Input
            label="Exit price"
            type="number"
            step="0.0001"
            name="exit_price"
            value={form.exit_price}
            onChange={change}
            error={errors.exit_price}
            placeholder="0.0000"
          />
          <div className="sm:col-span-2 rounded-lg bg-gradient-to-br from-neutral-900 to-[#0a0a0a] border border-neutral-800 p-3 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
              Live P&L preview
            </div>
            <div className="text-right">
              {pnl == null ? (
                <div className="text-sm text-neutral-600">Fill entry, exit & size…</div>
              ) : (
                <>
                  <div className={`text-xl font-bold tabular-nums ${pnlColor}`}>
                    {pnl.net >= 0 ? "+" : "-"}${Math.abs(pnl.net).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-xs font-medium tabular-nums ${pnlColor}`}>
                    {pnl.pct != null && `${pnl.pct >= 0 ? "+" : ""}${pnl.pct.toFixed(2)}%`}
                    {pnl.gross !== pnl.net && (
                      <span className="ml-2 text-neutral-500">
                        gross {pnl.gross >= 0 ? "+" : "-"}${Math.abs(pnl.gross).toFixed(2)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </Section>

        {/* Meta */}
        <Section title="Meta" hint="Tags & notes for review">
          <div className="sm:col-span-2">
            <Input
              label="Tags (comma-separated)"
              name="tags"
              value={form.tags}
              onChange={change}
              placeholder="breakout, london-session, a-plus-setup"
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={change}
              placeholder="Setup quality, emotions, mistakes, what to repeat / avoid…"
            />
          </div>
        </Section>
      </form>
    </Modal>
  );
}
