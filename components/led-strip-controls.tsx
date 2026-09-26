"use client";
import { NumberControl } from "./cutout-controls";
import type { LedStrip } from "@/lib/engravings";

export function LedStripControls({ label, strip, onChange, error }: { label: string; strip: LedStrip; onChange: (strip: LedStrip) => void; error?: string }) {
  const update = (patch: Partial<LedStrip>) => onChange({ ...strip, ...patch });
  return <div className="led-strip-controls">
    <label className="led-strip-toggle"><span>{label}</span><input type="checkbox" checked={strip.enabled} onChange={event => update({ enabled: event.target.checked })} aria-label={`LED strip · ${label}`} /></label>
    {strip.enabled && <>
      <div className="cutout-numbers">
        <NumberControl label="Strip length (mm)" value={strip.length} min={10} max={1000} onChange={length => update({ length })} />
        <NumberControl label="Slot height (mm)" value={strip.slotHeight} min={1} max={10} onChange={slotHeight => update({ slotHeight })} />
        <NumberControl label="Bottom offset (mm)" value={strip.inset} min={3} max={200} onChange={inset => update({ inset })} />
        <NumberControl label="Brightness" value={strip.intensity} min={0} max={3} onChange={intensity => update({ intensity })} />
      </div>
      <label className="led-strip-toggle"><span>Light colour</span><input type="color" aria-label={`LED colour · ${label}`} value={strip.color} onChange={event => update({ color: event.target.value })} /></label>
      <p className="control-note">Offset is from the lowest sheet edge to the slot centre. Brightness 0 switches off the light while keeping the slot.</p>
      {error && <p className="cutout-warning" role="alert">{error}</p>}
    </>}
  </div>;
}
