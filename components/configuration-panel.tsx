import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { acrylicTints, busboards, footShapes, rowOptions, type CaseConfiguration } from "@/lib/configurator";

import { CutoutControls } from "@/components/cutout-controls";
import type { CasePanels } from "@/lib/case-panels";
import type { CutoutAction } from "@/lib/custom-cutouts";

type Props = { panels: CasePanels; onCutoutAction: (action: CutoutAction) => void; config: CaseConfiguration; onChange: (update: Partial<CaseConfiguration>) => void };
function SectionTitle({ number, children, detail }: { number: string; children: ReactNode; detail?: string }) {
  return <div className="section-heading"><span className="section-number">{number}</span><h3>{children}</h3>{detail && <span className="section-detail">{detail}</span>}</div>;
}
function RangeField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  function commitDraft() {
    const number = Number(draft);
    if (draft.trim() && Number.isFinite(number)) onChange(Math.min(max, Math.max(min, Math.round(number))));
    setEditing(false);
  }
  return <div className="range-field"><div className="field-heading"><label htmlFor={`range-${unit}`}>{label}</label><div className="number-field"><input type="number" aria-label={`${label} in ${unit}`} min={min} max={max} step={1} value={editing ? draft : value} inputMode="numeric" onFocus={() => { setDraft(String(value)); setEditing(true); }} onBlur={commitDraft} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} onChange={event => { setDraft(event.target.value); const number = Number(event.target.value); if (event.target.value && Number.isInteger(number) && number >= min && number <= max) onChange(number); }} /><span>{unit}</span></div></div><input id={`range-${unit}`} className="range-input" type="range" min={min} max={max} step={1} value={value} style={{ "--range-progress": `${(value - min) / (max - min) * 100}%` } as CSSProperties} onChange={event => onChange(event.currentTarget.valueAsNumber)} /><div className="range-labels"><span>{min} {unit}</span><span>{max} {unit}</span></div></div>;
}
export function ConfigurationPanel({ config, panels, onChange, onCutoutAction }: Props) {
  return <aside className="control-panel" aria-label="Case controls">
    <div className="panel-heading"><h2>Your configuration</h2><span className="micro-label">01—05</span></div>
    <section className="control-section"><SectionTitle number="01">Dimensions</SectionTitle>
      <div className="field-heading"><span>Rack format</span><span className="field-note">{config.rows} {config.rows === 1 ? "row" : "rows"}</span></div>
      <div className="segmented-control" aria-label="Rack format">{rowOptions.map(option => <button key={option.value} className={`segment ${config.rows === option.value ? "segment-active" : ""}`} aria-pressed={config.rows === option.value} onClick={() => onChange({ rows: option.value })}>{option.label}</button>)}</div>
      <RangeField label="Width" value={config.hp} min={20} max={168} unit="HP" onChange={hp => onChange({ hp })} />
      <div className="preset-row"><span>Quick set</span>{[42, 62, 84, 104, 126].map(hp => <button key={hp} onClick={() => onChange({ hp })} aria-pressed={config.hp === hp} className={config.hp === hp ? "preset-active" : ""}>{hp}</button>)}</div>
      <RangeField label="Internal depth" value={config.depth} min={50} max={180} unit="mm" onChange={depth => onChange({ depth })} />
    </section>
    <section className="control-section" id="materials"><SectionTitle number="02" detail="GS CAST ACRYLIC">Material</SectionTitle>
      <div className="field-heading"><span>Acrylic tint</span><span className="field-note">{config.tint.label}</span></div>
      <div className="swatch-list" aria-label="Acrylic tint">{acrylicTints.map(tint => <button key={tint.id} className={`tint-swatch ${config.tint.id === tint.id ? "tint-swatch-active" : ""}`} style={{ "--swatch": tint.color } as CSSProperties} aria-label={`${tint.label} acrylic`} aria-pressed={config.tint.id === tint.id} title={tint.label} onClick={() => onChange({ tint })}><span className="swatch-surface">{config.tint.id === tint.id && <Check size={18} strokeWidth={1.7} />}</span><span className="swatch-caption">{tint.id === "orange" ? "Orange" : tint.id === "green" ? "Sea glass" : tint.label}</span></button>)}</div>
      <div className="inline-field"><label htmlFor="thickness">Sheet thickness</label><div className="select-wrap"><select id="thickness" value={config.thickness} onChange={event => onChange({ thickness: Number(event.target.value) })}>{[3, 4, 5, 6].map(value => <option key={value} value={value}>{value} mm</option>)}</select><ChevronDown size={12} /></div></div>
    </section>
    <section className="control-section"><SectionTitle number="03">Stance</SectionTitle>
      <div className="segmented-control stance-control" role="group" aria-label="Foot angle">{[0, 10, 20, 30].map(angle => <button key={angle} className={`segment ${config.angle === angle ? "segment-active" : ""}`} aria-pressed={config.angle === angle} onClick={() => onChange({ angle })}>{angle === 0 ? "No feet" : `${angle}°`}</button>)}</div>
      <fieldset className="foot-shape-field" disabled={config.angle === 0} aria-describedby="foot-shape-note">
        <legend>Foot shape <span className="field-note">Acrylic sheet</span></legend>
        <div className="segmented-control foot-shape-control">{footShapes.map(shape => <button key={shape.value} className={`segment ${config.footShape === shape.value ? "segment-active" : ""}`} aria-pressed={config.footShape === shape.value} title={shape.description} onClick={() => onChange({ footShape: shape.value })}>{shape.label}</button>)}</div>
      </fieldset>
      <p className="control-note" id="foot-shape-note">{config.angle === 0 ? "Choose an angle to add two acrylic feet." : footShapes.find(shape => shape.value === config.footShape)?.description}</p>
      {config.angle > 0 && <p className="control-note">Two removable bolts per foot, with washers and locknuts. No glue.</p>}
    </section>
    <section className="control-section hardware-section"><SectionTitle number="04">The details</SectionTitle>
      <div className="inline-field"><label htmlFor="handle">Acrylic handle</label><button id="handle" role="switch" aria-checked={config.handle} aria-label="Acrylic handle" aria-describedby="handle-note" className={`toggle ${config.handle ? "toggle-on" : ""}`} onClick={() => onChange({ handle: !config.handle })}><span>{config.handle ? <Plus size={10} /> : <Minus size={10} />}</span></button></div>
      <p className="control-note handle-note" id="handle-note">Rear-mounted grip · same tint and sheet thickness.</p>
      <div className="inline-field"><label htmlFor="vents">Bottom ventilation</label><button id="vents" role="switch" aria-checked={config.vents} aria-label="Bottom ventilation" className={`toggle ${config.vents ? "toggle-on" : ""}`} onClick={() => onChange({ vents: !config.vents })}><span>{config.vents ? <Plus size={10} /> : <Minus size={10} />}</span></button></div>
      <div className="inline-field"><label htmlFor="busboard">Busboard</label><div className="select-wrap board-select"><select id="busboard" value={config.busboard} onChange={event => onChange({ busboard: event.target.value as CaseConfiguration["busboard"] })}>{Object.entries(busboards).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={12} /></div></div>
      {config.busboard !== "none" && <p className="control-note board-note">Layout concept. Exact board fit and hole patterns need verification.</p>}
      <div className="hardware-note"><span className="hardware-dot" />Black hardware <span>Mechanical assembly · no glue</span></div>
      <p className="control-note">Case panels interlock in closed slots. Rail-end screws retain the sides; removing one side releases the panels.</p>
    </section>
    <section className="control-section"><SectionTitle number="05" detail={`${config.cutouts.length} ADDED`}>Custom cutouts</SectionTitle><CutoutControls config={config} panels={panels} onAction={onCutoutAction} /></section>
  </aside>;
}
