import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from "axios";

// Debounce hook to prevent rapid API calls
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

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
  const abortControllerRef = useRef(null);
  const cacheRef = useRef({}); // Client-side cache for history data
  const [formData, setFormData] = useState({
    symbol: "",
    coin_id: "",
    amount: "",
    purchase_price: "",
    purchase_date: "",
    notes: ""
  });

  // Debounce timeRange to prevent race conditions
  const debouncedTimeRange = useDebounce(timeRange, 300);

  // Fetch initial portfolio and asset list
  useEffect(() => {
    fetchPortfolio();
  }, []);

  // Fetch history data when portfolio assets or debounced time range changes
  useEffect(() => {
    if (!portfolio?.assets || portfolio.assets.length === 0) {
      setHistoryData([]);
      setChartLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log("🔄 Cancelled previous history fetch request");
    }

    // Check cache first - instant response!
    const cacheKey = `${debouncedTimeRange}`;
    if (cacheRef.current[cacheKey]) {
      console.log(`✅ Using cached data for ${debouncedTimeRange}D`);
      setHistoryData(cacheRef.current[cacheKey]);
      setChartLoading(false);
      return; // Don't fetch, use cache!
    }

    // Create new abort controller and fetch
    abortControllerRef.current = new AbortController();
    fetchHistoryData(debouncedTimeRange, abortControllerRef.current.signal);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [portfolio?.assets, debouncedTimeRange]);

  // TradingView Chart Effect
  useEffect(() => {
    let tvScript = null;

    if (showChartModal && selectedCoin && chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';

      tvScript = document.createElement('script');
      tvScript.src = 'https://s3.tradingview.com/tv.js';
      tvScript.async = true;
      tvScript.onload = () => {
        if (window.TradingView && chartContainerRef.current) {
          try {
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
              studies: ['MASimple@tv-basicstudies', 'RSI@tv-basicstudies'],
              allow_symbol_change: true
            });
          } catch (error) {
            console.error("TradingView widget initialization failed:", error);
            if (chartContainerRef.current) {
              chartContainerRef.current.innerHTML = '<p class="text-red-500 text-center">Failed to load TradingView chart.</p>';
            }
          }
        } else {
          console.error("TradingView library not loaded or chart container not found.");
          if (chartContainerRef.current) {
            chartContainerRef.current.innerHTML = '<p class="text-red-500 text-center">Failed to load TradingView library.</p>';
          }
        }
      };
      tvScript.onerror = () => {
        console.error("Failed to load TradingView script.");
        if (chartContainerRef.current) {
          chartContainerRef.current.innerHTML = '<p class="text-red-500 text-center">Failed to load TradingView script.</p>';
        }
      };

      document.body.appendChild(tvScript);
    }

    return () => {
      if (tvScript && tvScript.parentNode) {
        tvScript.parentNode.removeChild(tvScript);
      }
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = '';
      }
    };
  }, [showChartModal, selectedCoin]);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens?.access) throw new Error("Authentication token not found.");
      const headers = { Authorization: `Bearer ${tokens.access}` };

      const assetsRes = await axios.get("http://127.0.0.1:8000/api/crypto-assets/", { headers });
      setAssets(assetsRes.data || []);

      const portfolioRes = await axios.get("http://127.0.0.1:8000/api/crypto-assets/portfolio_summary/", { headers });
      setPortfolio(portfolioRes.data);

    } catch (error) {
      console.error("Failed to fetch portfolio:", error);
      if (error.response?.status === 401) {
        logout();
        nav("/");
      }
      setPortfolio(null);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryData = async (days, signal) => {
    setChartLoading(true);
    setHistoryData([]); // Clear previous data for better UX

    if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) {
      console.warn("fetchHistoryData called with no portfolio assets.");
      setChartLoading(false);
      return;
    }

    console.log("📦 Portfolio structure:", portfolio);
    console.log("📦 Portfolio assets:", portfolio.assets);

    try {
      // The portfolio.assets from backend already has the correct structure
      // It includes: symbol, coin_id, amount (total_amount aggregated)
      const assetList = portfolio.assets.map(asset => ({
        symbol: asset.symbol,
        coin_id: asset.coin_id,
        amount: asset.amount || 0  // Use amount directly from portfolio.assets
      }));

      console.log("📊 Asset list for history:", assetList);

      const validAssetList = assetList.filter(a => {
        const isValid = a.symbol && a.coin_id && typeof a.amount === 'number' && a.amount > 0;
        if (!isValid) {
          console.warn("Invalid asset filtered out:", a);
        }
        return isValid;
      });

      console.log("✅ Valid assets for history:", validAssetList);

      if (validAssetList.length === 0) {
        console.warn("No valid assets found to fetch history for.");
        setChartLoading(false);
        return;
      }

      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens?.access) throw new Error("Authentication token not found for history fetch.");
      const headers = { Authorization: `Bearer ${tokens.access}` };

      const historyUrl = `http://127.0.0.1:8000/portfolio/portfolio/history?days=${days}`;

      const res = await axios.post(
        historyUrl,
        validAssetList,
        {
          headers: headers,
          timeout: 30000,
          signal: signal
        }
      );

      if (signal?.aborted) {
        console.log("History fetch aborted during processing.");
        return;
      }

      if (res.data.error) {
        console.error("Backend error fetching history:", res.data.error);
        throw new Error(res.data.error);
      }

      const history = res.data?.history;
      if (!Array.isArray(history)) {
        console.error("Invalid history data received:", res.data);
        throw new Error("Invalid history data format received from backend.");
      }

      const formattedData = history.map(point => {
        if (typeof point.timestamp !== 'number' || typeof point.value !== 'number' || !point.date) {
          console.warn("Skipping invalid history point:", point);
          return null;
        }
        const pointDate = new Date(point.date);
        return {
          timestamp: point.timestamp,
          date: pointDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: days <= 2 ? 'numeric' : undefined,
            minute: days <= 2 ? '2-digit' : undefined,
          }),
          value: point.value,
          fullDate: pointDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        };
      }).filter(Boolean);

      // 🔥 SAVE TO CACHE!
      cacheRef.current[days] = formattedData;

      console.log(`✅ Fetched and cached ${formattedData.length} points for ${days}D`);
      if (formattedData.length === 0) {
        console.warn(`Received no valid history data points for ${days} days range.`);
      }

      setHistoryData(formattedData);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("History fetch cancelled:", error.message);
      } else if (!signal?.aborted) {
        console.error("Failed to fetch or process history:", error);
        setHistoryData([]);
      }
    } finally {
      if (!signal?.aborted) {
        setChartLoading(false);
      }
    }
  };

  const searchCrypto = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens?.access) throw new Error("Auth token needed for search.");
      const headers = { Authorization: `Bearer ${tokens.access}` };
      const searchUrl = `http://127.0.0.1:8000/portfolio/search/${query}`;
      const res = await axios.get(searchUrl, { headers });
      setSearchResults(res.data.results || []);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.coin_id || !formData.symbol) {
      alert("Please search and select a cryptocurrency.");
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    const dataToSubmit = {
      ...formData,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      purchase_date: formData.purchase_date ? new Date(formData.purchase_date).toISOString() : null,
      amount: parseFloat(formData.amount)
    };

    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens?.access) throw new Error("Auth token needed to add asset.");
      const headers = { Authorization: `Bearer ${tokens.access}` };

      await axios.post("http://127.0.0.1:8000/api/crypto-assets/", dataToSubmit, { headers });

      setFormData({ symbol: "", coin_id: "", amount: "", purchase_price: "", purchase_date: "", notes: "" });
      setSearchResults([]);
      setShowAddModal(false);
      
      // Clear cache when new asset is added
      cacheRef.current = {};
      
      await fetchPortfolio();
    } catch (error) {
      console.error("Failed to add asset:", error.response?.data || error.message);
      alert("Failed to add asset. See console for details.");
    }
  };

  const handleDelete = async (assetIdToDelete) => {
    if (!window.confirm("Are you sure you want to delete this asset?")) return;

    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens?.access) throw new Error("Auth token needed to delete asset.");
      const headers = { Authorization: `Bearer ${tokens.access}` };

      await axios.delete(
        `http://127.0.0.1:8000/api/crypto-assets/${assetIdToDelete}/`,
        { headers: headers }
      );
      
      // Clear cache when asset is deleted
      cacheRef.current = {};
      
      await fetchPortfolio();
    } catch (error) {
      console.error("Failed to delete asset:", error.response?.data || error.message);
      alert("Failed to delete asset. See console for details.");
    }
  };

  const openChart = (asset) => {
    if (asset && asset.symbol) {
      setSelectedCoin({ symbol: asset.symbol.toUpperCase() });
      setShowChartModal(true);
    } else {
      console.error("Cannot open chart: Invalid asset data", asset);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
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

  const hasAssets = portfolio?.assets && portfolio.assets.length > 0;

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
        {/* Page Header */}
        <div className="my-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Crypto Portfolio</h2>
              <p className="text-sm text-neutral-400">Track 10,000+ cryptocurrencies in real-time</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all"
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
                  ${portfolio.total_value_usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
                </div>
              </div>
              <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                <div className="text-xs text-neutral-400 mb-1">Total Cost</div>
                <div className="text-3xl font-bold text-neutral-300">
                  ${portfolio.total_cost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
                </div>
              </div>
              <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                <div className="text-xs text-neutral-400 mb-1">Total P&L</div>
                <div className={`text-3xl font-bold ${portfolio.total_pnl == null ? 'text-neutral-300' : portfolio.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {portfolio.total_pnl >= 0 ? '+' : ''}${portfolio.total_pnl?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
                </div>
              </div>
              <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                <div className="text-xs text-neutral-400 mb-1">P&L %</div>
                <div className={`text-3xl font-bold ${portfolio.total_pnl_percent == null ? 'text-neutral-300' : portfolio.total_pnl_percent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {portfolio.total_pnl_percent?.toFixed(2) ?? '0.00'}%
                </div>
              </div>
            </div>
          )}

          {/* Portfolio Value Chart */}
          {hasAssets && (
            <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Portfolio Value</h3>
                  <p className="text-sm text-neutral-400 hidden sm:block">Historical performance based on holdings</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: '24H', value: 1 },
                    { label: '7D', value: 7 },
                    { label: '30D', value: 30 },
                    { label: '90D', value: 90 }
                  ].map((range) => (
                    <button
                      key={range.value}
                      onClick={() => setTimeRange(range.value)}
                      disabled={chartLoading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        timeRange === range.value
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-[#0a0a0a] border border-neutral-700 text-neutral-300 hover:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      {range.label}
                      {/* Cache indicator */}
                      {cacheRef.current[range.value] && (
                        <span className="ml-1 text-[10px] opacity-60">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full h-80">
                {chartLoading && debouncedTimeRange === timeRange ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-neutral-600 border-t-blue-500 mb-2"></div>
                      <div className="text-sm text-neutral-400">Loading chart data ({timeRange}D)...</div>
                    </div>
                  </div>
                ) : historyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
                        style={{ fontSize: '10px' }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis
                        stroke="#737373"
                        style={{ fontSize: '10px' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        dx={-10}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#525252', strokeWidth: 1 }}/>
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
                    <p className="text-sm text-neutral-500">This might happen if there were no assets held or price data is missing.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assets Table or Empty State */}
          {hasAssets ? (
            <div className="bg-[#141414] border border-neutral-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-[#0a0a0a]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Asset</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Value</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">24h %</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">P&L</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {portfolio.assets.map((asset, idx) => {
                      const rawAssetEntries = assets.filter(a => a.symbol === asset.symbol);
                      return (
                        <tr key={asset.coin_id || idx} className="hover:bg-[#0a0a0a] transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-semibold text-white">{asset.symbol}</div>
                                <div className="text-xs text-neutral-500">{asset.coin_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-white">{asset.total_amount?.toFixed(6)}</td>
                          <td className="px-4 py-3 text-right text-sm text-white">
                            ${asset.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-white">
                            ${asset.current_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm ${asset.change_24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {asset.change_24h >= 0 ? '+' : ''}{asset.change_24h?.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {asset.pnl !== null ? (
                              <div>
                                <div className={`text-sm font-bold ${asset.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {asset.pnl >= 0 ? '+' : ''}${asset.pnl?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className={`text-xs ${asset.pnl_percent >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                  {asset.pnl_percent?.toFixed(2)}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-neutral-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openChart(asset)}
                                className="p-1.5 text-neutral-400 hover:text-blue-500 transition-colors"
                                title="View Chart"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                                </svg>
                              </button>
                              {rawAssetEntries.length > 0 && (
                                <button
                                  onClick={() => handleDelete(rawAssetEntries[0].id)}
                                  className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                                  title="Delete Asset"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] bg-[#141414] border border-neutral-800 rounded-xl p-8">
              <svg className="w-16 h-16 text-neutral-600 mb-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5.5 9.511c.076.954.83 1.697 2.182 1.785V12h.6v-.709c1.4-.098 2.218-.846 2.218-1.932 0-.987-.626-1.496-1.745-1.76l-.473-.112V5.57c.6.068.982.396 1.074.85h1.052c-.076-.919-.864-1.638-2.126-1.716V4h-.6v.719c-1.195.117-2.01.836-2.01 1.853 0 .9.606 1.472 1.613 1.707l.397.098v2.034c-.615-.093-1.022-.43-1.114-.9H5.5zm2.177-2.166c-.59-.137-.91-.416-.91-.836 0-.47.345-.822.915-.925v1.76h-.005zm.692 1.193c.717.166 1.048.435 1.048.91 0 .542-.412.914-1.135.982V8.518l.087.02z"/>
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M8 13.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zm0 .5A6 6 0 1 0 8 2a6 6 0 0 0 0 12z"/>
              </svg>
              <h3 className="mt-4 text-xl font-bold text-white mb-2">No Assets Yet</h3>
              <p className="text-neutral-400 mb-6 text-sm">Start tracking your crypto portfolio by adding your first asset.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all text-sm"
              >
                Add Your First Asset
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 p-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add Crypto Asset</h3>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Search Cryptocurrency</label>
                  <input
                    type="text"
                    placeholder="Search Bitcoin, Ethereum..."
                    onChange={(e) => searchCrypto(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                  {searchLoading && <p className="text-xs text-neutral-500 mt-1">Searching...</p>}
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto bg-[#0a0a0a] border border-neutral-700 rounded-lg">
                      {searchResults.map((coin) => (
                        <button
                          key={coin.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, symbol: coin.symbol.toUpperCase(), coin_id: coin.id });
                            setSearchResults([]);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-sm"
                        >
                          <span className="font-medium text-white">{coin.symbol.toUpperCase()}</span>
                          <span className="text-neutral-400">-</span>
                          <span className="text-neutral-400">{coin.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {formData.coin_id && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-sm text-blue-400">✓ Selected: {formData.symbol} ({formData.coin_id})</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Purchase Price (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Purchase Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Notes (Optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm resize-none"
                    placeholder="Add any notes..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#141414] focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={!formData.coin_id || !formData.amount}
                >
                  Add Asset to Portfolio
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TradingView Chart Modal */}
      {showChartModal && selectedCoin && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => setShowChartModal(false)}>
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 p-4 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedCoin.symbol} / USDT Chart</h3>
                <p className="text-xs text-neutral-400">Powered by TradingView</p>
              </div>
              <button onClick={() => setShowChartModal(false)} className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-grow p-1 sm:p-2 overflow-hidden">
              <div id="tradingview_chart_widget_container" ref={chartContainerRef} className="w-full h-full min-h-[400px]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}