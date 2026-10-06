"use client";
import { PresentationButton } from "@/components/presentation-button";
import { materialLabel } from "@/lib/acrylic-material";
import { memo, lazy, Suspense, useMemo, useState } from "react";
import { Box, Check, Layers2, Maximize, Minimize, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { CasePanels } from "@/lib/case-panels";
import type { CameraView } from "@/components/case-preview";
const CasePreview = lazy(() => import("@/components/case-preview").then(module => ({ default: module.CasePreview })));
import { caseDimensions, caseThicknessLabel, rackFormatLabel, type CaseConfiguration } from "@/lib/configurator";

import { casePathData, caseSheetLayout, caseSheetMaterial } from "@/lib/svg-export";

function CuttingLayout({ panels, config }: { panels: CasePanels; config: CaseConfiguration }) {
  const layout = useMemo(() => caseSheetLayout(panels), [panels]);
  const removed = layout.parts.filter(({ item }) => !item.polygons.length).length;
  return <div className="stand-cutting-layout"><svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={panels.mount.enabled ? "Case cutting layout: enclosure sheets and backboard mount contact sheets" : panels.rowPanels.length ? "Case cutting layout: enclosure sheets and custom 1U panels" : "Case cutting layout: all five enclosure sheets"}>
    {layout.parts.map(({ item, x, y }) => <g key={item.id} data-part={item.id} transform={`translate(${x} ${y})`}>
      <title>{`${item.label}: ${item.bounds.width.toFixed(1)} × ${item.bounds.height.toFixed(1)} mm · ${caseSheetMaterial(config, item).thickness} mm thick${item.polygons.length ? "" : " — fully removed"}`}</title>
      {item.polygons.length > 0 && <path d={casePathData(item.polygons)} fill={caseSheetMaterial(config, item).tint.color} fillOpacity={0.4} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" fillRule="evenodd" />}
      {!!item.engraving?.length && <path data-operation="engrave" d={casePathData(item.engraving)} fill="#2563eb" fillOpacity={0.85} fillRule="evenodd" />}
    </g>)}
  </svg><p>{layout.parts.length - removed} sheets{removed > 0 ? ` · ${removed} fully removed by cutouts` : ""} · {layout.width.toFixed(0)} × {layout.height.toFixed(0)} mm layout · arrange to fit your stock sheet</p></div>;
}

export const PreviewStage = memo(function PreviewStage({ config, panels, dark }: { config: CaseConfiguration; panels: CasePanels; dark: boolean }) {
  const [presentation, setPresentation] = useState(false);
  const [view, setView] = useState<CameraView>("perspective");
  const [layout, setLayout] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [modules, setModules] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const dimensions = caseDimensions(config);
  return <section className={`preview-stage case-preview-stage ${expanded ? "preview-expanded" : ""}`} aria-label="Case preview" onKeyDown={event => { if (event.key === "Escape") { setPresentation(false); setExpanded(false); } }}>
    <div className="stage-topline"><div className="model-label"><span className="status-dot" /><span>LIVE PREVIEW</span><span className="model-label-separator">/</span><span>{rackFormatLabel(config)} / {config.hp}HP</span></div><span className="stage-material">GS—{caseThicknessLabel(config).padStart(2, "0")} <span>•</span> {config.individualPanelTints ? "INDIVIDUAL MATERIALS" : materialLabel(config.tint, config.transparency).toUpperCase()}</span></div>
    <div className="stage-watermark" aria-hidden="true">A-508</div>
    <div className="canvas-wrap">{layout ? <CuttingLayout panels={panels} config={config} /> : <Suspense fallback={<div className="preview-fallback" role="status">Preparing your case…</div>}><CasePreview presentation={presentation} panels={panels} config={config} dark={dark} view={view} resetKey={resetKey} exploded={exploded} modules={modules} /></Suspense>}</div>
    <div className="stage-side-tools"><PresentationButton active={presentation} onClick={() => { setLayout(false); setPresentation(value => !value); }} /><button className={`icon-button ${exploded && !layout ? "tool-active" : ""}`} aria-label="Exploded view" aria-pressed={exploded && !layout} title="Exploded view" onClick={() => { setLayout(false); setExploded(!exploded); }}><Layers2 size={18} /></button><button className={`icon-button ${modules && !layout ? "tool-active" : ""}`} aria-label="Show example modules" aria-pressed={modules && !layout} title="Show example modules and patch cables" onClick={() => { setLayout(false); setModules(!modules); }}><SlidersHorizontal size={18} /></button><span /><button className="icon-button" aria-label="Reset camera" title="Reset camera" onClick={() => { setPresentation(false); setView("perspective"); setLayout(false); setResetKey(value => value + 1); }}><RotateCcw size={16} /></button><button className="icon-button" aria-label={expanded ? "Exit expanded preview" : "Expand preview"} title={expanded ? "Exit expanded preview" : "Expand preview"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize size={16} /> : <Maximize size={16} />}</button></div>
    <div className="stage-bottom"><div className="view-control" role="group" aria-label="Case view">{(["perspective", "front", "side", "top"] as const).map(option => <button key={option} onClick={() => { setPresentation(false); setLayout(false); setView(option); setResetKey(key => key + 1); }} aria-pressed={!presentation && !layout && view === option} className={!presentation && !layout && view === option ? "view-active" : ""}>{option === "perspective" && <Box size={13} />}{option === "perspective" ? "Perspective" : option === "front" ? "Front" : option === "side" ? "Side" : "Top"}</button>)}<button className={layout ? "view-active" : ""} aria-pressed={layout} onClick={() => { setPresentation(false); setLayout(true); }}>Cutting layout</button></div><span className="stage-hint">{layout ? "Full-size SVG available below" : presentation ? "Presentation mode · Pause to orbit" : <>Drag to orbit <i /> Scroll to zoom</>}</span><span className="stage-dimensions">{dimensions.width.toFixed(1)} × {dimensions.length.toFixed(1)} × {dimensions.height} <small>mm</small></span></div>
    <div className="stage-caption"><span><Check size={12} />{layout ? "Shared preview & export geometry" : exploded ? "Interlocking panel assembly" : config.backboardMount ? "Slide-on mount · reference backboard" : modules ? "Example modules & patch cables · fitted to your HP" : "Real-time material preview"}</span><span>CONCEPT MODEL · MM</span></div>
  </section>;
});
