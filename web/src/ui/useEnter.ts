import { useEffect, useRef } from "react";

/**
 * Calls `onEnter` when the Enter key is pressed while focus is on a single-line
 * field. Enter in a textarea or on a modifier keeps its normal meaning, so
 * multi-line fields never get submitted by mistake.
 *
 * This is the keyboard half of R-32: a form in this app is a `div` with a
 * button, not a `<form>`, so Enter in a field does nothing by default.
 */
export function useEnter(onEnter: () => void, active = true) {
  const handler = useRef(onEnter);
  handler.current = onEnter;

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag !== "INPUT" && tag !== "SELECT") return;
      event.preventDefault();
      handler.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active]);
}
