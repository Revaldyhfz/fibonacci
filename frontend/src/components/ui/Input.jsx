import { forwardRef } from "react";

const base =
  "w-full px-3 py-2 bg-[#0a0a0a] border rounded-lg text-white text-sm placeholder-neutral-500 transition-colors " +
  "focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

export const Input = forwardRef(function Input(
  { label, error, className = "", id, ...rest },
  ref
) {
  const inputId = id || rest.name;
  const borderClass = error ? "border-red-500/60" : "border-neutral-700";
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-300 mb-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        className={[base, borderClass, className].join(" ")}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, className = "", id, children, ...rest },
  ref
) {
  const inputId = id || rest.name;
  const borderClass = error ? "border-red-500/60" : "border-neutral-700";
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-300 mb-1">
          {label}
        </label>
      )}
      <select id={inputId} ref={ref} className={[base, borderClass, className].join(" ")} {...rest}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, className = "", id, ...rest },
  ref
) {
  const inputId = id || rest.name;
  const borderClass = error ? "border-red-500/60" : "border-neutral-700";
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-300 mb-1">
          {label}
        </label>
      )}
      <textarea id={inputId} ref={ref} className={[base, borderClass, className].join(" ")} {...rest} />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
});

export default Input;
