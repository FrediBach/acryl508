"use client";
import { useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { TextEditor } from "@/components/cutout-controls";
import { builtinFonts, importSvg, loadBuiltinFont, textOutlines } from "@/lib/cutout-sources";
import { polygonBounds } from "@/lib/custom-cutouts";
import { maxPanelArtwork, type DesignedPanel, type PanelArtwork, type PanelConfiguration } from "@/lib/panel-designer";

import { addProjectFont } from "@/lib/project-fonts";
import { useProjectFonts } from "./use-project-fonts";
export function PanelArtworkControls({ panel, selected, onChange, onSelect }: { panel: DesignedPanel; selected?: PanelArtwork; onChange: (patch: Partial<PanelConfiguration>) => void; onSelect: (id: string) => void }) {
  const fonts = useProjectFonts();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const svgInput = useRef<HTMLInputElement>(null);
  const message = (error: unknown) => error instanceof Error ? error.message : "The artwork could not be imported.";
  function add(polygons: PanelArtwork["polygons"], source: PanelArtwork["source"], name: string) {
    const width = Math.max(0.5, Math.min(25, panel.width * 0.7, panel.height * 0.5 / polygonBounds(polygons).height));
    const art: PanelArtwork = { id: crypto.randomUUID(), name, source, polygons, width, x: 0, y: 0, rotation: 0, side: "front", operation: "engrave" };
    onChange({ artwork: [...panel.config.artwork, art] }); onSelect(art.id);
  }
  async function addText() {
    setBusy(true); setError("");
    try { const font = await loadBuiltinFont(builtinFonts[0].id); add(textOutlines(font, "A508"), { kind: "text", text: "A508", fontId: builtinFonts[0].id, fontName: font.name }, "A508"); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function uploadSvg(file?: File) {
    if (!file) return; setBusy(true); setError("");
    try { if (file.size > 1_000_000) throw new Error("Choose an SVG smaller than 1 MB."); add(importSvg(await file.text()), { kind: "svg", fileName: file.name }, file.name.replace(/\.svg$/i, "")); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  const uploadFont = addProjectFont;
  return <>
    <div className="cutout-actions"><button className="cutout-button" disabled={busy || panel.config.artwork.length >= maxPanelArtwork} onClick={addText}><Plus size={13} />Add text</button><button className="cutout-button" disabled={busy || panel.config.artwork.length >= maxPanelArtwork} onClick={() => svgInput.current?.click()}><Upload size={13} />Import SVG</button></div>
    <input ref={svgInput} type="file" hidden accept=".svg,image/svg+xml" aria-label="Import panel artwork SVG" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void uploadSvg(file); }} />
    <p className="control-note">Artwork starts as engraving. Select it in the editor to change operation, scale, rotation or position. Import filled SVG paths up to 1 MB; convert strokes to outlines first. Up to {maxPanelArtwork} artworks.</p>
    {busy && <p className="control-note" role="status">Preparing artwork…</p>}{error && <p className="cutout-warning" role="alert">{error}</p>}
    {selected?.source.kind === "text" && <TextEditor key={`${selected.id}-${selected.source.fontId}-${selected.source.text}`} cutout={selected} fonts={fonts} onImport={uploadFont} onUpdate={patch => onChange({ artwork: panel.config.artwork.map(a => a.id === selected.id ? { ...a, ...patch } : a) })} />}
  </>;
}
