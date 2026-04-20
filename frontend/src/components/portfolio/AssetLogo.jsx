import { useState } from "react";

const COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-pink-500",
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickColor(symbol) {
  if (!symbol) return "bg-neutral-700";
  return COLORS[hashStr(symbol) % COLORS.length];
}

function initialsOf(symbol) {
  if (!symbol) return "?";
  const cleaned = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 2) || "?";
}

/**
 * AssetLogo — renders a logo <img> if `src` is provided, else a
 * deterministic colored-initials disk. Falls back transparently on <img> error
 * so unresolved long-tail symbols don't break the UI.
 *
 * Props:
 *   symbol     string    ticker; drives initials + deterministic color
 *   src        string?   logo URL from backend (may be undefined/null)
 *   size       number?   px (default 28)
 *   className  string?
 */
export default function AssetLogo({ symbol = "", src, size = 28, className = "" }) {
  const [failed, setFailed] = useState(false);
  const dim = `${size}px`;
  const showImg = Boolean(src) && !failed;

  if (showImg) {
    return (
      <img
        src={src}
        alt={symbol || "asset"}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`rounded-full bg-neutral-900 object-cover flex-shrink-0 ${className}`}
        style={{ width: dim, height: dim }}
      />
    );
  }

  return (
    <span
      aria-label={symbol || "asset"}
      className={`inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 ${pickColor(symbol)} ${className}`}
      style={{ width: dim, height: dim, fontSize: `${Math.max(9, size * 0.4)}px` }}
    >
      {initialsOf(symbol)}
    </span>
  );
}
