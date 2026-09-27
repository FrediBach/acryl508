"use client";
import { useEffect, useState } from "react";
import { loadBuiltinFont, textOutlines, type CutoutFont } from "@/lib/cutout-sources";
import type { ComponentLabel, PanelComponent } from "@/lib/panel-designer";
import { NumberControl } from "./cutout-controls";

export function ComponentLabelControls({ component, onChange }: { component: PanelComponent; onChange: (label: ComponentLabel | null) => void }) {
  const [font, setFont] = useState<CutoutFont | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadBuiltinFont("helvetiker").then(font => { if (active) { setFont(font); setError(""); } }, error => {
      if (active) setError(error instanceof Error ? error.message : "The label font could not be loaded.");
    });
    return () => { active = false; };
  }, [attempt]);
  function changeText(text: string) {
    if (!text.trim()) { onChange(null); setError(""); return; }
    if (!font) return;
    try {
      const polygons = textOutlines(font, text);
      onChange({ height: 2.5, gap: 1.5, position: "above", ...component.label, text, polygons });
      setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "This label could not be created."); }
  }
  const label = component.label;
  return <div className="config-group">
    <label className="cutout-field">Engraved label text<input type="text" value={label?.text ?? ""} maxLength={60} disabled={!font} placeholder="e.g. INPUT, LEVEL, ON/OFF" onChange={event => changeText(event.target.value)} /></label>
    <p className="control-note">Optional surface engraving. Follows this component when moved, rotated or duplicated. Leave blank for no label. Gap is measured from its body/knob clearance box.</p>
    {!font && !error && <p className="control-note" role="status">Loading label font…</p>}
    {error && <p className="cutout-warning" role="alert">{error}{!font && <button className="cutout-button" onClick={() => setAttempt(value => value + 1)}>Retry label font</button>}</p>}
    {label && <>
      <label className="cutout-field">Label position<select value={label.position} onChange={event => onChange({ ...label, position: event.target.value as ComponentLabel["position"] })}><option value="above">Above component</option><option value="below">Below component</option></select></label>
      <div className="cutout-numbers"><NumberControl label="Label height (mm)" value={label.height} min={0.5} max={8} onChange={height => onChange({ ...label, height })} /><NumberControl label="Label gap (mm)" value={label.gap} min={0} max={20} onChange={gap => onChange({ ...label, gap })} /></div>
      <button className="cutout-button" onClick={() => onChange(null)}>Remove component label</button>
    </>}
  </div>;
}
