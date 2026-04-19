import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../components/layout/Header";
import Card, { Stat } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Spinner from "../components/ui/Spinner";
import { Input, Select, Textarea } from "../components/ui/Input";
import { useToast } from "../context/ToastContext";

const EMPTY_TRADE = {
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

const EMPTY_STRATEGY = { name: "", description: "" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function authedFetch(url, opts = {}) {
  const tokens = JSON.parse(localStorage.getItem("tokens") || "null");
  const auth = tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {};
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...(opts.headers || {}),
    },
  });
}

function formatDayDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TradesPage() {
  const toast = useToast();

  const [trades, setTrades] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [strategySaving, setStrategySaving] = useState(false);

  const [form, setForm] = useState(EMPTY_TRADE);
  const [strategyForm, setStrategyForm] = useState(EMPTY_STRATEGY);

  const loadTrades = useCallback(async () => {
    try {
      const res = await authedFetch("/api/trades/");
      if (!res.ok) throw new Error("Failed to load trades");
      setTrades(await res.json());
    } catch (err) {
      toast.error(err.message || "Couldn't load trades");
    }
  }, [toast]);

  const loadStrategies = useCallback(async () => {
    try {
      const res = await authedFetch("/api/strategies/");
      if (!res.ok) throw new Error("Failed to load strategies");
      setStrategies(await res.json());
    } catch (err) {
      toast.error(err.message || "Couldn't load strategies");
    }
  }, [toast]);

  useEffect(() => {
    Promise.all([loadTrades(), loadStrategies()]).finally(() => setLoading(false));
  }, [loadTrades, loadStrategies]);

  const tradesByDay = useMemo(() => {
    const map = new Map();
    for (const trade of trades) {
      const key = new Date(trade.trade_date).toISOString().split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(trade);
    }
    return map;
  }, [trades]);

  const monthStats = useMemo(() => {
    const ym = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const entries = trades.filter((t) =>
      (t.trade_date || "").startsWith(ym)
    );
    const pnl = entries.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const wins = entries.filter((t) => parseFloat(t.pnl || 0) > 0).length;
    const losses = entries.filter((t) => parseFloat(t.pnl || 0) < 0).length;
    return { total: entries.length, pnl, wins, losses };
  }, [trades, currentDate]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const openAddModal = (dayKey = null) => {
    setSelectedDay(dayKey);
    setForm({ ...EMPTY_TRADE, trade_date: dayKey ? `${dayKey}T12:00` : "" });
    setAddModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        strategy: form.strategy === "" ? null : form.strategy,
        close_date: form.close_date || null,
        exit_price: form.exit_price || null,
        trade_date: form.trade_date || (selectedDay ? `${selectedDay}T12:00:00` : ""),
      };
      const res = await authedFetch("/api/trades/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = typeof data === "object"
          ? Object.values(data).flat()[0] || "Failed to save trade"
          : "Failed to save trade";
        throw new Error(msg);
      }
      toast.success("Trade added");
      setAddModalOpen(false);
      setForm(EMPTY_TRADE);
      await loadTrades();
    } catch (err) {
      toast.error(err.message || "Couldn't add trade");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await authedFetch(`/api/trades/${confirmDelete}/`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
      toast.success("Trade deleted");
      setConfirmDelete(null);
      await loadTrades();
    } catch (err) {
      toast.error(err.message || "Delete failed");
    }
  };

  const handleStrategySubmit = async (e) => {
    e.preventDefault();
    setStrategySaving(true);
    try {
      const res = await authedFetch("/api/strategies/", {
        method: "POST",
        body: JSON.stringify(strategyForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = typeof data === "object"
          ? Object.values(data).flat()[0] || "Failed to save strategy"
          : "Failed to save strategy";
        throw new Error(msg);
      }
      const created = await res.json();
      toast.success("Strategy created");
      setStrategyModalOpen(false);
      setStrategyForm(EMPTY_STRATEGY);
      await loadStrategies();
      // Pre-select the newly created strategy if the trade modal is open.
      if (addModalOpen && created?.id) {
        setForm((f) => ({ ...f, strategy: String(created.id) }));
      }
    } catch (err) {
      toast.error(err.message || "Couldn't save strategy");
    } finally {
      setStrategySaving(false);
    }
  };

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();
  const firstDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="aspect-square" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayTrades = tradesByDay.get(dateKey) || [];
    const pnl = dayTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const today = new Date();
    const isToday =
      today.getDate() === day &&
      today.getMonth() === currentDate.getMonth() &&
      today.getFullYear() === currentDate.getFullYear();
    const tone =
      pnl > 0
        ? "bg-emerald-500/10 border-emerald-500/40"
        : pnl < 0
          ? "bg-red-500/10 border-red-500/40"
          : "bg-[#141414] border-neutral-800";
    calendarCells.push(
      <button
        key={day}
        type="button"
        onClick={() => {
          setSelectedDay(dateKey);
          setDayModalOpen(true);
        }}
        className={`aspect-square ${tone} border rounded-lg p-1 sm:p-1.5 text-left hover:border-neutral-500 transition-colors ${isToday ? "ring-2 ring-blue-500" : ""} flex flex-col`}
      >
        <div className="text-[11px] sm:text-xs font-semibold text-white">{day}</div>
        {dayTrades.length > 0 && (
          <>
            <div className="text-[9px] sm:text-[10px] text-neutral-400 leading-tight">
              {dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}
            </div>
            <div
              className={`text-[10px] sm:text-xs font-bold mt-auto tabular-nums ${
                pnl >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(0)}
            </div>
          </>
        )}
      </button>
    );
  }

  const selectedDayTrades = selectedDay
    ? tradesByDay.get(selectedDay) || []
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-12">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Trading Calendar</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Click a day to review trades or log a new one
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-initial"
              onClick={() => {
                setStrategyForm(EMPTY_STRATEGY);
                setStrategyModalOpen(true);
              }}
            >
              New Strategy
            </Button>
            <Button className="flex-1 sm:flex-initial" onClick={() => openAddModal()}>
              + Add Trade
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-16">
            <Spinner label="Loading trades…" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Stat label="Trades this month" value={monthStats.total} />
              <Stat label="Wins" value={monthStats.wins} tone="positive" />
              <Stat label="Losses" value={monthStats.losses} tone="negative" />
              <Stat
                label="Month P&L"
                value={`${monthStats.pnl >= 0 ? "+" : "-"}$${Math.abs(monthStats.pnl).toFixed(2)}`}
                tone={monthStats.pnl >= 0 ? "positive" : "negative"}
              />
            </div>

            <Card padding="p-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() =>
                    setCurrentDate(
                      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
                    )
                  }
                  className="p-2 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300"
                  aria-label="Previous month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <button
                  onClick={() =>
                    setCurrentDate(
                      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
                    )
                  }
                  className="p-2 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300"
                  aria-label="Next month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] sm:text-xs font-semibold text-neutral-400 py-1"
                  >
                    <span className="hidden sm:inline">{d}</span>
                    <span className="sm:hidden">{d[0]}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">{calendarCells}</div>
            </Card>
          </>
        )}
      </main>

      {/* Day details modal */}
      <Modal
        open={dayModalOpen}
        onClose={() => setDayModalOpen(false)}
        title={selectedDay ? formatDayDate(selectedDay) : "Day"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDayModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => openAddModal(selectedDay)}>
              + Add Trade
            </Button>
          </>
        }
      >
        {selectedDayTrades.length === 0 ? (
          <div className="text-center py-10 text-neutral-400">
            No trades recorded for this day
          </div>
        ) : (
          <div className="space-y-3">
            {selectedDayTrades.map((trade) => {
              const pnlValue = parseFloat(trade.pnl || 0);
              const pnlPct = parseFloat(trade.pnl_percent || 0);
              return (
                <div
                  key={trade.id}
                  className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-white truncate">
                          {trade.symbol}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            trade.direction === "LONG"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-orange-500/20 text-orange-300"
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(trade.trade_date).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`text-lg font-bold tabular-nums ${
                          pnlValue >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {pnlValue >= 0 ? "+" : "-"}${Math.abs(pnlValue).toFixed(2)}
                      </div>
                      <button
                        onClick={() => setConfirmDelete(trade.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        aria-label="Delete trade"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-400">Entry:</span>{" "}
                      <span className="text-white font-medium tabular-nums">
                        ${trade.entry_price}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Exit:</span>{" "}
                      <span className="text-white font-medium tabular-nums">
                        {trade.exit_price ? `$${trade.exit_price}` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Size:</span>{" "}
                      <span className="text-white font-medium tabular-nums">
                        {trade.position_size}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400">P&L %:</span>{" "}
                      <span
                        className={`font-medium tabular-nums ${
                          pnlPct >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {pnlPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  {trade.notes && (
                    <p className="mt-2 text-xs text-neutral-400 italic border-l-2 border-neutral-700 pl-2">
                      {trade.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Add trade modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Trade"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-trade-form" loading={submitting}>
              {submitting ? "Saving…" : "Save Trade"}
            </Button>
          </>
        }
      >
        <form id="add-trade-form" onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Symbol"
            name="symbol"
            value={form.symbol}
            onChange={handleChange}
            placeholder="EURUSD"
            required
          />
          <Select
            label="Direction"
            name="direction"
            value={form.direction}
            onChange={handleChange}
          >
            <option value="LONG">Long (Buy)</option>
            <option value="SHORT">Short (Sell)</option>
          </Select>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Strategy
            </label>
            <div className="flex gap-2">
              <select
                name="strategy"
                value={form.strategy}
                onChange={handleChange}
                className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">None</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  setStrategyForm(EMPTY_STRATEGY);
                  setStrategyModalOpen(true);
                }}
              >
                + New
              </Button>
            </div>
          </div>
          <Input
            label="Entry Date & Time"
            type="datetime-local"
            name="trade_date"
            value={form.trade_date}
            onChange={handleChange}
            required
          />
          <Input
            label="Exit Date & Time"
            type="datetime-local"
            name="close_date"
            value={form.close_date}
            onChange={handleChange}
          />
          <Input
            label="Entry Price"
            type="number"
            step="0.0001"
            name="entry_price"
            value={form.entry_price}
            onChange={handleChange}
            required
          />
          <Input
            label="Exit Price"
            type="number"
            step="0.0001"
            name="exit_price"
            value={form.exit_price}
            onChange={handleChange}
          />
          <Input
            label="Position Size"
            type="number"
            step="0.0001"
            name="position_size"
            value={form.position_size}
            onChange={handleChange}
            required
          />
          <Input
            label="Fees"
            type="number"
            step="0.01"
            name="fees"
            value={form.fees}
            onChange={handleChange}
          />
          <div className="sm:col-span-2">
            <Input
              label="Tags (comma-separated)"
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="breakout, london-session"
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={handleChange}
              placeholder="Setup quality, emotions, mistakes…"
            />
          </div>
        </form>
      </Modal>

      {/* New strategy modal */}
      <Modal
        open={strategyModalOpen}
        onClose={() => setStrategyModalOpen(false)}
        title="New Strategy"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStrategyModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-strategy-form" loading={strategySaving}>
              Save
            </Button>
          </>
        }
      >
        <form id="add-strategy-form" onSubmit={handleStrategySubmit} className="space-y-4">
          <Input
            label="Name"
            name="name"
            value={strategyForm.name}
            onChange={(e) =>
              setStrategyForm((s) => ({ ...s, name: e.target.value }))
            }
            required
          />
          <Textarea
            label="Description"
            name="description"
            rows={4}
            value={strategyForm.description}
            onChange={(e) =>
              setStrategyForm((s) => ({ ...s, description: e.target.value }))
            }
            placeholder="Rules, entry criteria, exit criteria…"
          />
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete trade?"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-300">
          This will permanently remove the trade from your journal. This action
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
