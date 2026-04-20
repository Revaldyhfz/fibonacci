import { useEffect, useState } from "react";

/**
 * Returns a value that lags behind `value` by `delay` ms. Useful for typing
 * search inputs where we want to wait until the user stops before firing
 * a network request.
 */
export default function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}
