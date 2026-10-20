import { useEffect, useRef } from "react";

/** Focus the element when `key` changes, so keyboard and screen-reader users land on the new content. */
export function useAutoFocus<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}
