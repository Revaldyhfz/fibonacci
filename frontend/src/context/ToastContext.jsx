import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

let idSeq = 0;

const toneClasses = {
  success: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
  error: "bg-red-500/10 border-red-500/40 text-red-300",
  info: "bg-blue-500/10 border-blue-500/40 text-blue-300",
  warning: "bg-yellow-500/10 border-yellow-500/40 text-yellow-300",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, { tone = "info", duration = 3500 } = {}) => {
      const id = ++idSeq;
      setToasts((t) => [...t, { id, message, tone }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = {
    push,
    dismiss,
    success: (m, opts) => push(m, { ...opts, tone: "success" }),
    error: (m, opts) => push(m, { ...opts, tone: "error" }),
    info: (m, opts) => push(m, { ...opts, tone: "info" }),
    warning: (m, opts) => push(m, { ...opts, tone: "warning" }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-auto">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const tone = toneClasses[toast.tone] || toneClasses.info;
  return (
    <div
      role="status"
      className={`border rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm pointer-events-auto flex items-start gap-3 ${tone}`}
    >
      <div className="flex-1 text-sm">{toast.message}</div>
      <button
        onClick={onDismiss}
        className="text-xs opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
