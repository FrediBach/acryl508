"use client";
import { useMemo, useState, type RefObject } from "react";
import { X } from "lucide-react";
import type { DesignerMode } from "./configurator-header";
import { polygonBounds } from "@/lib/custom-cutouts";
import { casePathData } from "@/lib/svg-export";
import { fitCoupon, packSheets, stockSvg, type Fabrication } from "@/lib/fabrication";
import { downloadFile } from "./project-toolbar";
import { NumberControl } from "./cutout-controls";

const modeLabels: Record<DesignerMode, string> = { case: "Case designer", stand: "Synth stand", protector: "Synth protector", panel: "Panel designer" };

export function FabricationWorkspace({ fabrication, mode, dialogRef }: { fabrication: Fabrication; mode: DesignerMode; dialogRef: RefObject<HTMLDialogElement | null> }) {
  const [width, setWidth] = useState(1000), [height, setHeight] = useState(600), [gap, setGap] = useState(10), [rotate, setRotate] = useState(true);
  const layout = useMemo(() => packSheets(fabrication.parts, width, height, gap, rotate), [fabrication.parts, width, height, gap, rotate]);
  const blocked = fabrication.blocked || layout.unplaced.length > 0;
  return <dialog ref={dialogRef} id="fabrication-dialog" className="fabrication-dialog" aria-labelledby="fabrication-title" aria-describedby="fabrication-description" onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
    <div className="fabrication-dialog-body">
    <header className="fabrication-dialog-header">
      <div><h2 id="fabrication-title">Fabrication workspace</h2><p id="fabrication-description">{modeLabels[mode]} · {fabrication.blocked ? "Resolve geometry before SVG export" : `${fabrication.parts.length} parts · ${fabrication.thickness} mm acrylic`}</p></div>
      <button type="button" className="icon-button" aria-label="Close fabrication workspace" onClick={() => dialogRef.current?.close()}><X size={20} /></button>
    </header>
    <div className="fabrication-content">
      <div><h2>Parts & hardware</h2><div className="parts-table-wrap"><table className="parts-table"><thead><tr><th>Part</th><th>Size (mm)</th><th>Material</th></tr></thead><tbody>{fabrication.parts.map(part => { const bounds = polygonBounds(part.polygons); return <tr key={part.id}><td>{part.label}</td><td>{bounds.width.toFixed(1)} × {bounds.height.toFixed(1)}</td><td>{part.material}</td></tr>; })}</tbody></table></div>
        <ul>{fabrication.hardware.map(item => <li key={item}>{item}</li>)}</ul>
        <h3>Review before cutting</h3><p className="control-note">Full-size concept vectors. Verify tolerances, hardware and strength on a prototype. Apply kerf compensation once in CAM.</p>
        {fabrication.warnings.length > 0 && <ul className="fabrication-warnings" aria-label="Fabrication warnings">{fabrication.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
        {fabrication.blocked && <p className="project-error" role="alert">SVG downloads are unavailable until geometry is resolved.</p>}
        <h3>Test the slot fit</h3><p className="control-note">Cut a comb and tab from the same measured {fabrication.thickness} mm stock. Slot widths are labelled in an engraving group; insert the tab edge-on. The sample compares 0–0.4 mm clearance{fabrication.clearance ? `, including your ${fabrication.clearance} mm setting` : ""}.</p>
        <button className="cutout-button" onClick={() => downloadFile(fitCoupon(fabrication.thickness, fabrication.clearance).svg, "image/svg+xml", `acryl508-${fabrication.thickness}mm-fit-coupon.svg`)}>Download fit coupon</button>
      </div>
      <div><h2>Arrange on stock sheets</h2><p className="control-note">A simple shelf arrangement, separated by material. Dimensions and gaps are in millimetres. Parts may rotate 90°; no shapes are scaled. This is not optimized nesting.</p>
        <div className="stock-controls"><NumberControl label="Sheet width" value={width} min={50} max={3000} onChange={setWidth} /><NumberControl label="Sheet height" value={height} min={50} max={3000} onChange={setHeight} /><NumberControl label="Gap & border" value={gap} min={2} max={50} onChange={setGap} /></div>
        <label className="stock-rotate"><input type="checkbox" checked={rotate} onChange={event => setRotate(event.target.checked)} />Allow 90° rotation</label>
        {layout.unplaced.length > 0 && <p className="project-error" role="alert">These parts do not fit: {layout.unplaced.join(", ")}. Increase your stock size or enable rotation. Sheet downloads are blocked to prevent missing parts.</p>}
        <p className="control-note">{layout.sheets.length} stock sheet{layout.sheets.length === 1 ? "" : "s"}</p>
        <div className="stock-sheets">{layout.sheets.map((sheet, index) => <div className="stock-sheet" key={index}>
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Stock sheet ${index + 1}: ${sheet.material}`}><rect width={width} height={height} fill="var(--background)" stroke="currentColor" />{sheet.parts.map(part => <g key={part.id}><title>{`${part.label}${part.rotated ? " · rotated 90°" : ""}`}</title><path d={casePathData(part.polygons)} fill="var(--signal)" fillOpacity="0.22" fillRule="evenodd" stroke="currentColor" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />{part.engraving && <path d={casePathData(part.engraving)} fill="#2563eb" fillRule="evenodd" />}</g>)}</svg>
          <p>{index + 1}. {sheet.material} · {sheet.parts.length} parts</p><button className="cutout-button" disabled={blocked} onClick={() => downloadFile(stockSvg(sheet, width, height, fabrication.warnings), "image/svg+xml", `acryl508-stock-sheet-${index + 1}.svg`)}>Download sheet {index + 1}</button>
        </div>)}</div>
      </div>
    </div>
    </div>
  </dialog>;
}
