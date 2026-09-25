import { FabricationButton } from "./fabrication-button";
import { materialLabel, transparencyOption } from "@/lib/acrylic-material";
import { ArrowDownToLine, ChevronDown } from "lucide-react";
import { flatFeetLayout, flatFootStyles } from "@/lib/flat-feet";
import { patchBoardLayout, patchBoardSides } from "@/lib/patch-board";
import { cableHolderLayout } from "@/lib/cable-holder";
import { caseDimensions, caseThicknessLabel, panelThickness, footShapes, handleCount, handleSides, handleDimensions, panelCount, panelSides, panelTint, panelTransparency, rackFormatLabel, rackRowLayout, sidePanelMargin, ventStyles, type CaseConfiguration } from "@/lib/configurator";

export function BuildSummary({ config, canExportSvg = true, onExportJson, onExportSvg, onOpenFabrication }: { canExportSvg?: boolean; config: CaseConfiguration; onExportJson: () => void; onExportSvg: () => void; onOpenFabrication: () => void }) {
  const dimensions = caseDimensions(config);
  const rows = rackRowLayout(config);
  const holder = cableHolderLayout(config);
  const board = patchBoardLayout(config);
  const feet = flatFeetLayout(config);
  return (
    <section className="summary-panel case-summary" aria-label="Case specification">
      <div className="case-summary-header">
        <div className="summary-title">
          <span className="micro-label">CASE SPECIFICATION</span>
          <h2>A508 <span>/</span> {rackFormatLabel(config).replaceAll(" ", "")}—{config.hp}</h2>
        </div>
        <div className="summary-actions"><FabricationButton onClick={onOpenFabrication} />
          <button className="button button-dark summary-export" onClick={onExportJson} title="Download only this design’s settings and geometry" aria-label="Export case design JSON"><ArrowDownToLine size={15} />Design JSON</button>
          <button className="button button-orange summary-export" disabled={!canExportSvg} onClick={onExportSvg} aria-label="Export all sheets as SVG"><ArrowDownToLine size={15} />SVG sheets</button>
        </div>
      </div>
      <dl className="case-summary-overview">
        <div><dt>Case footprint</dt><dd>{dimensions.width.toFixed(1)} × {dimensions.length.toFixed(1)} <small>mm</small></dd></div>
        <div><dt>Material</dt><dd>{caseThicknessLabel(config)} mm GS <span className="spec-colors" aria-label={config.individualPanelTints ? "Individual sheet materials" : materialLabel(config.tint, config.transparency)}>{(config.individualPanelTints ? panelSides : panelSides.slice(0, 1)).map(side => { const tint = panelTint(config, side.value); return <span key={side.value} className="spec-color" style={{ background: tint.color }} title={`${side.label}: ${panelThickness(config, side.value)} mm · ${materialLabel(tint, panelTransparency(config, side.value))}`} />; })}</span></dd></div>
        <div><dt>Construction</dt><dd>{panelCount()} panels · {handleCount(config) ? `${handleCount(config)} integral ${handleCount(config) === 1 ? "grip" : "grips"}` : "no handles"}</dd></div>
      </dl>
      {!canExportSvg && <p className="cutout-warning" role="alert">Resolve empty panels and cutout errors before exporting SVG.</p>}
      <details className="case-summary-details">
        <summary><span>Full specifications</span><ChevronDown size={14} aria-hidden="true" /></summary>
        <div className="case-summary-groups" role="region" aria-label="Full case specifications" tabIndex={0}>
          <div className="case-summary-group">
            <h3>Enclosure & stance</h3>
            <dl>
              <div><dt>Transparency</dt><dd>{config.individualPanelTints ? "Per sheet" : transparencyOption(config.transparency).label}</dd></div>
              <div><dt>Side margin</dt><dd>{sidePanelMargin(config).toFixed(1)} mm</dd></div>
              <div><dt>Stance</dt><dd>{config.angle ? `${footShapes.find(shape => shape.value === config.footShape)?.label} · ${config.angle}°` : "Flat"}</dd></div>
              {feet.enabled && <div><dt>Flat-case feet</dt><dd>{flatFootStyles.find(style => style.value === feet.style)?.label} · {feet.height} mm</dd></div>}
              {rows.some(row => row.angle > 0) && <>
                <div><dt>Row angles</dt><dd>{rows.map(row => `${config.angle + row.angle}°`).join(" / ")} <small>rear → front</small></dd></div>
                <div><dt>Support feet</dt><dd>Integral to side panels</dd></div>
              </>}
            </dl>
          </div>
          <div className="case-summary-group">
            <h3>Accessories</h3>
            <dl>
              {config.handle ? <>
                <div><dt>Handle placement</dt><dd>{handleSides(config).join(" + ")}</dd></div>
                <div><dt>Handle size</dt><dd>{handleDimensions(config).width} × {handleDimensions(config).height} <small>mm</small></dd></div>
              </> : <div><dt>Handles</dt><dd>None</dd></div>}
              <div><dt>Patch cable board</dt><dd>{config.patchBoard ? `${board.width} × ${board.height} mm · ${board.holeCount * patchBoardSides(config).length} holes · ${patchBoardSides(config).join(" + ")}` : "None"}</dd></div>
              <div><dt>Cable holder</dt><dd>{config.cableHolder ? `${holder.slitCount} × ${holder.slitWidth} mm slits · ${holder.height} mm rise` : "None"}</dd></div>
            </dl>
          </div>
          <div className="case-summary-group">
            <h3>Ventilation & cutouts</h3>
            <dl>
              <div><dt>Bottom vents</dt><dd>{config.vents ? `${ventStyles.find(style => style.value === config.ventStyle)?.label} · ${config.ventDensity}` : "None"}</dd></div>
              {config.vents && <div><dt>Vent layout</dt><dd>{config.ventLayout === "staggered" ? "Staggered" : "Aligned"} · {config.ventCoverage === "field" ? "full field" : "two bands"}</dd></div>}
              {config.vents && config.ventDesign?.layers.length > 0 && <div><dt>Vent effects</dt><dd>{config.ventDesign.layers.length} layers · {config.ventDesign.size}% base size</dd></div>}
              <div><dt>Custom cutouts</dt><dd>{config.cutouts.length || "None"}</dd></div>
            </dl>
          </div>
        </div>
      </details>
    </section>
  );
}
