import { ArrowDown, ArrowUp, Check, ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { acrylicTints, busboards, footShapes, maxRackUnits, maxSideMarginRatio, minSideMarginRatio, rackFormatLabel, rackRows, sidePanelMargin, totalRackUnits, type CaseConfiguration, type RackUnit } from "@/lib/configurator";

import { CutoutControls } from "@/components/cutout-controls";
import { VentControls } from "@/components/vent-controls";
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
function SideMarginField({ config, onChange }: { config: CaseConfiguration; onChange: (value: number) => void }) {
  const value = Math.min(maxSideMarginRatio, Math.max(minSideMarginRatio, config.sideMarginRatio ?? maxSideMarginRatio));
  const margin = sidePanelMargin(config);
  return <div className="range-field"><div className="field-heading"><label htmlFor="side-margin">Side panel edge margin</label><output className="margin-value" htmlFor="side-margin">{margin.toFixed(1)} mm</output></div><input id="side-margin" className="range-input" type="range" min={minSideMarginRatio} max={maxSideMarginRatio} step={0.1} value={value} aria-describedby="side-margin-note" aria-valuetext={`${margin.toFixed(1)} millimetres`} style={{ "--range-progress": `${(value - minSideMarginRatio) / (maxSideMarginRatio - minSideMarginRatio) * 100}%` } as CSSProperties} onChange={event => onChange(event.currentTarget.valueAsNumber)} /><div className="range-labels"><span>Near flush · {config.thickness} mm</span><span>Original · {config.thickness * 2} mm</span></div><p className="control-note" id="side-margin-note">Material retained beyond the end slots and below the base. The minimum keeps each slot centre 1.5× its width from the sheet edge; fabrication validation is still required.</p></div>;
}
export function ConfigurationPanel({ config, panels, onChange, onCutoutAction }: Props) {
  const rows = rackRows(config);
  const rackUnits = totalRackUnits(config);
  function updateRows(nextRows: RackUnit[]) { onChange({ rows: nextRows.length, rowUnits: nextRows }); }
  function replaceRow(index: number, units: RackUnit) { updateRows(rows.map((row, rowIndex) => rowIndex === index ? units : row)); }
  function moveRow(index: number, direction: -1 | 1) {
    const next = [...rows], target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    updateRows(next);
  }
  return <aside className="control-panel" aria-label="Case controls">
    <div className="panel-heading"><h2>Your configuration</h2><span className="micro-label">01—05</span></div>
    <section className="control-section"><SectionTitle number="01">Dimensions</SectionTitle>
      <div className="field-heading"><span>Rack rows</span><span className="field-note">{rackFormatLabel(config)} · {rackUnits}U total</span></div>
      <div className="rack-layout" aria-label="Rack row layout">
        <span className="rack-edge">REAR</span>
        {rows.map((units, index) => <div className="rack-row" key={index}>
          <span className="rack-row-number">{String(index + 1).padStart(2, "0")}</span>
          <div className="rack-size" role="group" aria-label={`Row ${index + 1} size`}>
            {([1, 3] as const).map(option => <button key={option} className={units === option ? "rack-size-active" : ""} aria-pressed={units === option} disabled={option > units && rackUnits - units + option > maxRackUnits} onClick={() => replaceRow(index, option)}>{option}U</button>)}
          </div>
          <button className="rack-icon" aria-label={`Move row ${index + 1} toward rear`} title="Move toward rear" disabled={index === 0} onClick={() => moveRow(index, -1)}><ArrowUp size={13} /></button>
          <button className="rack-icon" aria-label={`Move row ${index + 1} toward front`} title="Move toward front" disabled={index === rows.length - 1} onClick={() => moveRow(index, 1)}><ArrowDown size={13} /></button>
          <button className="rack-icon rack-remove" aria-label={`Remove row ${index + 1}`} title="Remove row" disabled={rows.length === 1} onClick={() => updateRows(rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={13} /></button>
        </div>)}
        <span className="rack-edge">FRONT</span>
      </div>
      <div className="rack-add"><span>Add row</span>{([1, 3] as const).map(units => <button key={units} disabled={rackUnits + units > maxRackUnits} onClick={() => updateRows([...rows, units])}><Plus size={11} />{units}U</button>)}</div>
      <RangeField label="Width" value={config.hp} min={20} max={168} unit="HP" onChange={hp => onChange({ hp })} />
      <div className="preset-row"><span>Quick set</span>{[42, 62, 84, 104, 126].map(hp => <button key={hp} onClick={() => onChange({ hp })} aria-pressed={config.hp === hp} className={config.hp === hp ? "preset-active" : ""}>{hp}</button>)}</div>
      <RangeField label="Internal depth" value={config.depth} min={50} max={180} unit="mm" onChange={depth => onChange({ depth })} />
      <SideMarginField config={config} onChange={sideMarginRatio => onChange({ sideMarginRatio })} />
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
      <VentControls config={config} panels={panels} onChange={onChange} />
      <div className="inline-field"><label htmlFor="busboard">Busboard</label><div className="select-wrap board-select"><select id="busboard" value={config.busboard} onChange={event => onChange({ busboard: event.target.value as CaseConfiguration["busboard"] })}>{Object.entries(busboards).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={12} /></div></div>
      {config.busboard !== "none" && <p className="control-note board-note">Layout concept. Exact board fit and hole patterns need verification.</p>}
      <div className="hardware-note"><span className="hardware-dot" />Black hardware <span>Mechanical assembly · no glue</span></div>
      <p className="control-note">Case panels interlock in closed slots. Rail-end screws retain the sides; removing one side releases the panels.</p>
    </section>
    <section className="control-section"><SectionTitle number="05" detail={`${config.cutouts.length} ADDED`}>Custom cutouts</SectionTitle><CutoutControls config={config} panels={panels} onAction={onCutoutAction} /></section>
  </aside>;
}
