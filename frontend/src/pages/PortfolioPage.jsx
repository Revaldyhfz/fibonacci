import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import axios from "axios";

export default function PortfolioPage() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [assets, setAssets] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [timeRange, setTimeRange] = useState(7);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const chartContainerRef = useRef(null);
  const [formData, setFormData] = useState({
    symbol: "",
    coin_id: "",
    amount: "",
    purchase_price: "",
    purchase_date: "",
    notes: ""
  });

  useEffect(() => {
    fetchPortfolio();
  }, []);

  useEffect(() => {
    if (portfolio?.assets && portfolio.assets.length > 0) {
      fetchHistoryData();
    }
  }, [portfolio?.assets, timeRange]);

  // TradingView Chart Effect
  useEffect(() => {
    if (showChartModal && selectedCoin && chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';
      
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => {
        if (window.TradingView) {
          new window.TradingView.widget({
            container_id: chartContainerRef.current.id,
            width: '100%',
            height: 500,
            symbol: `BINANCE:${selectedCoin.symbol}USDT`,
            interval: 'D',
            timezone: 'Etc/UTC',
            theme: 'dark',
            style: '1',
            locale: 'en',
            toolbar_bg: '#0a0a0a',
            enable_publishing: false,
            hide_top_toolbar: false,
            hide_legend: false,
            save_image: false,
            backgroundColor: '#0a0a0a',
            gridColor: '#1a1a1a',
            studies: [
              'MASimple@tv-basicstudies',
              'RSI@tv-basicstudies'
            ],
            allow_symbol_change: true
          });
        }
      };
      document.body.appendChild(script);

      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, [showChartModal, selectedCoin]);

  const fetchPortfolio = async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const headers = { Authorization: `Bearer ${tokens.access}` };
      
      const [assetsRes, portfolioRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/api/crypto-assets/", { headers }),
        axios.get("http://127.0.0.1:8000/api/crypto-assets/portfolio_summary/", { headers })
      ]);
      
      setAssets(assetsRes.data);
      setPortfolio(portfolioRes.data);
    } catch (error) {
      console.error("Failed to fetch portfolio:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryData = async () => {
    setChartLoading(true);
    try {
      const assetList = portfolio.assets.map(asset => ({
        symbol: asset.symbol,
        coin_id: asset.coin_id,
        amount: asset.amount
      }));
      
      const res = await axios.post(
        `http://127.0.0.1:8002/portfolio/history?days=${timeRange}`,
        assetList,
        { timeout: 20000 }
      );
      
      // Format data for recharts
      const formattedData = res.data.history.map(point => ({
        timestamp: point.timestamp,
        date: new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: timeRange === 1 ? '2-digit' : undefined,
          minute: timeRange === 1 ? '2-digit' : undefined
        }),
        value: point.value,
        fullDate: new Date(point.date).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }));
      
      setHistoryData(formattedData);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setChartLoading(false);
    }
  };

  const searchCrypto = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const res = await axios.get(`http://127.0.0.1:8002/search/${query}`);
      setSearchResults(res.data.results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.coin_id) {
      alert("Please select a cryptocurrency from the search results");
      return;
    }
    
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      await axios.post(
        "http://127.0.0.1:8000/api/crypto-assets/",
        formData,
        { headers: { Authorization: `Bearer ${tokens.access}` } }
      );
      setShowAddModal(false);
      setFormData({ symbol: "", coin_id: "", amount: "", purchase_price: "", purchase_date: "", notes: "" });
      setSearchResults([]);
      await fetchPortfolio();
    } catch (error) {
      console.error("Failed to add asset:", error);
      alert(error.response?.data?.detail || error.response?.data?.symbol?.[0] || "Failed to add asset");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this asset?")) return;
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      await axios.delete(
        `http://127.0.0.1:8000/api/crypto-assets/${id}/`,
        { headers: { Authorization: `Bearer ${tokens.access}` } }
      );
      await fetchPortfolio();
    } catch (error) {
      console.error("Failed to delete asset:", error);
    }
  };

  const openChart = (asset) => {
    setSelectedCoin(asset);
    setShowChartModal(true);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#141414] border border-neutral-700 rounded-lg p-3 shadow-xl">
          <div className="text-xs text-neutral-400 mb-1">{data.fullDate}</div>
          <div className="text-lg font-bold text-emerald-500">
            ${data.value.toLocaleString()}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-neutral-600 border-t-blue-500 mb-4"></div>
          <div className="text-neutral-400">Loading portfolio...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-[#141414]/95 backdrop-blur-sm shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Trading Journal
              </h1>
              <nav className="hidden md:flex gap-6">
                <Link to="/dashboard" className="text-sm text-neutral-400 hover:text-white transition-colors">Dashboard</Link>
                <Link to="/trades" className="text-sm text-neutral-400 hover:text-white transition-colors">Trades</Link>
                <Link to="/analytics" className="text-sm text-neutral-400 hover:text-white transition-colors">Analytics</Link>
                <Link to="/portfolio" className="text-sm font-medium text-white">Portfolio</Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-neutral-400">
                <span className="hidden sm:inline">Welcome, </span>
                <span className="font-medium text-white">{user?.username || 'Trader'}</span>
              </div>
              <button onClick={() => { logout(); nav("/"); }} className="text-sm px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="my-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Crypto Portfolio</h2>
              <p className="text-sm text-neutral-400">Track 10,000+ cryptocurrencies in real-time</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all"
            >
              + Add Asset
            </button>
          </div>

          {/* Portfolio Summary Cards */}
          {portfolio && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                <div className="text-xs text-neutral-400 mb-1">Total Value</div>
                <div className="text-3xl font-bold text-white">
                  ${portfolio.total_value_usd.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                <div className="text-xs text-neutral-400 mb-1">Total Cost</div>
                <div className="text-3xl font-bold text-white">
                  ${portfolio.total_cost.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                <div className="text-xs text-neutral-400 mb-1">Total P&L</div>
                <div className={`text-3xl font-bold ${portfolio.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${portfolio.total_pnl.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                <div className="text-xs text-neutral-400 mb-1">P&L %</div>
                <div className={`text-3xl font-bold ${portfolio.total_pnl_percent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {portfolio.total_pnl_percent.toFixed(2)}%
                </div>
              </div>
            </div>
          )}

          {/* Portfolio Value Chart */}
          {portfolio?.assets && portfolio.assets.length > 0 && (
            <div className="bg-[#141414] border border-neutral-800 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Portfolio Value</h3>
                  <p className="text-sm text-neutral-400">Live tracking of your crypto holdings</p>
                </div>
                <div className="flex gap-2">
                  {[
                    { label: '24H', value: 1 },
                    { label: '7D', value: 7 },
                    { label: '30D', value: 30 },
                    { label: '90D', value: 90 }
                  ].map((range) => (
                    <button
                      key={range.value}
                      onClick={() => setTimeRange(range.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        timeRange === range.value
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-[#0a0a0a] border border-neutral-700 text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {chartLoading ? (
                <div className="h-80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-neutral-600 border-t-blue-500 mb-2"></div>
                    <div className="text-sm text-neutral-400">Loading chart data...</div>
                  </div>
                </div>
              ) : historyData.length > 0 ? (
                <div style={{ width: '100%', height: 320 }}>
                  <LineChart width={800} height={320} data={historyData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#525252"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#525252"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={false}
                      fill="url(#colorValue)"
                    />
                  </LineChart>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center">
                  <div className="text-center text-neutral-400">
                    <svg className="w-16 h-16 mx-auto mb-3 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p>No chart data available</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Assets Table */}
          {portfolio?.assets && portfolio.assets.length > 0 ? (
            <div className="bg-[#141414] border border-neutral-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0a0a0a]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase">Asset</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase">Value</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase">24h %</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase">P&L</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {portfolio.assets.map((asset, idx) => (
                      <tr key={idx} className="hover:bg-[#0a0a0a] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{asset.symbol}</div>
                          <div className="text-xs text-neutral-500">{asset.coin_id}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-neutral-300">
                          {asset.amount}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-neutral-300">
                          ${asset.current_price?.toLocaleString() || '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-white">
                          ${asset.current_value?.toLocaleString() || '-'}
                        </td>
                        <td className={`px-4 py-3 text-right text-sm font-medium ${asset.change_24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {asset.change_24h?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          {asset.pnl !== null ? (
                            <div>
                              <div className={`text-sm font-bold ${asset.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                ${asset.pnl.toLocaleString()}
                              </div>
                              <div className={`text-xs ${asset.pnl_percent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {asset.pnl_percent?.toFixed(2)}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openChart(asset)}
                              className="p-1.5 text-neutral-400 hover:text-blue-500 transition-colors"
                              title="View Chart"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(assets.find(a => a.symbol === asset.symbol)?.id)}
                              className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-[#141414] border border-neutral-800 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">₿</div>
              <h3 className="text-xl font-bold text-white mb-2">No Assets Yet</h3>
              <p className="text-neutral-400 mb-6">Start tracking your crypto portfolio by adding your first asset</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all"
              >
                Add Your First Asset
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#141414] p-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Add Crypto Asset</h3>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  Search Crypto (10,000+ supported)
                </label>
                <input
                  type="text"
                  placeholder="Search Bitcoin, Dogecoin, Shiba Inu..."
                  onChange={(e) => searchCrypto(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {searchLoading && (
                  <div className="mt-2 text-xs text-neutral-400">Searching...</div>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto bg-[#0a0a0a] border border-neutral-700 rounded-lg">
                    {searchResults.map((coin) => (
                      <button
                        key={coin.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, symbol: coin.symbol, coin_id: coin.id });
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-neutral-800 transition-colors flex items-center gap-2"
                      >
                        {coin.thumb && (
                          <img src={coin.thumb} alt={coin.name} className="w-5 h-5 rounded-full" />
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">{coin.name}</div>
                          <div className="text-xs text-neutral-400">{coin.symbol}</div>
                        </div>
                        {coin.market_cap_rank && (
                          <div className="text-xs text-neutral-500">#{coin.market_cap_rank}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {formData.coin_id && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="text-sm text-blue-400">
                    ✓ Selected: <span className="font-bold">{formData.symbol}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.00000001"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="0.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Purchase Price (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="45000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Purchase Date (Optional)</label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Bought during dip"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all"
              >
                Add Asset
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TradingView Chart Modal */}
      {showChartModal && selectedCoin && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowChartModal(false)}>
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedCoin.symbol} Chart</h3>
                <p className="text-sm text-neutral-400">Powered by TradingView</p>
              </div>
              <button onClick={() => setShowChartModal(false)} className="text-neutral-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div id="tradingview_chart" ref={chartContainerRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}