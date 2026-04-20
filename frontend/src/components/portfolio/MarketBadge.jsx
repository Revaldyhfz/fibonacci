const COLORS = {
  crypto:  "bg-orange-500/10 border-orange-500/30 text-orange-300",
  US:      "bg-blue-500/10 border-blue-500/30 text-blue-300",
  ID:      "bg-red-500/10 border-red-500/30 text-red-300",
  JP:      "bg-pink-500/10 border-pink-500/30 text-pink-300",
  UK:      "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
  HK:      "bg-rose-500/10 border-rose-500/30 text-rose-300",
  AU:      "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
  _fallback: "bg-neutral-700/20 border-neutral-600 text-neutral-300",
};

const LABELS = {
  crypto: "Crypto",
  US:  "US 🇺🇸",
  ID:  "ID 🇮🇩",
  JP:  "JP 🇯🇵",
  UK:  "UK 🇬🇧",
  HK:  "HK 🇭🇰",
  AU:  "AU 🇦🇺",
  SG:  "SG 🇸🇬",
  KR:  "KR 🇰🇷",
  CN:  "CN 🇨🇳",
  CA:  "CA 🇨🇦",
  IN:  "IN 🇮🇳",
  MY:  "MY 🇲🇾",
  TH:  "TH 🇹🇭",
};

export default function MarketBadge({ market, assetType }) {
  const key = assetType === "crypto" ? "crypto" : (market || "_fallback");
  const color = COLORS[key] || COLORS._fallback;
  const label = LABELS[key] || market || (assetType === "stock" ? "Stock" : "Crypto");
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${color}`}>
      {label}
    </span>
  );
}
