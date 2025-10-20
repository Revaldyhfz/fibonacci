import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function TradesPage() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [trades, setTrades] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    symbol: "", strategy: "", trade_date: "", close_date: "",
    entry_price: "", exit_price: "", position_size: "", fees: "0", notes: "", tags: ""
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
      const dataToSubmit = {
        ...formData,
        trade_date: formData.trade_date || `${selectedDay}T12:00:00`
      };
      
      await fetch("http://127.0.0.1:8000/api/trades/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify(dataToSubmit),
      });
      setShowAddModal(false);
      setFormData({
        symbol: "", strategy: "", trade_date: "", close_date: "",
        entry_price: "", exit_price: "", position_size: "", fees: "0", notes: "", tags: ""
      });
      await fetchTrades();
    } catch (error) {
      console.error("Failed to add trade:", error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDeleteTrade = async (tradeId) => {
    if (!window.confirm("Are you sure you want to delete this trade?")) return;
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      await fetch(`http://127.0.0.1:8000/api/trades/${tradeId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      await fetchTrades();
    } catch (error) {
      console.error("Failed to delete trade:", error);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getTradesForDay = (day) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return trades.filter(trade => {
      const tradeDate = new Date(trade.trade_date).toISOString().split('T')[0];
      return tradeDate === dateStr;
    });
  };

  const getDayPnL = (dayTrades) => {
    return dayTrades.reduce((sum, trade) => sum + parseFloat(trade.pnl || 0), 0);
  };

  const getDayColor = (pnl) => {
    if (pnl > 0) return 'bg-emerald-500/10 border-emerald-500/30';
    if (pnl < 0) return 'bg-red-500/10 border-red-500/30';
    return 'bg-[#141414] border-neutral-800';
  };

  const generateCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 sm:h-28 md:h-32 bg-[#0a0a0a]"></div>);
    }

    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayTrades = getTradesForDay(day);
      const pnl = getDayPnL(dayTrades);
      const isToday = new Date().getDate() === day && 
                      new Date().getMonth() === currentDate.getMonth() &&
                      new Date().getFullYear() === currentDate.getFullYear();

      days.push(
        <div
          key={day}
          onClick={() => {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            setSelectedDay(dateStr);
            setShowDayModal(true);
          }}
          className={`h-20 sm:h-28 md:h-32 ${getDayColor(pnl)} border rounded-lg p-1.5 sm:p-2 md:p-3 cursor-pointer hover:border-neutral-600 transition-all ${isToday ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex flex-col h-full">
            <div className="text-xs sm:text-sm md:text-base font-semibold text-white mb-0.5 sm:mb-1">{day}</div>
            {dayTrades.length > 0 && (
              <>
                <div className="text-[10px] sm:text-xs text-neutral-400 mb-0.5 sm:mb-1 truncate">
                  {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}
                </div>
                <div className={`text-xs sm:text-sm md:text-base font-bold mt-auto truncate ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${pnl.toFixed(0)}
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNamesShort = ["S", "M", "T", "W", "T", "F", "S"];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-[#141414]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-8">
              <h1 className="text-lg sm:text-xl font-bold text-white">Trading Journal</h1>
              <nav className="hidden md:flex gap-6">
                <Link to="/dashboard" className="text-sm text-neutral-400 hover:text-white transition-colors">Dashboard</Link>
                <Link to="/trades" className="text-sm font-medium text-white">Trades</Link>
                <Link to="/analytics" className="text-sm text-neutral-400 hover:text-white transition-colors">Analytics</Link>
              </nav>
            </div>
            <button onClick={() => { logout(); nav("/"); }} className="text-sm text-neutral-400 hover:text-white transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-2 sm:px-4 py-4 sm:py-8 lg:px-8">
        {/* Calendar Header */}
        <div className="flex flex-col gap-4 mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Trading Calendar</h2>
              <p className="text-sm text-neutral-400">Tap any day to view or add trades</p>
            </div>
            <button
              onClick={() => {
                setSelectedDay(null);
                setShowAddModal(true);
              }}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm sm:text-base font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all"
            >
              + Add Trade
            </button>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 bg-[#141414] border border-neutral-800 rounded-xl p-3 sm:p-4">
          <button
            onClick={prevMonth}
            className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg sm:text-2xl font-bold text-white">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <button
            onClick={nextMonth}
            className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-[#141414] border border-neutral-800 rounded-xl p-2 sm:p-4 md:p-6">
          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-4 mb-2 sm:mb-4">
            {dayNames.map((day, idx) => (
              <div key={day} className="text-center text-[10px] sm:text-sm font-semibold text-neutral-400 py-1 sm:py-2">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{dayNamesShort[idx]}</span>
              </div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-4">
            {generateCalendar()}
          </div>
        </div>
      </main>

      {/* Day Detail Modal */}
      {showDayModal && selectedDay && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowDayModal(false)}>
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#141414] border-b border-neutral-800 p-4 sm:p-6 flex items-center justify-between">
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                {new Date(selectedDay).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <button onClick={() => setShowDayModal(false)} className="text-neutral-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 sm:p-6">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full mb-4 sm:mb-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm sm:text-base font-medium rounded-lg transition-all"
              >
                + Add Trade for This Day
              </button>

              {getTradesForDay(parseInt(selectedDay.split('-')[2])).length === 0 ? (
                <div className="text-center py-12 text-neutral-400">
                  No trades recorded for this day
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {getTradesForDay(parseInt(selectedDay.split('-')[2])).map((trade) => (
                    <div key={trade.id} className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-3 sm:p-4 hover:border-neutral-700 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-base sm:text-lg font-bold text-white">{trade.symbol}</h4>
                          <p className="text-xs sm:text-sm text-neutral-400">{new Date(trade.trade_date).toLocaleTimeString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-lg sm:text-xl font-bold ${parseFloat(trade.pnl) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            ${parseFloat(trade.pnl).toFixed(2)}
                          </div>
                          <button
                            onClick={() => handleDeleteTrade(trade.id)}
                            className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div>
                          <span className="text-neutral-400">Entry:</span>
                          <span className="ml-2 text-white font-medium">${trade.entry_price}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">Exit:</span>
                          <span className="ml-2 text-white font-medium">${trade.exit_price || '-'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">Size:</span>
                          <span className="ml-2 text-white font-medium">{trade.position_size}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">P&L %:</span>
                          <span className={`ml-2 font-medium ${parseFloat(trade.pnl_percent) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {parseFloat(trade.pnl_percent).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      {trade.notes && (
                        <p className="mt-3 text-xs sm:text-sm text-neutral-400 italic">{trade.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Trade Modal - Keep existing modal code */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#141414] border-b border-neutral-800 p-4 sm:p-6 flex items-center justify-between">
              <h3 className="text-xl sm:text-2xl font-bold text-white">Add New Trade</h3>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-6">
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Symbol</label>
                  <input
                    name="symbol"
                    value={formData.symbol}
                    onChange={handleChange}
                    required
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base placeholder-neutral-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="EURUSD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Strategy</label>
                  <select
                    name="strategy"
                    value={formData.strategy}
                    onChange={handleChange}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Entry Date</label>
                  <input
                    type="datetime-local"
                    name="trade_date"
                    value={formData.trade_date || (selectedDay ? `${selectedDay}T12:00` : '')}
                    onChange={handleChange}
                    required
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Exit Date (Optional)</label>
                  <input
                    type="datetime-local"
                    name="close_date"
                    value={formData.close_date}
                    onChange={handleChange}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Entry Price</label>
                  <input
                    type="number"
                    step="0.0001"
                    name="entry_price"
                    value={formData.entry_price}
                    onChange={handleChange}
                    required
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Exit Price</label>
                  <input
                    type="number"
                    step="0.0001"
                    name="exit_price"
                    value={formData.exit_price}
                    onChange={handleChange}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Position Size</label>
                  <input
                    type="number"
                    name="position_size"
                    value={formData.position_size}
                    onChange={handleChange}
                    required
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Fees</label>
                  <input
                    type="number"
                    step="0.01"
                    name="fees"
                    value={formData.fees}
                    onChange={handleChange}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Tags (comma-separated)</label>
                  <input
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base placeholder-neutral-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="breakout, london-session"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm sm:text-base placeholder-neutral-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 sm:mt-6 w-full py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm sm:text-base font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all"
              >
                Add Trade
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}