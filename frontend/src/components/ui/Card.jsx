export default function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  padding = "p-5",
}) {
  return (
    <section className={`bg-[#141414] border border-neutral-800 rounded-xl ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-neutral-800 px-5 py-4">
          <div>
            {title && <h3 className="text-base sm:text-lg font-bold text-white">{title}</h3>}
            {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={padding}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = "neutral" }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
        ? "text-red-400"
        : tone === "warning"
          ? "text-yellow-400"
          : tone === "accent"
            ? "text-blue-400"
            : "text-white";
  return (
    <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4">
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      <div className={`text-2xl sm:text-3xl font-bold mb-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}
