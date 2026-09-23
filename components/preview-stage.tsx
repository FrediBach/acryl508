"use client";
import { lazy, Suspense, useState } from "react";
import { Box, Check, Layers2, Maximize, Minimize, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { CasePanels } from "@/lib/case-panels";
import type { CameraView } from "@/components/case-preview";
const CasePreview = lazy(() => import("@/components/case-preview").then(module => ({ default: module.CasePreview })));
import { caseDimensions, rackFormatLabel, type CaseConfiguration } from "@/lib/configurator";

export function PreviewStage({ config, panels, dark }: { config: CaseConfiguration; panels: CasePanels; dark: boolean }) {
  const [view, setView] = useState<CameraView>("perspective");
  const [exploded, setExploded] = useState(false);
  const [modules, setModules] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const dimensions = caseDimensions(config);
  return <section className={`preview-stage ${expanded ? "preview-expanded" : ""}`} aria-label="Interactive 3D case preview" onKeyDown={event => { if (event.key === "Escape") setExpanded(false); }}>
    <div className="stage-topline"><div className="model-label"><span className="status-dot" /><span>LIVE PREVIEW</span><span className="model-label-separator">/</span><span>{rackFormatLabel(config)} / {config.hp}HP</span></div><span className="stage-material">GS—{config.thickness.toString().padStart(2, "0")} <span>•</span> {config.individualPanelTints ? "INDIVIDUAL TINTS" : config.tint.label.toUpperCase()}</span></div>
    <div className="stage-watermark" aria-hidden="true">A—508</div>
    <div className="canvas-wrap"><Suspense fallback={<div className="preview-fallback" role="status">Preparing your case…</div>}><CasePreview panels={panels} config={config} dark={dark} view={view} resetKey={resetKey} exploded={exploded} modules={modules} /></Suspense></div>
    <div className="stage-side-tools"><button className={`icon-button ${exploded ? "tool-active" : ""}`} aria-label="Exploded view" aria-pressed={exploded} title="Exploded view" onClick={() => setExploded(!exploded)}><Layers2 size={18} /></button><button className={`icon-button ${modules ? "tool-active" : ""}`} aria-label="Show example modules" aria-pressed={modules} title="Show example modules" onClick={() => setModules(!modules)}><SlidersHorizontal size={18} /></button><span /><button className="icon-button" aria-label="Reset camera" title="Reset camera" onClick={() => { setView("perspective"); setResetKey(value => value + 1); }}><RotateCcw size={16} /></button><button className="icon-button" aria-label={expanded ? "Exit expanded preview" : "Expand preview"} title={expanded ? "Exit expanded preview" : "Expand preview"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize size={16} /> : <Maximize size={16} />}</button></div>
    <div className="stage-bottom"><div className="view-control" aria-label="Camera view">{(["perspective", "front", "top"] as const).map(option => <button key={option} onClick={() => setView(option)} aria-pressed={view === option} className={view === option ? "view-active" : ""}>{option === "perspective" && <Box size={13} />}{option === "perspective" ? "Perspective" : option === "front" ? "Front" : "Top"}</button>)}</div><span className="stage-hint">Drag to orbit <i /> Scroll to zoom</span><span className="stage-dimensions">{dimensions.width.toFixed(1)} × {dimensions.length.toFixed(1)} × {dimensions.height} <small>mm</small></span></div>
    <div className="stage-caption"><span><Check size={12} />{exploded ? "Interlocking panel assembly" : "Real-time material preview"}</span><span>CONCEPT MODEL · MM</span></div>
  </section>;
}
