import { useEffect } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-2xl",
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} my-8 bg-[#141414] border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]`}
      >
        {title && (
          <div className="sticky top-0 z-10 bg-[#141414] border-b border-neutral-800 px-5 py-4 flex items-center justify-between rounded-t-2xl">
            <h3 className="text-lg sm:text-xl font-bold text-white truncate">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="border-t border-neutral-800 px-5 py-4 flex items-center justify-end gap-2 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
