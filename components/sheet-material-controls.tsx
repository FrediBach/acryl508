"use client";
import { useId, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { acrylicTints, materialLabel } from "@/lib/acrylic-material";
import { allSheetMaterials, sheetAppearanceSource, sheetMaterial, sheetThicknessLabel, type SheetMaterialConfiguration } from "@/lib/sheet-materials";
import { ColorChooser, MaterialPreviewNote, TransparencyChooser } from "./material-controls";

type Props = { config: SheetMaterialConfiguration; parts: { id: string; label: string }[]; limits: { min: number; max: number }; label: string; onChange: (patch: Partial<SheetMaterialConfiguration>) => void };
function SheetThicknessField({ id, label, value, limits, onChange }: { id: string; label: string; value: number; limits: Props["limits"]; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <div className="inline-field"><label htmlFor={id}>{label}</label><div className="number-field"><input id={id} type="number" min={limits.min} max={limits.max} step={0.1} value={draft ?? value} onFocus={() => setDraft(String(value))} onChange={event => {
    setDraft(event.target.value);
    const thickness = event.currentTarget.valueAsNumber;
    if (Number.isFinite(thickness) && thickness >= limits.min && thickness <= limits.max) onChange(thickness);
  }} onBlur={() => { if (draft?.trim() && Number.isFinite(Number(draft))) onChange(Math.max(limits.min, Math.min(limits.max, Number(draft)))); setDraft(null); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /><span>mm</span></div></div>;
}
export function SheetMaterialControls({ config, parts, limits, label, onChange }: Props) {
  const id = useId(), individual = Boolean(config.individualSheetMaterials);
  return <>
    <ColorChooser tint={config.tint} label={individual ? "Apply color to all sheets" : label} onChange={tint => onChange(allSheetMaterials(config, { tint }))} />
    <TransparencyChooser value={config.transparency} label={individual ? "All sheets’ transparency" : "Transparency"} onChange={transparency => onChange(allSheetMaterials(config, { transparency }))} />
    <MaterialPreviewNote />
    <div className="inline-field"><label htmlFor={id}>Individual sheet materials</label><button id={id} role="switch" aria-checked={individual} aria-label="Use individual acrylic materials for each sheet" aria-describedby={`${id}-note`} className={`toggle ${individual ? "toggle-on" : ""}`} onClick={() => onChange({ individualSheetMaterials: !individual })}><span>{individual ? <Plus size={10} /> : <Minus size={10} />}</span></button></div>
    <p className="control-note" id={`${id}-note`}>{individual ? "Choose a color, transparency and thickness for each sheet. Slots and tabs adapt to the adjoining sheets." : "All sheets use the same color, transparency and thickness."}</p>
    {individual && <div className="panel-tint-list" aria-label="Individual sheet materials">{parts.map(part => {
      const material = sheetMaterial(config, part.id), sourceId = sheetAppearanceSource(part.id);
      const parent = sourceId !== part.id ? parts.find(item => item.id === sourceId) : undefined;
      return <div className="panel-material" key={part.id}>
        {parent ? <p className="control-note"><strong>{part.label}</strong> · Color and transparency follow {parent.label}.</p> : <><label className="inline-field" htmlFor={`${id}-${part.id}-color`}><span><i style={{ background: material.tint.color }} />{part.label}</span><span className="select-wrap"><select id={`${id}-${part.id}-color`} aria-label={`${part.label} color`} value={material.tint.id} onChange={event => { const tint = acrylicTints.find(tint => tint.id === event.target.value); if (tint) onChange({ sheetTints: { ...config.sheetTints, [part.id]: tint } }); }}>{!acrylicTints.some(tint => tint.id === material.tint.id) && <option value={material.tint.id}>{material.tint.label}</option>}{acrylicTints.map(tint => <option key={tint.id} value={tint.id}>{tint.label}</option>)}</select><ChevronDown size={12} /></span></label>
        <TransparencyChooser compact label={`${part.label} transparency`} value={material.transparency} onChange={transparency => onChange({ sheetTransparencies: { ...config.sheetTransparencies, [part.id]: transparency } })} /></>}
        <SheetThicknessField id={`${id}-${part.id}-thickness`} label={`${part.label} thickness`} value={material.thickness} limits={limits} onChange={thickness => onChange({ sheetThicknesses: { ...config.sheetThicknesses, [part.id]: thickness } })} />
      </div>;
    })}</div>}
  </>;
}
export function SheetMaterialSwatches({ config, parts }: Pick<Props, "config" | "parts">) {
  return <>{sheetThicknessLabel(config, parts)} mm GS <span className="spec-colors sheet-material-swatches" aria-label={config.individualSheetMaterials ? "Individual sheet materials" : materialLabel(config.tint, config.transparency)}>{(config.individualSheetMaterials ? parts : parts.slice(0, 1)).map(part => { const material = sheetMaterial(config, part.id); return <span key={part.id} className="spec-color" style={{ background: material.tint.color }} title={`${part.label}: ${material.thickness} mm · ${materialLabel(material.tint, material.transparency)}`} />; })}</span></>;
}
