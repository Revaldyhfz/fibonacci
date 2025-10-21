import { useState, useEffect, useRef } from "react"; // Added useRef
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import axios from "axios";
// Import API base URL if needed, or adjust fetch URL directly
// import { API_BASE } from "../lib/api";

export default function PortfolioPage() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [assets, setAssets] = useState([]); // This holds raw asset data from API
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
  const abortControllerRef = useRef(null); // <-- Ref for AbortController
  const [formData, setFormData] = useState({
    symbol: "",
    coin_id: "",
    amount: "",
    purchase_price: "",
    purchase_date: "",
    notes: ""
  });

  // Fetch initial portfolio and asset list
  useEffect(() => {
    fetchPortfolio();
  }, []);

  // Fetch history data when portfolio assets or time range changes
  useEffect(() => {
    // Cancel the previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log("Aborting previous history fetch request.");
    }

    // Only fetch if we have assets loaded
    if (portfolio?.assets && portfolio.assets.length > 0) {
      // Create a new AbortController for the new request
      abortControllerRef.current = new AbortController();
      fetchHistoryData(abortControllerRef.current.signal); // Pass the signal
    } else {
      // If there are no assets, ensure the chart is cleared and not loading
      setHistoryData([]);
      setChartLoading(false);
    }

    // Cleanup function to cancel on component unmount or before next run
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [portfolio?.assets, timeRange]); // Dependencies: portfolio assets and timeRange


  // TradingView Chart Effect (no changes needed here)
  useEffect(() => {
    let tvScript = null; // Keep track of the script element

    if (showChartModal && selectedCoin && chartContainerRef.current) {
      chartContainerRef.current.innerHTML = ''; // Clear previous widget

      tvScript = document.createElement('script');
      tvScript.src = 'https://s3.tradingview.com/tv.js';
      tvScript.async = true;
      tvScript.onload = () => {
        // Ensure TradingView is loaded
        if (window.TradingView && chartContainerRef.current) {
           try {
              new window.TradingView.widget({
                container_id: chartContainerRef.current.id, // Use the ref's current element id
                width: '100%',
                height: 500,
                symbol: `BINANCE:${selectedCoin.symbol}USDT`, // Use selected coin symbol
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
            } catch (error) {
                console.error("TradingView widget initialization failed:", error);
                if(chartContainerRef.current) {
                   chartContainerRef.current.innerHTML = '<p class="text-red-500 text-center">Failed to load TradingView chart.</p>';
                }
            }
        } else {
             console.error("TradingView library not loaded or chart container not found.");
             if(chartContainerRef.current) {
                   chartContainerRef.current.innerHTML = '<p class="text-red-500 text-center">Failed to load TradingView library.</p>';
                }
        }
      };
      tvScript.onerror = () => {
          console.error("Failed to load TradingView script.");
           if(chartContainerRef.current) {
               chartContainerRef.current.innerHTML = '<p class="text-red-500 text-center">Failed to load TradingView script.</p>';
            }
      }

      document.body.appendChild(tvScript);
    }

    // Cleanup function
    return () => {
      if (tvScript && tvScript.parentNode) {
        tvScript.parentNode.removeChild(tvScript);
      }
      // Attempt to clean up TradingView resources if widget instance is accessible
      // This is often tricky as the widget doesn't always provide a direct cleanup method
      if (chartContainerRef.current) {
          chartContainerRef.current.innerHTML = ''; // Clear container on cleanup
      }
    };
  }, [showChartModal, selectedCoin]); // Re-run effect when modal state or selected coin changes


  const fetchPortfolio = async () => {
    setLoading(true); // Ensure loading state is set at the start
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens?.access) throw new Error("Authentication token not found.");
      const headers = { Authorization: `Bearer ${tokens.access}` };

      // Fetch the raw list of assets FIRST
      const assetsRes = await axios.get("http://127.0.0.1:8000/api/crypto-assets/", { headers });
      setAssets(assetsRes.data || []); // Store raw assets

      // Then fetch the calculated summary (which might be empty if no assets)
      const portfolioRes = await axios.get("http://127.0.0.1:8000/api/crypto-assets/portfolio_summary/", { headers });
      setPortfolio(portfolioRes.data);

    } catch (error) {
      console.error("Failed to fetch portfolio:", error);
      // Handle specific errors like 401 Unauthorized, maybe logout user
      if (error.response?.status === 401) {
          logout();
          nav("/");
      }
      setPortfolio(null); // Clear portfolio on error
      setAssets([]); // Clear assets on error
    } finally {
      setLoading(false);
    }
  };


  const fetchHistoryData = async (signal) => {
    setChartLoading(true);
    setHistoryData([]); // Clear previous data immediately for better UX

    // Ensure portfolio and assets exist before proceeding
    if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) {
        console.warn("fetchHistoryData called with no portfolio assets.");
        setChartLoading(false);
        return;
    }

    try {
      // Map assets from the calculated portfolio summary
      const assetList = portfolio.assets.map(asset => ({
        symbol: asset.symbol,
        coin_id: asset.coin_id,
        // Ensure amount is correctly passed, check structure of portfolio.assets
        amount: assets.find(a => a.symbol === asset.symbol)?.amount || asset.amount || 0 // Fallback needed?
      }));

       // Filter out assets with missing data needed for the request
      const validAssetList = assetList.filter(a => a.symbol && a.coin_id && typeof a.amount === 'number');

      if (validAssetList.length === 0) {
          console.warn("No valid assets found to fetch history for.");
          setChartLoading(false);
          return;
      }


      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens?.access) throw new Error("Authentication token not found for history fetch.");
      const headers = { Authorization: `Bearer ${tokens.access}` };


      // Use the Django proxy URL defined in fibonacci_project/urls.py
      const historyUrl = `http://127.0.0.1:8000/portfolio/portfolio/history?days=${timeRange}`;

      const res = await axios.post(
        historyUrl,
        validAssetList, // Send only valid assets
        {
          headers: headers, // Pass auth headers
          timeout: 30000, // Increased timeout
          signal: signal // Pass the signal to axios
        }
      );

      // Check if the request was aborted after it was sent but before response processed
      if (signal?.aborted) {
        console.log("History fetch aborted during processing.");
        return; // Don't process the response
      }

       // Check if backend returned an error structure
      if (res.data.error) {
          console.error("Backend error fetching history:", res.data.error);
          throw new Error(res.data.error);
      }

      // Ensure history data exists and is an array
      const history = res.data?.history;
      if (!Array.isArray(history)) {
          console.error("Invalid history data received:", res.data);
          throw new Error("Invalid history data format received from backend.");
      }


      // Format data for recharts
      const formattedData = history.map(point => {
        // Validate each point
        if (typeof point.timestamp !== 'number' || typeof point.value !== 'number' || !point.date) {
            console.warn("Skipping invalid history point:", point);
            return null; // Skip invalid points
        }
         const pointDate = new Date(point.date); // Use the ISO string date from backend
        return {
          timestamp: point.timestamp,
          // Formatting for XAxis label
          date: pointDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: timeRange <= 2 ? 'numeric' : undefined, // Show hour for 1D/2D
            minute: timeRange <= 2 ? '2-digit' : undefined, // Show minute for 1D/2D
          }),
          value: point.value,
          // Formatting for Tooltip
          fullDate: pointDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        };
      }).filter(Boolean); // Filter out any null (invalid) points

      console.log(`Formatted data for ${timeRange} days (${formattedData.length} points):`, formattedData);
      if (formattedData.length === 0) {
          console.warn(`Received no valid history data points for ${timeRange} days range.`);
      }

      setHistoryData(formattedData);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("History fetch cancelled:", error.message);
      } else if (!signal?.aborted) {
        console.error("Failed to fetch or process history:", error);
        setHistoryData([]); // Clear data on error
         // Optionally set an error state here to display to the user
      }
    } finally {
      // Only stop loading if the request wasn't aborted prematurely
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
       // Use proxy URL
       const searchUrl = `http://127.0.0.1:8000/portfolio/search/${query}`;
       const res = await axios.get(searchUrl, { headers });
      setSearchResults(res.data.results || []);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]); // Clear results on error
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

    // Prepare data, ensuring optional fields are null if empty
    const dataToSubmit = {
        ...formData,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        purchase_date: formData.purchase_date ? new Date(formData.purchase_date).toISOString() : null, // Send as ISO string
        amount: parseFloat(formData.amount) // Ensure amount is a number
    };


    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens?.access) throw new Error("Auth token needed to add asset.");
      await axios.post(
        "http://127.0.0.1:8000/api/crypto-assets/",
        dataToSubmit,
        { headers: { Authorization: `Bearer ${tokens.access}` } }
      );
      setShowAddModal(false);
      setFormData({ symbol: "", coin_id: "", amount: "", purchase_price: "", purchase_date: "", notes: "" });
      setSearchResults([]); // Clear search results
      await fetchPortfolio(); // Refresh portfolio data
    } catch (error) {
      console.error("Failed to add asset:", error.response?.data || error.message);
      // Provide more specific error feedback if available
      const errorDetail = error.response?.data;
      let alertMessage = "Failed to add asset. ";
      if (typeof errorDetail === 'string') {
          alertMessage += errorDetail;
      } else if (errorDetail) {
          // Join multiple errors if backend sends them (e.g., validation errors)
          alertMessage += Object.entries(errorDetail).map(([key, value]) => `${key}: ${value}`).join('; ');
      }
      alert(alertMessage);
    }
  };

   const handleDelete = async (assetIdToDelete) => {
    // Find the specific purchase ID from the raw 'assets' list
     // This assumes your portfolio summary might aggregate, but raw assets have individual IDs
     const assetToDelete = assets.find(a => a.id === assetIdToDelete);

     if (!assetToDelete) {
         console.error("Could not find asset with ID:", assetIdToDelete);
         alert("Error finding asset to delete.");
         return;
     }


    if (!window.confirm(`Delete this specific purchase of ${assetToDelete.amount} ${assetToDelete.symbol}?`)) return;

    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
       if (!tokens?.access) throw new Error("Auth token needed to delete asset.");
      await axios.delete(
        `http://127.0.0.1:8000/api/crypto-assets/${assetIdToDelete}/`, // Use the specific ID
        { headers: { Authorization: `Bearer ${tokens.access}` } }
      );
      await fetchPortfolio(); // Refresh data
    } catch (error) {
      console.error("Failed to delete asset:", error.response?.data || error.message);
       alert("Failed to delete asset. See console for details.");
    }
  };

  const openChart = (asset) => {
    // Make sure we have the symbol
    if (asset && asset.symbol) {
        setSelectedCoin({ symbol: asset.symbol.toUpperCase() }); // Pass only needed info
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


  // --- RENDER LOGIC ---

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

  // Determine if there are assets AFTER loading is complete
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

          {/* Portfolio Summary Cards - Show only if portfolio data exists */}
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
                 <div className="text-3xl font-bold text-neutral-300"> {/* Changed color */}
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


          {/* Portfolio Value Chart - Conditionally render based on hasAssets */}
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
                      disabled={chartLoading} // Disable buttons while loading
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        timeRange === range.value
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-[#0a0a0a] border border-neutral-700 text-neutral-300 hover:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

               {/* Responsive Container for Chart */}
                <div className="w-full h-80">
                  {chartLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-neutral-600 border-t-blue-500 mb-2"></div>
                        <div className="text-sm text-neutral-400">Loading chart data ({timeRange}D)...</div>
                      </div>
                    </div>
                  ) : historyData.length > 0 ? (
                    // Use a ResponsiveContainer for Recharts
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
                             dy={10} // Adjust position down
                           />
                           <YAxis
                             stroke="#737373"
                             style={{ fontSize: '10px' }}
                             tickFormatter={(value) => `$${value.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1})}`}
                             domain={['dataMin - (dataMax-dataMin)*0.1', 'dataMax + (dataMax-dataMin)*0.1']} // Add padding
                             orientation="right" // Move Y-axis to the right
                             axisLine={false}
                             tickLine={false}
                             dx={5} // Adjust position right
                           />
                           <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#525252', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                           <Line
                             type="monotone"
                             dataKey="value"
                             stroke="#10b981"
                             strokeWidth={2}
                             dot={false}
                             activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
                             // fillOpacity={1} // Removed fill opacity
                             // fill="url(#colorValue)" // Removed area fill
                           />
                         </LineChart>
                       </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-neutral-500">
                         {/* Icon */}
                         <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="mt-2 text-sm">No chart data available for this period.</p>
                         <p className="mt-1 text-xs">This might happen if there were no assets held or price data is missing.</p>
                      </div>
                    </div>
                  )}
                </div> {/* End Responsive Container */}
            </div>
          )}


           {/* Assets Table - Show only if hasAssets is true */}
          {hasAssets ? (
            <div className="bg-[#141414] border border-neutral-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]"> {/* Added min-width */}
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
                    {/* Map over calculated portfolio summary assets */}
                    {portfolio.assets.map((asset, idx) => {
                       // Find the corresponding raw asset(s) to get individual purchase IDs if needed
                       const rawAssetEntries = assets.filter(a => a.symbol === asset.symbol);
                      return (
                          <tr key={asset.coin_id || idx} className="hover:bg-[#0a0a0a] transition-colors group">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {/* You might need to fetch the image URL based on coin_id */}
                                {/* <img src={asset.thumb || '/placeholder.png'} alt={asset.symbol} className="w-6 h-6 rounded-full"/> */}
                                <div>
                                    <div className="font-bold text-white text-sm">{asset.symbol}</div>
                                    <div className="text-xs text-neutral-500">{asset.coin_id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-neutral-300">
                              {asset.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-neutral-300">
                              ${asset.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-white">
                              ${asset.current_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '-'}
                            </td>
                            <td className={`px-4 py-3 text-right text-sm font-medium ${asset.change_24h == null ? 'text-neutral-500' : asset.change_24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {asset.change_24h != null ? `${asset.change_24h >= 0 ? '+' : ''}${asset.change_24h?.toFixed(2)}%` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {asset.pnl != null ? (
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
                                {/* Actions - target the specific purchase ID if needed */}
                                {/* If multiple purchases exist, you might show a dropdown or list them */}
                               <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => openChart(asset)}
                                      className="p-1.5 text-neutral-400 hover:text-blue-500 transition-colors"
                                      title="View Chart"
                                    >
                                       {/* Chart Icon */}
                                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" > <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1.125-1.5M11.25 16.5l1.125-1.5m0 0l1.125 1.5m-1.125-1.5l-1.125 1.5M3.75 16.5l1.125-1.5M18.75 16.5l-1.125-1.5M11.25 3l1.125 1.5M11.25 3l-1.125 1.5M11.25 3v1.5m0 0l1.125 1.5M11.25 4.5l-1.125 1.5M11.25 4.5v1.5m0 0l1.125 1.5m-1.125-1.5l-1.125 1.5" /> </svg>

                                    </button>
                                    {/* Link Delete to the first raw asset ID found for this symbol */}
                                     {rawAssetEntries.length > 0 && (
                                          <button
                                             onClick={() => handleDelete(rawAssetEntries[0].id)} // Example: Deleting the first found purchase
                                             className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                                             title={`Delete Purchase (ID: ${rawAssetEntries[0].id})`}
                                          >
                                               {/* Trash Icon */}
                                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /> </svg>
                                          </button>
                                     )}
                                     {/* Consider adding an "Edit" button here too */}
                               </div>
                            </td>
                          </tr>
                       )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
           ) : ( // Show this only if loading is finished and there are truly no assets
             !loading && (
                <div className="bg-[#141414] border border-neutral-800 rounded-xl p-12 text-center mt-6">
                  {/* Bitcoin Icon */}
                  <svg className="mx-auto h-16 w-16 text-neutral-600" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5.5 13v1.25c0 .138.112.25.25.25h1.5a.25.25 0 0 0 .25-.25V13h.5v1.25c0 .138.112.25.25.25h1.5a.25.25 0 0 0 .25-.25V13h.084c1.992 0 3.416-1.033 3.416-2.82 0-1.502-1.007-2.323-2.186-2.65v-.063c.8-.328 1.457-1.085 1.457-2.162 0-1.253-.942-2.18-2.318-2.18h-.084V1.75a.25.25 0 0 0-.25-.25h-1.5a.25.25 0 0 0-.25.25V3h-.5V1.75a.25.25 0 0 0-.25-.25h-1.5a.25.25 0 0 0-.25.25V3H6c-1.992 0-3.416 1.033-3.416 2.82 0 1.502 1.007 2.324 2.186 2.65v.063c-.8.328-1.457 1.085-1.457 2.162 0 1.254.942 2.18 2.318 2.18H5.5Zm1 0h1.5v1.25H6.5V13Zm2 0h1.5v1.25H8.5V13Zm1.5-6.975V4.643h.619c.906 0 1.579.52 1.579 1.416 0 .85-.59 1.341-1.614 1.341H10Zm-1.5 3.325V7.99h.62c1.065 0 1.81.566 1.81 1.533 0 .918-.68 1.464-1.875 1.464H8.5Z"/>
                      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm0-1A7 7 0 1 1 8 1a7 7 0 0 1 0 14Z"/>
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
              )
          )}
        </div>
      </main>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => setShowAddModal(false)}>
           {/* Modal Content */}
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex-shrink-0 p-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add Crypto Asset</h3>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> </svg>
              </button>
            </div>

             {/* Modal Body */}
            <div className="flex-grow overflow-y-auto p-4">
                 <form onSubmit={handleSubmit} className="space-y-4">
                   <div>
                     <label className="block text-sm font-medium text-neutral-300 mb-1">
                       Search Crypto <span className="text-neutral-500 text-xs">(e.g., bitcoin, eth, doge)</span>
                     </label>
                     <div className="relative">
                         <input
                           type="text"
                           placeholder="Search name or symbol..."
                           onChange={(e) => searchCrypto(e.target.value)}
                           className="w-full pl-3 pr-10 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                         />
                         {searchLoading && (
                             <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                 <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-600 border-t-blue-500"></div>
                              </div>
                          )}
                     </div>

                     {searchResults.length > 0 && (
                       <div className="mt-1.5 max-h-48 overflow-y-auto bg-[#0a0a0a] border border-neutral-700 rounded-lg shadow-lg z-10">
                         {searchResults.map((coin) => (
                           <button
                             key={coin.id}
                             type="button"
                             onClick={() => {
                               setFormData({ ...formData, symbol: coin.symbol, coin_id: coin.id });
                               setSearchResults([]); // Close dropdown after selection
                               // Clear the search input maybe?
                             }}
                             className="w-full text-left px-3 py-2 hover:bg-neutral-800 transition-colors flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
                           >
                             {coin.thumb && (
                               <img src={coin.thumb} alt={coin.name} className="w-5 h-5 rounded-full flex-shrink-0"/>
                             )}
                             <div className="flex-1 overflow-hidden">
                               <div className="text-sm font-medium text-white truncate">{coin.name}</div>
                               <div className="text-xs text-neutral-400 uppercase">{coin.symbol}</div>
                             </div>
                             {coin.market_cap_rank && (
                               <div className="text-xs text-neutral-500 flex-shrink-0">#{coin.market_cap_rank}</div>
                             )}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>

                   {/* Display Selected Coin */}
                   {formData.coin_id && (
                     <div className="p-2 bg-blue-900/30 border border-blue-700/50 rounded-lg flex items-center gap-2">
                         <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>
                         <span className="text-sm text-blue-300">
                         Selected: <span className="font-bold">{formData.symbol}</span> ({formData.coin_id})
                         </span>
                     </div>
                   )}

                   <div>
                     <label className="block text-sm font-medium text-neutral-300 mb-1" htmlFor="amount">Amount *</label>
                     <input
                       id="amount"
                       type="number"
                       step="any" // Allow decimals
                       value={formData.amount}
                       onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                       required
                       className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" // Hide number spinners
                       placeholder="e.g., 0.5"
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-neutral-300 mb-1" htmlFor="purchase_price">Purchase Price / coin (Optional)</label>
                     <div className="relative">
                         <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500 text-sm">$</span>
                          <input
                           id="purchase_price"
                           type="number"
                           step="any"
                           value={formData.purchase_price}
                           onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                           className="w-full pl-7 pr-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                           placeholder="e.g., 45000"
                         />
                     </div>
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-neutral-300 mb-1" htmlFor="purchase_date">Purchase Date (Optional)</label>
                     <input
                       id="purchase_date"
                       type="datetime-local" // Use datetime-local for better UX
                       value={formData.purchase_date}
                       onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                       className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      // Set max date to today maybe?
                      max={new Date().toISOString().split("T")[0] + "T23:59"}
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-neutral-300 mb-1" htmlFor="notes">Notes (Optional)</label>
                     <textarea
                       id="notes"
                       value={formData.notes}
                       onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                       rows="2"
                       className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none" // Disable resize
                       placeholder="e.g., Bought during market dip"
                     />
                   </div>

                   {/* Modal Footer */}
                    <div className="pt-4 border-t border-neutral-800">
                        <button
                            type="submit"
                            className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#141414] focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                            disabled={!formData.coin_id || !formData.amount} // Basic validation
                         >
                            Add Asset to Portfolio
                        </button>
                    </div>
                 </form>
            </div> {/* End Modal Body */}
          </div> {/* End Modal Content */}
        </div>
      )}


      {/* TradingView Chart Modal */}
      {showChartModal && selectedCoin && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => setShowChartModal(false)}>
           {/* Modal Content */}
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
             {/* Modal Header */}
            <div className="flex-shrink-0 p-4 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedCoin.symbol} / USDT Chart</h3>
                <p className="text-xs text-neutral-400">Powered by TradingView</p>
              </div>
              <button onClick={() => setShowChartModal(false)} className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-700">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> </svg>
              </button>
            </div>
             {/* Modal Body */}
            <div className="flex-grow p-1 sm:p-2 overflow-hidden"> {/* Adjusted padding */}
               {/* Ensure the container has an ID and ref */}
              <div id="tradingview_chart_widget_container" ref={chartContainerRef} className="w-full h-full min-h-[400px]" />
            </div>
          </div>
        </div>
      )}

    </div> // End main container
  );
}

// Add ResponsiveContainer import if you use it
import { ResponsiveContainer } from 'recharts';