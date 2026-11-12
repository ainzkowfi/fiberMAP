import { useEffect, useRef } from "react";

/**
 * Open sheets, innermost last. Escape closes only the top one: without this a
 * confirmation sheet stacked on a pin sheet closed both, and the crew lost the
 * sheet they were working in.
 */
const stack: symbol[] = [];

/**
 * Calls `onEscape` when the Escape key is pressed.
 *
 * Every modal in the app is closable this way. It is not a nicety: the same
 * build runs on a phone with no keyboard and on a truck-mounted laptop where
 * Escape is the reflex.
 */
export function useEscape(onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  handler.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const id = Symbol("sheet");
    stack.push(id);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (stack[stack.length - 1] !== id) return;
      event.stopPropagation();
      handler.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const at = stack.indexOf(id);
      if (at >= 0) stack.splice(at, 1);
    };
  }, [active]);
}
