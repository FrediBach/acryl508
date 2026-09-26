"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, Copy, Plus, Trash2, Upload } from "lucide-react";
import type { CasePanels } from "@/lib/case-panels";
import { cutoutSides, maxCutouts, outlinePath, placedCutout, polygonBounds, type CustomCutout, type CutoutAction, type CutoutSide } from "@/lib/custom-cutouts";
import { builtinFonts, importSvg, loadBuiltinFont, textOutlines } from "@/lib/cutout-sources";

type CutoutFace = Pick<CasePanels["faces"]["front"], "original" | "polygons"> & Partial<Pick<CasePanels["faces"]["front"], "engraving">>;
type Props = {
  config: { cutouts: CustomCutout[]; engravings?: CustomCutout[] };
  panels: { faces: Partial<Record<CutoutSide, CutoutFace>>; reports: CasePanels["reports"] };
  onAction: (action: CutoutAction) => void; operation?: "cut" | "engrave";
  sides?: readonly { value: CutoutSide; label: string }[];
  description?: string;
};
export type { FontOption } from "@/lib/project-fonts";
import { addProjectFont, type FontOption } from "@/lib/project-fonts";
import { useProjectFonts } from "./use-project-fonts";
const message = (error: unknown) => error instanceof Error ? error.message : "The cutout could not be imported. Try a simpler outline.";
const round = (value: number) => Math.round(value * 10) / 10;

