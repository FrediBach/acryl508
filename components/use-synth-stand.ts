"use client";
import { useEffect, useMemo, useState } from "react";
import { createSynthStand, type StandConfiguration, type SynthStand } from "@/lib/synth-stand";

import { useGeometryInput } from "./use-geometry-input";

type Result = { input: StandConfiguration; stand?: SynthStand; error?: string };
export function useSynthStand(appearance: StandConfiguration) {
  const config = useGeometryInput(appearance);
  const manual = useMemo(() => createSynthStand({ ...config, object: undefined }), [config]);
  const [result, setResult] = useState<Result>();
  useEffect(() => {
    if (!config.object) return;
    let worker: Worker | undefined;
    // Coalesce slider movement and cancel obsolete fitting jobs. Large meshes
    // cannot block camera controls or editing on the main thread.
    const timer = setTimeout(() => {
      try {
        worker = new Worker(new URL("../lib/stand-worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ stand?: SynthStand; error?: string }>) => setResult({ input: config, ...event.data });
        worker.onerror = () => setResult({ input: config, error: "Model fitting failed. Try a simpler mesh or reload the page." });
        worker.postMessage(config);
      } catch { setResult({ input: config, error: "Model fitting is unavailable in this browser." }); }
    }, 120);
    return () => { clearTimeout(timer); worker?.terminate(); };
  }, [config]);
  const current = config.object && result?.input === config ? result : undefined;
  const resolved = current?.stand ?? manual;
  const stand = useMemo(() => ({ ...resolved, config: { ...resolved.config, tint: appearance.tint, transparency: appearance.transparency ?? "transparent" } }), [resolved, appearance.tint, appearance.transparency]);
  return { stand, standError: current?.error, standBusy: !!config.object && !current };
}
