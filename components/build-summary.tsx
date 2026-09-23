import { ArrowDownToLine } from "lucide-react";
import { cableHolderLayout } from "@/lib/cable-holder";
import { caseDimensions, footShapes, handleCount, handleDimensions, panelCount, panelSides, panelTint, rackFormatLabel, sidePanelMargin, ventStyles, type CaseConfiguration } from "@/lib/configurator";

export function BuildSummary({ config, onExportJson, onExportSvg }: { config: CaseConfiguration; onExportJson: () => void; onExportSvg: () => void }) {
  const dimensions = caseDimensions(config);
  const holder = cableHolderLayout(config);
  return (
    <section className="summary-panel" aria-label="Design summary">
      <div className="summary-title">
        <span className="micro-label">CASE SPECIFICATION</span>
        <h2>A508 <span>/</span> {rackFormatLabel(config).replaceAll(" ", "")}—{config.hp}</h2>
      </div>
      <dl className="spec-list">
        <div><dt>Case footprint</dt><dd>{dimensions.width.toFixed(1)} × {dimensions.length.toFixed(1)} <small>mm</small></dd></div>
        <div><dt>Material</dt><dd>{config.thickness} mm GS <span className="spec-colors" aria-label={config.individualPanelTints ? "Individual sheet tints" : config.tint.label}>{(config.individualPanelTints ? panelSides : panelSides.slice(0, 1)).map(side => { const tint = panelTint(config, side.value); return <span key={side.value} className="spec-color" style={{ background: tint.color }} title={`${side.label}: ${tint.label}`} />; })}</span></dd></div>
        <div><dt>Construction</dt><dd>{panelCount()} panels · {handleCount(config) ? `${handleCount(config)} integral ${handleCount(config) === 1 ? "grip" : "grips"}` : "no handles"}</dd></div>
        {config.handle && <div><dt>Handle size</dt><dd>{handleDimensions(config).width} × {handleDimensions(config).height} <small>mm</small></dd></div>}
        {config.cableHolder && <div><dt>Cable holder</dt><dd>{holder.slitCount} × {holder.slitWidth} mm slits · {holder.height} mm rise</dd></div>}
        <div><dt>Side margin</dt><dd>{sidePanelMargin(config).toFixed(1)} mm</dd></div>
        <div><dt>Stance</dt><dd>{config.angle ? `${footShapes.find(shape => shape.value === config.footShape)?.label} · ${config.angle}°` : "Flat"}</dd></div>
        <div><dt>Bottom vents</dt><dd>{config.vents ? `${ventStyles.find(style => style.value === config.ventStyle)?.label} · ${config.ventDensity}` : "None"}</dd></div>
        {config.vents && <div><dt>Vent layout</dt><dd>{config.ventLayout === "staggered" ? "Staggered" : "Aligned"} · {config.ventCoverage === "field" ? "full field" : "two bands"}</dd></div>}
        {config.vents && config.ventDesign?.layers.length > 0 && <div><dt>Vent effects</dt><dd>{config.ventDesign.layers.length} layers · {config.ventDesign.size}% base size</dd></div>}
        <div><dt>Custom cutouts</dt><dd>{config.cutouts.length || "None"}</dd></div>
      </dl>
      <div className="summary-actions">
        <button className="button button-dark summary-export" onClick={onExportJson} aria-label="Export configuration as JSON"><ArrowDownToLine size={15} />JSON</button>
        <button className="button button-orange summary-export" onClick={onExportSvg} aria-label="Export all sheets as SVG"><ArrowDownToLine size={15} />SVG sheets</button>
      </div>
    </section>
  );
}
