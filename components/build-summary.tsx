import { ArrowDownToLine, ArrowUpRight } from "lucide-react";
import { caseDimensions, type CaseConfiguration } from "@/lib/configurator";
export function BuildSummary({ config, onExport, onGuide }: { config: CaseConfiguration; onExport: () => void; onGuide: () => void }) {
  const dimensions = caseDimensions(config);
  return <section className="summary-panel" aria-label="Design summary">
    <div className="summary-title"><span className="micro-label">YOUR SYSTEM, DEFINED.</span><h2>A508 <span>/</span> {config.rows * 3}U—{config.hp}</h2><p>Made to house your next idea.</p></div>
    <dl className="spec-list"><div><dt>Footprint</dt><dd>{dimensions.width.toFixed(1)} × {dimensions.length.toFixed(1)} <small>mm</small></dd></div><div><dt>Material</dt><dd>{config.thickness} mm GS <span className="spec-color" style={{ background: config.tint.color }} /></dd></div><div><dt>Construction</dt><dd>{config.angle ? "7" : "5"} panels · {config.angle ? `${config.angle}° legs` : "flat base"}</dd></div></dl>
    <div className="summary-actions"><button className="button button-orange" onClick={onExport}><ArrowDownToLine size={15} />Export configuration <ArrowUpRight size={14} /></button><button className="text-button" onClick={onGuide}>Read the build notes <ArrowUpRight size={12} /></button></div>
  </section>;
}