export function NumberControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className="cutout-number"><span>{label}</span><input type="number" min={min} max={max} step={0.1} value={draft ?? value} onFocus={() => setDraft(String(value))} onChange={event => {
    setDraft(event.target.value);
    const number = event.target.valueAsNumber;
    if (Number.isFinite(number) && number >= min && number <= max) onChange(number);
  }} onBlur={() => { if (draft?.trim() && Number.isFinite(Number(draft))) onChange(Math.min(max, Math.max(min, Number(draft)))); setDraft(null); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>;
}

export function TextEditor({ cutout, fonts, onImport, onUpdate }: { cutout: CustomCutout; fonts: FontOption[]; onImport: (file: File) => Promise<string>; onUpdate: (patch: Partial<CustomCutout>) => void }) {
  const source = cutout.source.kind === "text" ? cutout.source : null;
  const [text, setText] = useState(source?.text ?? "");
  const [fontId, setFontId] = useState(source?.fontId ?? builtinFonts[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  async function apply() {
    setBusy(true); setError("");
    try {
      const font = fonts.find(font => font.id === fontId)?.font ?? await loadBuiltinFont(fontId);
      const polygons = textOutlines(font, text);
      onUpdate({ name: text, polygons, source: { kind: "text", text, fontId, fontName: font.name } });
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try { setFontId(await onImport(file)); } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  return <div className="cutout-text-editor">
    <label className="cutout-field">Text<input maxLength={60} value={text} disabled={busy} onChange={event => setText(event.target.value)} /></label>
    <label className="cutout-field">Font<select value={fontId} disabled={busy} onChange={event => setFontId(event.target.value)}>{fonts.map(font => <option key={font.id} value={font.id}>{font.name}</option>)}</select></label>
    <div className="cutout-actions"><button className="cutout-button" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={12} />Import font</button><button className="cutout-button" disabled={busy || (text === source?.text && fontId === source?.fontId)} onClick={apply}>{busy ? "Preparing…" : "Apply text"}</button></div>
    <input ref={fileInput} type="file" accept=".ttf,.otf" aria-label="Import TTF or OTF font" hidden onChange={upload} />
    <p className="control-note">Use a supplied font or import a static TTF / OTF (up to 5 MB).</p>
    {error && <p className="cutout-warning" role="alert">{error}</p>}
  </div>;
}

export function CutoutControls({ config, panels, onAction, operation = "cut", sides = cutoutSides, description }: Props) {
  const engraving = operation === "engrave";
  const items = engraving ? config.engravings ?? [] : config.cutouts;
  const noun = engraving ? "engraving" : "cutout";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fonts = useProjectFonts();
  const input = useRef<HTMLInputElement>(null);
  const selected = items.find(cutout => cutout.id === selectedId) ?? items[0];
  const face = selected ? panels.faces[selected.side] : null;
  const bounds = face ? polygonBounds(face.original) : null;
  const limitReached = items.length >= maxCutouts;
  const warnings = engraving ? [] : panels.reports.filter(report => report.removedParts || report.empty || report.error || report.outside.length || report.clipped.length);
  function update(patch: Partial<CustomCutout>) { if (selected) onAction({ type: "update", id: selected.id, patch }); }
  function add(polygons: CustomCutout["polygons"], source: CustomCutout["source"], name: string) {
    const side = selected?.side ?? sides[0].value;
    const panel = panels.faces[side];
    if (!panel) return;
    const panelBounds = polygonBounds(panel.original);
    const ratio = polygonBounds(polygons).height;
    const cutout: CustomCutout = { id: crypto.randomUUID(), name, source, polygons, side, width: Math.max(1, round(Math.min(80, panelBounds.width * 0.5, panelBounds.height * 0.5 / ratio))), x: 0, y: 0, rotation: 0 };
    onAction({ type: "add", cutout }); setSelectedId(cutout.id);
  }
  async function addText() {
    setBusy(true); setError("");
    try {
      const font = await loadBuiltinFont(builtinFonts[0].id);
      add(textOutlines(font, "A508"), { kind: "text", text: "A508", fontId: builtinFonts[0].id, fontName: font.name }, "A508");
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function uploadSvg(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try {
      if (file.size > 1_000_000) throw new Error("Choose an SVG smaller than 1 MB.");
      add(importSvg(await file.text()), { kind: "svg", fileName: file.name }, file.name.replace(/\.svg$/i, ""));
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  const uploadFont = addProjectFont;
  function place(event: React.PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix || !bounds) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    update({ x: round(Math.max(bounds.left, Math.min(bounds.right, point.x))), y: round(Math.max(bounds.bottom, Math.min(bounds.top, -point.y))) });
  }
  return <>
    <p className="control-note">{description ?? (engraving ? "Etch SVG artwork or text into the outside surface of any sheet. Frosted marks keep the acrylic intact, including letter centres." : "Cut through any enclosure panel. Filled SVG paths or font outlines; each cutout has its own size and position.")}</p>
    <div className="cutout-actions"><button className="cutout-button" disabled={busy || limitReached} onClick={() => input.current?.click()}><Upload size={13} />Import SVG</button><button className="cutout-button" disabled={busy || limitReached} onClick={addText}><Plus size={13} />{busy ? "Preparing…" : "Add text"}</button></div>
    <input ref={input} type="file" accept=".svg,image/svg+xml" hidden aria-label={`Import SVG ${noun}`} onChange={uploadSvg} />
    <p className="control-note">SVG up to 1 MB. Convert strokes to filled paths first. {limitReached && `Limit reached: 20 ${noun}s.`}</p>
    {error && <p className="cutout-warning" role="alert">{error}</p>}
    {items.length > 0 && <div className="cutout-list" aria-label={`Custom ${noun}s`}>{items.map(cutout => <div className="cutout-list-row" key={cutout.id}>
      <button className={`cutout-choice ${cutout.id === selected?.id ? "cutout-selected" : ""}`} aria-pressed={cutout.id === selected?.id} onClick={() => setSelectedId(cutout.id)}><span>{cutout.name}</span><small>{cutoutSides.find(side => side.value === cutout.side)?.label}</small></button>
      <button className="icon-button" aria-label={`Duplicate ${cutout.name}`} disabled={limitReached} onClick={() => { const copy = { ...cutout, id: crypto.randomUUID(), name: `${cutout.name} copy` }; onAction({ type: "add", cutout: copy }); setSelectedId(copy.id); }}><Copy size={13} /></button>
      <button className="icon-button" aria-label={`Remove ${cutout.name}`} onClick={() => onAction({ type: "remove", id: cutout.id })}><Trash2 size={13} /></button>
    </div>)}</div>}
    {selected && face && bounds && <div className="cutout-editor" key={selected.id}>
      {selected.source.kind === "text" && <TextEditor key={selected.source.kind === "text" ? `${selected.id}-${selected.source.fontId}-${selected.source.text}` : selected.id} cutout={selected} fonts={fonts} onImport={uploadFont} onUpdate={patch => onAction({ type: "update", id: selected.id, patch })} />}
      {sides.length > 1 && <label className="cutout-field">Panel side<select value={selected.side} onChange={event => update({ side: event.target.value as CutoutSide })}>{sides.map(side => <option key={side.value} value={side.value}>{side.label}</option>)}</select></label>}
      <div className="cutout-numbers">
        <NumberControl label="Scale · width (mm)" value={selected.width} min={1} max={1000} onChange={width => update({ width })} />
        <NumberControl label="Rotation (°)" value={selected.rotation} min={-180} max={180} onChange={rotation => update({ rotation })} />
        <NumberControl label="Horizontal (mm)" value={selected.x} min={-1000} max={1000} onChange={x => update({ x })} />
        <NumberControl label="Vertical (mm)" value={selected.y} min={-1000} max={1000} onChange={y => update({ y })} />
      </div>
      <div className="cutout-layout-heading"><span>OUTSIDE VIEW · {selected.side.toUpperCase()}</span><button onClick={() => update({ x: 0, y: 0 })}>Centre</button></div>
      <svg className="cutout-layout" role="img" aria-label={`${selected.side} panel. Click or drag to position the selected ${noun}.`} viewBox={`${bounds.left - 5} ${-bounds.top - 5} ${bounds.width + 10} ${bounds.height + 10}`} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); place(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) place(event); }} onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)}>
        <path d={outlinePath(face.original)} className="cutout-original" fillRule="evenodd" />
        <path d={outlinePath(face.polygons)} className="cutout-material" fillRule="evenodd" />
        {engraving && face.engraving && <path d={outlinePath(face.engraving.polygons)} className="engraving-fill" fillRule="evenodd" />}
        <path d={outlinePath(placedCutout(selected))} className="cutout-outline" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="control-note">Click or drag to place. Solid areas show retained acrylic. Position is measured from the panel centre: +X right, +Y up. Proportions stay locked.{selected.side === "bottom" && " Rear edge is at the top."}</p>
    </div>}
    <div aria-live="polite" aria-atomic="true">{warnings.map(report => <div className="cutout-warning" key={report.side}>
      <AlertTriangle size={13} aria-hidden="true" /><div><strong>{cutoutSides.find(side => side.value === report.side)?.label} panel</strong>
        {report.removedParts > 0 && <p>{report.removedParts} loose {report.removedParts === 1 ? "part" : "parts"} removed ({report.removedArea.toFixed(1)} mm²). Only the largest piece attached to the panel perimeter is kept. Enclosed letter centres fall out.</p>}
        {report.empty && <p>No acrylic remains. Reduce or move the cutouts on this panel.</p>}
        {report.outside.length > 0 && <p>{report.outside.length} {report.outside.length === 1 ? "cutout does" : "cutouts do"} not intersect the remaining acrylic.</p>}
        {report.clipped.length > 0 && <p>Cutouts extend beyond this panel. Only the overlapping area is cut.</p>}
        {report.error && <p>{report.error}</p>}
      </div>
    </div>)}</div>
    {engraving ? <>
      {Object.entries(panels.faces).map(([side, panel]) => panel.engraving && (panel.engraving.outside.length || panel.engraving.clipped.length || panel.engraving.error) ? <p key={side} className="cutout-warning" role="status">{side}: {panel.engraving.error || `${panel.engraving.outside.length} outside the acrylic; ${panel.engraving.clipped.length} clipped at an edge or opening.`}</p> : null)}
      <p className="control-note">Engravings are clipped to the remaining acrylic. Blue filled paths export as a separate engraving operation; cut paths stay separate.</p>
    </> : <p className="control-note">Loose acrylic is removed automatically after all cuts, including enclosed letter centres. Use a stencil font to keep those centres connected.</p>}
  </>;
}
