import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function TradesPage() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [trades, setTrades] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    symbol: "",
    strategy: "",
    trade_date: "",
    close_date: "",
    entry_price: "",
    exit_price: "",
    position_size: "",
    fees: "0",
    notes: "",
    tags: ""
  });

  useEffect(() => {
    fetchTrades();
    fetchStrategies();
  }, []);

  const fetchTrades = async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const res = await fetch("http://127.0.0.1:8000/api/trades/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      const data = await res.json();
      setTrades(data);
    } catch (error) {
      console.error("Failed to fetch trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStrategies = async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const res = await fetch("http://127.0.0.1:8000/api/strategies/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      const data = await res.json();
      setStrategies(data);
    } catch (error) {
      console.error("Failed to fetch strategies:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      await fetch("http://127.0.0.1:8000/api/trades/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify(formData),
      });
      setShowForm(false);
      setFormData({
        symbol: "", strategy: "", trade_date: "", close_date: "",
        entry_price: "", exit_price: "", position_size: "", fees: "0", notes: "", tags: ""
      });
      fetchTrades();
    } catch (error) {
      console.error("Failed to add trade:", error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-semibold">Trading Journal</h1>
              <nav className="hidden md:flex gap-6">
                <Link to="/dashboard" className="text-sm text-neutral-600 hover:text-neutral-900">Dashboard</Link>
                <Link to="/trades" className="text-sm font-medium text-neutral-900">Trades</Link>
                <Link to="/analytics" className="text-sm text-neutral-600 hover:text-neutral-900">Analytics</Link>
              </nav>
            </div>
            <button onClick={() => { logout(); nav("/"); }} className="text-sm text-neutral-600 hover:text-neutral-900">Logout</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Trades</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {showForm ? "Cancel" : "+ Add Trade"}
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">New Trade</h3>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Symbol</label>
                <input name="symbol" value={formData.symbol} onChange={handleChange} required
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" placeholder="EURUSD" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Strategy</label>
                <select name="strategy" value={formData.strategy} onChange={handleChange}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  <option value="">None</option>
                  {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Entry Date</label>
                <input type="datetime-local" name="trade_date" value={formData.trade_date} onChange={handleChange} required
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Exit Date (Optional)</label>
                <input type="datetime-local" name="close_date" value={formData.close_date} onChange={handleChange}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Entry Price</label>
                <input type="number" step="0.0001" name="entry_price" value={formData.entry_price} onChange={handleChange} required
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Exit Price</label>
                <input type="number" step="0.0001" name="exit_price" value={formData.exit_price} onChange={handleChange}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Position Size</label>
                <input type="number" name="position_size" value={formData.position_size} onChange={handleChange} required
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Fees</label>
                <input type="number" step="0.01" name="fees" value={formData.fees} onChange={handleChange}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Tags (comma-separated)</label>
                <input name="tags" value={formData.tags} onChange={handleChange}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" placeholder="breakout, london-session" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
                  Add Trade
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-neutral-500">Loading...</div>
        ) : trades.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-neutral-500 mb-4">No trades yet</div>
            <button onClick={() => setShowForm(true)} className="text-sm text-neutral-900 underline">Add your first trade</button>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Symbol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Entry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Exit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Size</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600">P&L</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600">P&L %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {trades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-sm">{new Date(trade.trade_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm font-medium">{trade.symbol}</td>
                      <td className="px-4 py-3 text-sm">${trade.entry_price}</td>
                      <td className="px-4 py-3 text-sm">{trade.exit_price ? `$${trade.exit_price}` : "-"}</td>
                      <td className="px-4 py-3 text-sm">{trade.position_size}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${parseFloat(trade.pnl).toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${trade.pnl_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(trade.pnl_percent).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}