export default function Spinner({ label = "Loading…", size = "lg", fullScreen = false }) {
  const dim = size === "sm" ? "h-4 w-4 border-2" : size === "md" ? "h-8 w-8 border-[3px]" : "h-12 w-12 border-4";
  const content = (
    <div className="flex flex-col items-center gap-3">
      <div className={`animate-spin rounded-full ${dim} border-neutral-700 border-t-blue-500`} />
      {label && <div className="text-sm text-neutral-400">{label}</div>}
    </div>
  );
  if (!fullScreen) return content;
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">{content}</div>
  );
}
