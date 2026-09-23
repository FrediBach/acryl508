import { ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { useId, type CSSProperties } from "react";
import { ventDensities, ventStyles, type CaseConfiguration } from "@/lib/configurator";
import { defaultVentLayer, maxVentLayers, normalizeVentDesign, ventPresets, ventTargets, ventWaveforms, type VentDesign, type VentLayer } from "@/lib/vent-design";
import { outlinePath, polygonBounds } from "@/lib/custom-cutouts";
import type { CasePanels } from "@/lib/case-panels";

function EffectRange({ label, value, min, max, step = 1, unit = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="vent-range"><div className="field-heading"><label htmlFor={id}>{label}</label><output htmlFor={id}>{Number(value.toFixed(2))}{unit}</output></div><input id={id} type="range" className="range-input" min={min} max={max} step={step} value={value} style={{ "--range-progress": `${(value - min) / (max - min) * 100}%` } as CSSProperties} onChange={event => onChange(event.currentTarget.valueAsNumber)} /></div>;
}

export function VentControls({ config, panels, onChange }: { config: CaseConfiguration; panels: CasePanels; onChange: (update: Partial<CaseConfiguration>) => void }) {
  const design = normalizeVentDesign(config.ventDesign);
  const update = (patch: Partial<VentDesign>) => onChange({ ventDesign: { ...design, ...patch } });
  const updateLayer = (index: number, patch: Partial<VentLayer>) => update({ layers: design.layers.map((layer, i) => i === index ? { ...layer, ...patch } : layer) });
  const face = panels.faces.bottom, bounds = polygonBounds(face.original), layout = panels.ventilation;
  const selectedPreset = ventPresets.find(preset => JSON.stringify(normalizeVentDesign(preset.design)) === JSON.stringify(design));
  return <div className="vent-controls">
    <div className="inline-field"><label htmlFor="vents">Bottom ventilation</label><button id="vents" role="switch" aria-checked={config.vents} aria-label="Bottom ventilation" className={`toggle ${config.vents ? "toggle-on" : ""}`} onClick={() => onChange({ vents: !config.vents })}><span>{config.vents ? <Plus size={10} /> : <Minus size={10} />}</span></button></div>
    <fieldset className="vent-options" disabled={!config.vents} aria-describedby="vent-note">
      <legend className="sr-only">Bottom vent options</legend>
      <div className="inline-field"><label htmlFor="vent-style">Opening shape</label><div className="select-wrap"><select id="vent-style" value={config.ventStyle} onChange={event => onChange({ ventStyle: event.target.value as CaseConfiguration["ventStyle"] })}>{ventStyles.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}</select><ChevronDown size={12} /></div></div>
      <div className="field-heading"><span id="vent-density-label">Vent density</span></div>
      <div className="segmented-control" role="group" aria-labelledby="vent-density-label">{ventDensities.map(density => <button key={density.value} className={`segment ${config.ventDensity === density.value ? "segment-active" : ""}`} aria-pressed={config.ventDensity === density.value} onClick={() => onChange({ ventDensity: density.value })}>{density.label}</button>)}</div>
      <div className="field-heading"><span id="vent-presets-label">Pattern starting points</span><span className="field-note">{selectedPreset?.label ?? "Custom"}</span></div>
      <div className="vent-presets" role="group" aria-labelledby="vent-presets-label">{ventPresets.map(preset => <button key={preset.id} aria-pressed={selectedPreset?.id === preset.id} onClick={() => onChange({ ventDesign: normalizeVentDesign(preset.design) })}>{preset.label}</button>)}</div>
      <EffectRange label="Base length / size" value={design.size} min={0} max={100} unit="%" onChange={size => update({ size })} />
      <div className="vent-preview-heading"><span>BOTTOM · OUTSIDE VIEW</span><span>{config.vents ? layout.openings.length : 0} OPENINGS</span></div>
      <svg className="vent-preview" role="img" aria-label="Bottom panel with the current vent effects and custom cutouts" viewBox={`${bounds.left - 4} ${-bounds.top - 4} ${bounds.width + 8} ${bounds.height + 8}`}><path d={outlinePath(face.polygons)} fillRule="evenodd" vectorEffect="non-scaling-stroke" /></svg>
      <div className="vent-effects-heading"><span>Effect layers · {design.layers.length}/{maxVentLayers}</span><button className="cutout-button" disabled={design.layers.length >= maxVentLayers} onClick={() => update({ layers: [...design.layers, { ...defaultVentLayer }] })}><Plus size={12} />Add effect</button></div>
      {design.layers.length === 0 && <p className="control-note">Choose a starting point or add an effect. Layers combine to vary each opening.</p>}
      {design.layers.map((layer, index) => <details className="vent-layer" key={index} open>
        <summary>Effect {index + 1} · {ventWaveforms.find(wave => wave.value === layer.waveform)?.label}<ChevronDown size={12} /></summary>
        <div className="vent-layer-body">
          <div className="vent-layer-selects"><label>Field<select aria-label={`Effect ${index + 1} field`} value={layer.waveform} onChange={event => updateLayer(index, { waveform: event.target.value as VentLayer["waveform"] })}>{ventWaveforms.map(wave => <option key={wave.value} value={wave.value}>{wave.label}</option>)}</select></label><label>Affects<select aria-label={`Effect ${index + 1} target`} value={layer.target} onChange={event => updateLayer(index, { target: event.target.value as VentLayer["target"] })}>{ventTargets.map(target => <option key={target.value} value={target.value}>{target.label}</option>)}</select></label></div>
          <EffectRange label={`Effect ${index + 1} strength`} value={layer.amount} min={-100} max={100} unit="%" onChange={amount => updateLayer(index, { amount })} />
          <EffectRange label={`Effect ${index + 1} frequency`} value={layer.frequency} min={0.25} max={6} step={0.25} unit="×" onChange={frequency => updateLayer(index, { frequency })} />
          <EffectRange label={`Effect ${index + 1} phase`} value={layer.phase} min={0} max={360} step={5} unit="°" onChange={phase => updateLayer(index, { phase })} />
          {layer.waveform !== "ripple" && <EffectRange label={`Effect ${index + 1} direction`} value={layer.angle} min={0} max={180} step={5} unit="°" onChange={angle => updateLayer(index, { angle })} />}
          <button className="cutout-button" aria-label={`Remove effect ${index + 1}`} onClick={() => update({ layers: design.layers.filter((_, i) => i !== index) })}><Trash2 size={11} />Remove effect</button>
        </div>
      </details>)}
      {design.layers.some(layer => layer.waveform === "noise") && <div className="vent-seed"><span>Variation {design.seed}</span><button className="cutout-button" onClick={() => update({ seed: design.seed % 9999 + 1 })}>New variation</button></div>}
      {design.layers.length > 0 && <p className="control-note">Position effects use the spare room around each opening. Reduce base size or density for more movement. Openings never close completely.</p>}
    </fieldset>
    <p className="control-note" id="vent-note">{config.vents ? `At least ${(layout.minimumWeb * 100).toFixed(1)} mm between vents and ${(layout.edgeMargin * 100).toFixed(1)} mm at the border. Length and movement stay within these limits.` : "Enable ventilation to use the selected pattern and effects."}</p>
    {config.vents && <p className="control-note vent-limit-note" role="status">{layout.pitchAdjusted && "Density reduced for this sheet thickness. "}{layout.limited > 0 && `${layout.limited} openings reached an effect limit. `}{layout.omitted > 0 && `${layout.omitted} openings omitted near custom cutouts. `}Geometry limits only; strength, heat and laser tolerances still need prototype validation.</p>}
  </div>;
}
