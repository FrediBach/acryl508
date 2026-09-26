"use client";
import { useId, useState, type CSSProperties } from "react";
import { defaultSpeakerConfiguration, type SpeakerConfiguration } from "@/lib/speaker";
import { speakerAcousticChamber, speakerAcousticComparison, speakerAcousticSources, type AcousticChamber } from "@/lib/speaker-acoustics";

const defaultReference = speakerAcousticChamber(defaultSpeakerConfiguration);
const percent = (ratio: number) => `${ratio >= 1 ? "+" : "−"}${Math.abs((ratio - 1) * 100).toFixed(1)}%`;
const hz = (value: number) => `${Math.round(value).toLocaleString("en-US")} Hz`;

export function SpeakerAcoustics({ config, onChange }: { config: SpeakerConfiguration; onChange: (patch: Partial<SpeakerConfiguration>) => void }) {
  const id = useId();
  const [pinned, setPinned] = useState<AcousticChamber | null>(null);
  const reference = pinned ?? defaultReference, current = speakerAcousticChamber(config);
  const [draft, setDraft] = useState<string | null>(null);
  const result = speakerAcousticComparison(current, reference, config.acousticDisplacementLitres);
  const sameVolume = Math.abs(result.volumeRatio - 1) < 0.0005;
  // The stable default domain fits every allowed enclosure size; a pinned
  // reference can be any size, so extend the domain when needed.
  const xmax = Math.max(30, Math.ceil(Math.max(current.grossLitres, reference.grossLitres) / 5) * 5);
  const xmin = 0.5, left = 43, right = 267, top = 24, bottom = 130;
  const ymax = Math.ceil(Math.max(150, result.tuningRatio * 100 + 10) / 50) * 50;
  const x = (v: number) => left + (v - xmin) / (xmax - xmin) * (right - left);
  const y = (ratio: number) => bottom - (ratio * 100 / ymax) * (bottom - top);
  const points = Array.from({ length: 120 }, (_, i) => {
    const v = xmin + (xmax - xmin) * i / 119;
    return [x(v), y(Math.sqrt(result.referenceLitres / v))];
  });
  const path = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ");
  const modePosition = (frequency: number) => `${Math.max(0, Math.min(100, (Math.log(frequency) - Math.log(350)) / Math.log(2000 / 350) * 100))}%`;
  const updateDisplacement = (value: number) => { if (Number.isFinite(value) && value >= 0 && value <= 4) onChange({ acousticDisplacementLitres: value }); };
  return <section className="speaker-acoustics" aria-labelledby={`${id}-title`}>
    <div className="acoustic-heading"><h3 id={`${id}-title`}>Dimensions & sound</h3><span>Geometry estimate</span></div>
    <p className="acoustic-volume"><strong>{result.currentLitres.toFixed(2)} L</strong> {config.acousticDisplacementLitres ? "estimated air volume" : "gross chamber"}<span>{sameVolume ? "Same volume as reference" : `${percent(result.volumeRatio)} vs reference`}</span></p>
    <figure className="acoustic-figure">
      <figcaption>Air-spring tuning tendency <strong>{sameVolume ? "Unchanged" : percent(result.tuningRatio)}</strong></figcaption>
      <svg className="acoustic-chart" viewBox="0 0 280 169" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`}>
        <title id={`${id}-chart-title`}>Volume versus relative air-spring resonance</title>
        <desc id={`${id}-chart-desc`}>Reference {result.referenceLitres.toFixed(2)} litres equals 100%. Current {result.currentLitres.toFixed(2)} litres gives {(result.tuningRatio * 100).toFixed(1)}%. This simplified constant-mass model excludes radiator suspension, driver response and DSP. It does not predict sound level or bass cutoff.</desc>
        <defs><clipPath id={`${id}-clip`}><rect x={left} y={top} width={right-left} height={bottom-top} /></clipPath></defs>
        <text x={left} y="13">Relative frequency (%)</text>
        {[0, ymax / 3, 2 * ymax / 3, ymax].map(value => <g key={value}><line className="acoustic-grid" x1={left} x2={right} y1={y(value / 100)} y2={y(value / 100)} /><text x={left-7} y={y(value / 100)+4} textAnchor="end">{Math.round(value)}</text></g>)}
        <line className="acoustic-reference" x1={left} x2={right} y1={y(1)} y2={y(1)} />
        <path className="acoustic-curve" d={path} clipPath={`url(#${id}-clip)`} />
        {[5, 10, 20, 30].filter(v => v <= xmax).map(v => <text key={v} x={x(v)} y="146" textAnchor="middle">{v}</text>)}
        <text x={(left+right)/2} y="165" textAnchor="middle">Air volume (L)</text>
        <rect className="acoustic-reference-point" x={x(result.referenceLitres)-4} y={y(1)-4} width="8" height="8" />
        <circle className="acoustic-current-point" cx={x(result.currentLitres)} cy={y(result.tuningRatio)} r="5" />
      </svg>
      <div className="acoustic-legend"><span><i className="acoustic-key-current" />Current</span><span><i className="acoustic-key-reference" />Reference · {result.referenceLitres.toFixed(2)} L</span></div>
      <p className="acoustic-reference-caption">Relative model; bass cutoff and loudness need measurements.</p>
    </figure>
    <p className="acoustic-takeaway">{sameVolume ? "The air spring is unchanged. Changing the proportions can still move the internal resonances below." : result.volumeRatio > 1 ? "More air volume softens the air spring, tending to lower bass tuning. This does not establish deeper or louder bass." : "Less air volume stiffens the air spring, tending to raise bass tuning. Actual bass output also depends on the drivers and DSP."}</p>
    <div className="acoustic-reference-controls"><button type="button" className="cutout-button" onClick={() => setPinned(current)}>Use current as reference</button>{pinned && <button type="button" className="cutout-button" onClick={() => setPinned(null)}>Use default</button>}</div>
    <p className="acoustic-reference-caption">{pinned ? "Pinned" : "Default acrylic case"} · {reference.width.toFixed(0)} × {reference.height.toFixed(0)} × {reference.depth.toFixed(0)} mm inside{!pinned && " · not the original MYND enclosure"}</p>
    <div className="acoustic-modes" role="group" aria-label="Estimated first internal standing waves">
      <h4>First internal standing waves</h4>
      {result.modes.map(mode => <div className="acoustic-mode" key={mode.axis}>
        <div className="acoustic-mode-label"><span>{mode.axis[0].toUpperCase()+mode.axis.slice(1)}</span><span>{hz(mode.referenceHz)} → <strong>{hz(mode.currentHz)}</strong></span></div>
        <div className="acoustic-mode-track" aria-hidden="true"><i className="acoustic-mode-reference" style={{ left: modePosition(mode.referenceHz) }} /><i className="acoustic-mode-current" style={{ left: modePosition(mode.currentHz) }} /></div>
      </div>)}
      <div className="acoustic-mode-scale"><span>350 Hz</span><span>1 kHz</span><span>2 kHz</span></div>
      <p>Logarithmic frequency scale. Ideal empty box, rigid walls. Markers show frequencies, not peak loudness; the real hardware and carriers change these modes.</p>
    </div>
    <details className="acoustic-assumptions"><summary>Assumptions & air volume</summary>
      <label className="acoustic-displacement-label" htmlFor={`${id}-displacement`}>Hardware + bracing displacement (L)</label>
      <div className="acoustic-displacement"><input id={`${id}-displacement`} type="number" min="0" max="4" step="0.05" value={draft ?? config.acousticDisplacementLitres} onFocus={() => setDraft(String(config.acousticDisplacementLitres))} onChange={event => { setDraft(event.target.value); if (event.target.value.trim()) updateDisplacement(event.target.valueAsNumber); }} onBlur={() => { if (draft?.trim()) updateDisplacement(Math.max(0, Math.min(4, Number(draft)))); setDraft(null); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /><input aria-label="Hardware displacement in litres" type="range" min="0" max="4" step="0.05" value={config.acousticDisplacementLitres} className="range-input" style={{ "--range-progress": `${config.acousticDisplacementLitres/4*100}%` } as CSSProperties} onChange={event => updateDisplacement(event.target.valueAsNumber)} /></div>
      <p>Zero uses gross volume. Enter your estimated displaced volume for the drivers, battery, electronics and carriers; the same amount is subtracted from both designs.</p>
      <p>The curve uses √(reference volume / current volume), with fixed moving mass and air stiffness only. Radiator suspension and losses are omitted. The standing-wave estimate uses 343 m/s and half a wavelength across each dimension.</p>
      <p>A measured sound profile needs driver parameters, passive-radiator mass/compliance, net volume and DSP settings. Grille changes, panel flex, leakage and gasket damping are not modeled; gaskets only affect the nominal chamber depth here.</p>
      <p>Model references: <a href={speakerAcousticSources.compliance} target="_blank" rel="noreferrer">air compliance</a> · <a href={speakerAcousticSources.modes} target="_blank" rel="noreferrer">rectangular cavity modes</a>.</p>
    </details>
  </section>;
}
