import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/layout/Header";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import PortfolioSummary from "../components/portfolio/PortfolioSummary";
import PortfolioChart from "../components/portfolio/PortfolioChart";
import AssetsTable from "../components/portfolio/AssetsTable";
import AddAssetModal from "../components/portfolio/AddAssetModal";
import ChartModal from "../components/portfolio/ChartModal";
import DeleteConfirm from "../components/portfolio/DeleteConfirm";
import { useToast } from "../context/ToastContext";
import useDebounce from "../hooks/useDebounce";

function authHeaders() {
  try {
    const tokens = JSON.parse(localStorage.getItem("tokens") || "null");
    return tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : null;
  } catch {
    return null;
  }
}

function handleUnauthorized() {
  localStorage.removeItem("tokens");
  localStorage.removeItem("user");
  window.location.href = "/";
}

async function apiFetch(url, options = {}) {
  const headers = authHeaders();
  if (!headers) {
    handleUnauthorized();
    throw new Error("No auth token");
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export default function PortfolioPage() {
  const toast = useToast();

  const [portfolio, setPortfolio] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [historyData, setHistoryData] = useState([]);
  const [timeRange, setTimeRange] = useState(7);
  const [chartLoading, setChartLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [chartAsset, setChartAsset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const historyAbortRef = useRef(null);
  const cacheRef = useRef({});

  const debouncedTimeRange = useDebounce(timeRange, 300);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const [rawAssets, summary] = await Promise.all([
        apiFetch("/api/crypto-assets/"),
        apiFetch("/api/crypto-assets/portfolio_summary/"),
      ]);
      setAssets(rawAssets || []);
      setPortfolio(summary || null);
    } catch (err) {
      if (err.message !== "Unauthorized") {
        toast.error("Failed to load portfolio");
        setPortfolio(null);
        setAssets([]);
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // History fetch
  useEffect(() => {
    if (!assets || assets.length === 0) {
      setHistoryData([]);
      setChartLoading(false);
      return;
    }

    if (cacheRef.current[debouncedTimeRange]) {
      setHistoryData(cacheRef.current[debouncedTimeRange]);
      setChartLoading(false);
      return;
    }

    if (historyAbortRef.current) historyAbortRef.current.abort();
    const ctl = new AbortController();
    historyAbortRef.current = ctl;

    const assetList = assets
      .map((a) => ({
        symbol: a.symbol,
        coin_id: a.coin_id,
        asset_type: a.asset_type || "crypto",
        market: a.market || null,
        amount: parseFloat(a.amount) || 0,
        purchase_price: a.purchase_price != null ? parseFloat(a.purchase_price) : null,
        purchase_date: a.purchase_date || null,
        notes: a.notes || null,
      }))
      .filter((a) => a.symbol && a.coin_id && a.amount > 0);

    if (assetList.length === 0) {
      setChartLoading(false);
      return;
    }

    setChartLoading(true);
    setHistoryData([]);

    apiFetch(`/portfolio/portfolio/history?days=${debouncedTimeRange}`, {
      method: "POST",
      body: JSON.stringify(assetList),
      signal: ctl.signal,
    })
      .then((res) => {
        if (ctl.signal.aborted) return;
        if (res?.error) throw new Error(res.error);
        const history = Array.isArray(res?.history) ? res.history : [];
        const formatted = history
          .map((p) => {
            const d = new Date(p.date);
            return {
              timestamp: p.timestamp,
              date: d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: debouncedTimeRange <= 2 ? "numeric" : undefined,
                minute: debouncedTimeRange <= 2 ? "2-digit" : undefined,
              }),
              value: p.value,
              fullDate: d.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            };
          })
          .filter((p) => p.value > 0);
        cacheRef.current[debouncedTimeRange] = formatted;
        setHistoryData(formatted);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setHistoryData([]);
      })
      .finally(() => {
        if (!ctl.signal.aborted) setChartLoading(false);
      });

    return () => ctl.abort();
  }, [assets, debouncedTimeRange]);

  const handleAddSubmit = useCallback(
    async (payload) => {
      try {
        await apiFetch("/api/crypto-assets/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        cacheRef.current = {};
        toast.success(`${payload.symbol} added to portfolio`);
        await fetchPortfolio();
      } catch (err) {
        if (err.message !== "Unauthorized") toast.error("Failed to add asset");
        throw err;
      }
    },
    [fetchPortfolio, toast],
  );

  const handleDeleteRequest = useCallback((rawAssetId) => {
    setDeleteTarget(rawAssetId);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteTarget == null) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/crypto-assets/${deleteTarget}/`, { method: "DELETE" });
      cacheRef.current = {};
      toast.success("Asset removed");
      setDeleteTarget(null);
      await fetchPortfolio();
    } catch (err) {
      if (err.message !== "Unauthorized") toast.error("Failed to remove asset");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchPortfolio, toast]);

  const hasAssets = assets && assets.length > 0;
  const missingDateCount = useMemo(
    () => assets.filter((a) => !a.purchase_date).length,
    [assets],
  );

  const modalAuthHeaders = useMemo(() => authHeaders() || {}, [showAddModal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Spinner label="Loading portfolio…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-8">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="my-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Portfolio</h2>
              <p className="text-sm text-neutral-400">
                Crypto + global stocks · live prices from{" "}
                <span className="text-blue-400 font-semibold">Binance</span>,{" "}
                <span className="text-blue-400 font-semibold">CoinGecko</span> &{" "}
                <span className="text-blue-400 font-semibold">Yahoo Finance</span>
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto"
            >
              + Add Asset
            </Button>
          </div>

          <PortfolioSummary portfolio={portfolio} />

          {hasAssets && (
            <PortfolioChart
              data={historyData}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              loading={chartLoading && debouncedTimeRange === timeRange}
              cachedRanges={Object.fromEntries(Object.keys(cacheRef.current).map((k) => [k, true]))}
              missingDates={missingDateCount > 0}
              missingCount={missingDateCount}
            />
          )}

          {hasAssets ? (
            <AssetsTable
              aggregatedAssets={portfolio?.assets || []}
              rawAssets={assets}
              onOpenChart={(a) => setChartAsset(a)}
              onDelete={handleDeleteRequest}
            />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] bg-[#141414] border border-neutral-800 rounded-xl p-8">
              <svg className="w-16 h-16 text-neutral-600 mb-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                <path d="M8 13.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zm0 .5A6 6 0 1 0 8 2a6 6 0 0 0 0 12z" />
              </svg>
              <h3 className="mt-4 text-xl font-bold text-white mb-2">No assets yet</h3>
              <p className="text-neutral-400 mb-6 text-sm">
                Start tracking crypto or global stocks — add your first asset below.
              </p>
              <Button variant="primary" onClick={() => setShowAddModal(true)}>
                Add your first asset
              </Button>
            </div>
          )}
        </div>
      </main>

      <AddAssetModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddSubmit}
        authHeaders={modalAuthHeaders}
      />

      <ChartModal
        open={chartAsset != null}
        onClose={() => setChartAsset(null)}
        asset={chartAsset}
      />

      <DeleteConfirm
        open={deleteTarget != null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </div>
  );
}
