"use client";
import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const previewInterval = 100;

// Inputs/history keep their live value. Geometry receives the newest snapshot
// at most once per interval, including a trailing update during long drags.
export function usePreviewInput<T>(input: T, interval = previewInterval) {
  const [value, setValue] = useState(input);
  const latest = useRef(input), published = useRef(input);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    published.current = latest.current;
    setValue(latest.current);
  }, []);
  useLayoutEffect(() => {
    latest.current = input;
    if (Object.is(input, published.current)) {
      clearTimeout(timer.current);
      timer.current = undefined;
    } else if (timer.current === undefined) {
      timer.current = setTimeout(() => startTransition(flush), interval);
    }
  }, [input, interval, flush]);
  useEffect(() => {
    const release = () => startTransition(flush);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      clearTimeout(timer.current);
      timer.current = undefined;
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [flush]);
  return { value, flush };
}
