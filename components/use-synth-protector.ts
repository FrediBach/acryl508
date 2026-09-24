"use client";
import { useEffect, useMemo, useState } from "react";
import { createSynthProtector, type ProtectorConfiguration, type SynthProtector } from "@/lib/synth-protector";

import { useGeometryInput } from "./use-geometry-input";

type Result = { input: ProtectorConfiguration; protector?: SynthProtector; error?: string };
export function useSynthProtector(appearance: ProtectorConfiguration) {
  const config = useGeometryInput(appearance);
  const manual = useMemo(() => createSynthProtector({ ...config, object: undefined }), [config]);
  const [result, setResult] = useState<Result>();
  useEffect(() => {
    if (!config.object) return;
    let worker: Worker | undefined;
    const timer = setTimeout(() => {
      try {
        worker = new Worker(new URL("../lib/protector-worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ protector?: SynthProtector; error?: string }>) => setResult({ input: config, ...event.data });
        worker.onerror = () => setResult({ input: config, error: "Model fitting failed. Try a simpler mesh or reload the page." });
        worker.postMessage(config);
      } catch { setResult({ input: config, error: "Model fitting is unavailable in this browser." }); }
    }, 120);
    return () => { clearTimeout(timer); worker?.terminate(); };
  }, [config]);
  const current = config.object && result?.input === config ? result : undefined;
  const resolved = current?.protector ?? manual;
  const protector = useMemo(() => ({ ...resolved, config: { ...resolved.config, tint: appearance.tint, transparency: appearance.transparency ?? "transparent" } }), [resolved, appearance.tint, appearance.transparency]);
  return { protector, protectorError: current?.error, protectorBusy: !!config.object && !current };
}
