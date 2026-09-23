import { ArrowDownToLine } from "lucide-react";
import { caseDimensions, type CaseConfiguration } from "@/lib/configurator";

export function BuildSummary({ config, onExport }: { config: CaseConfiguration; onExport: () => void }) {
  const dimensions = caseDimensions(config);
  return (
    <section className="summary-panel" aria-label="Design summary">
      <div className="summary-title">
        <span className="micro-label">CASE SPECIFICATION</span>
        <h2>A508 <span>/</span> {config.rows * 3}U—{config.hp}</h2>
      </div>
      <dl className="spec-list">
        <div><dt>Footprint</dt><dd>{dimensions.width.toFixed(1)} × {dimensions.length.toFixed(1)} <small>mm</small></dd></div>
        <div><dt>Material</dt><dd>{config.thickness} mm GS <span className="spec-color" style={{ background: config.tint.color }} /></dd></div>
        <div><dt>Construction</dt><dd>{config.angle ? "7" : "5"} panels · {config.angle ? `${config.angle}° legs` : "flat base"}</dd></div>
      </dl>
      <button className="button button-orange summary-export" onClick={onExport} aria-label="Export configuration as JSON">
        <ArrowDownToLine size={15} />Export JSON
      </button>
    </section>
  );
}
