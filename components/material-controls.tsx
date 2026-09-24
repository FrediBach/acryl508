import { Check, ChevronDown } from "lucide-react";
import { useId, type CSSProperties } from "react";
import { acrylicTints, acrylicTransparencies, transparencyOption, type AcrylicTint, type AcrylicTransparency } from "@/lib/acrylic-material";

export function ColorChooser({ tint, onChange, label = "Acrylic color" }: { tint: AcrylicTint; onChange: (tint: AcrylicTint) => void; label?: string }) {
  return <><div className="field-heading"><span>{label}</span><span className="field-note">{tint.label}</span></div>
    <div className="swatch-list" role="group" aria-label={label}>{acrylicTints.map(option => <button type="button" key={option.id} className={`tint-swatch ${option.id === tint.id ? "tint-swatch-active" : ""}`} style={{ "--swatch": option.color } as CSSProperties} aria-label={option.label} aria-pressed={option.id === tint.id} title={option.label} onClick={() => onChange(option)}><span className={`swatch-surface ${option.id === "clear" ? "swatch-colorless" : ""}`}>{option.id === tint.id && <Check className="swatch-check" size={16} />}</span><span className="swatch-caption">{option.label}</span></button>)}</div>
  </>;
}
export function TransparencyChooser({ value, onChange, label = "Transparency", compact = false }: { value?: AcrylicTransparency; onChange: (value: AcrylicTransparency) => void; label?: string; compact?: boolean }) {
  const id = useId(), selected = transparencyOption(value);
  return <div className="transparency-control"><div className="inline-field"><label htmlFor={id}>{label}</label><span className="select-wrap"><select id={id} value={selected.id} aria-describedby={compact ? undefined : `${id}-note`} onChange={event => onChange(event.target.value as AcrylicTransparency)}>{acrylicTransparencies.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><ChevronDown size={12} /></span></div>{!compact && <p className="control-note" id={`${id}-note`}>{selected.label}: {selected.description}</p>}</div>;
}
export function MaterialPreviewNote() {
  return <p className="control-note">Colors and transparency are approximate previews. Check the shop’s available combinations and physical samples.</p>;
}
