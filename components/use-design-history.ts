"use client";
import { useCallback, useEffect, useReducer } from "react";
import { historyReducer, type History } from "@/lib/history";

export function useDesignHistory<T>(initial: T, onTravel?: (next: T, current: T) => void) {
  const [history, dispatch] = useReducer(historyReducer<T>, { past: [], present: initial, future: [] } as History<T>);
  const travel = useCallback((type: "undo" | "redo") => {
    const next = historyReducer(history, { type }).present;
    if (next !== history.present) onTravel?.(next, history.present);
    dispatch({ type });
  }, [history, onTravel]);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y") {
        event.preventDefault();
        travel(event.shiftKey || event.key.toLowerCase() === "y" ? "redo" : "undo");
      }
    }
    const end = () => dispatch({ type: "end" });
    window.addEventListener("keydown", keyboard);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => { window.removeEventListener("keydown", keyboard); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); window.removeEventListener("blur", end); };
  }, [travel]);
  return { history, dispatch, travel };
}
