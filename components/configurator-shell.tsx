"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Check, Layers3, X } from "lucide-react";
import { BuildSummary } from "@/components/build-summary";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { ConfiguratorHeader, type DesignerMode } from "@/components/configurator-header";
import { StandDesigner } from "@/components/stand-designer";
import { createSynthStand, defaultStandConfiguration, standBuildNotes, standExport, standSvg } from "@/lib/synth-stand";
import { PreviewStage } from "@/components/preview-stage";
import { acrylicTints, configurationExport, defaultConfiguration, panelTintsFrom, rackRows, type CaseConfiguration } from "@/lib/configurator";

import { createCasePanels } from "@/lib/case-panels";
import { maxCutouts, type CutoutAction } from "@/lib/custom-cutouts";
import { configurationSvg } from "@/lib/svg-export";

export function ConfiguratorShell() {
  const [config, setConfig] = useState(defaultConfiguration);
  const [mode, setMode] = useState<DesignerMode>("case");
  const [standConfig, setStandConfig] = useState(defaultStandConfiguration);
  const stand = useMemo(() => createSynthStand(standConfig), [standConfig]);
  const panels = useMemo(() => createCasePanels(config), [config]);
  const [dark, setDark] = useState(false);
  const [info, setInfo] = useState<"materials" | "guide" | null>(null);
  const [exported, setExported] = useState<"JSON" | "SVG" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem("acryl508-theme"); } catch { /* Storage may be unavailable. */ }
      const next = saved ? saved === "dark" : query.matches;
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
    };
    applyTheme();
    query.addEventListener("change", applyTheme);
    return () => { query.removeEventListener("change", applyTheme); if (exportTimer.current) clearTimeout(exportTimer.current); };
  }, []);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("acryl508-theme", next ? "dark" : "light"); } catch { /* Theme still works for this visit. */ }
  }
  function openInfo(tab: "materials" | "guide") { setInfo(tab); dialog.current?.showModal(); }
  function download(contents: string, type: string, name: string) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function showExported(format: "JSON" | "SVG") {
    setExported(format);
    if (exportTimer.current) clearTimeout(exportTimer.current);
    exportTimer.current = setTimeout(() => setExported(null), 4000);
  }
  function exportDesign() {
    if (mode === "stand") {
      download(JSON.stringify(standExport(stand), null, 2), "application/json", `acryl508-stand-${stand.config.width}mm-${stand.config.angle}deg.json`);
      showExported("JSON");
      return;
    }
    const resolvedPanels = Object.fromEntries(Object.entries(panels.faces).filter(([side]) => config.cutouts.some(cutout => cutout.side === side)).map(([side, face]) => [side, face.polygons]));
    download(JSON.stringify(configurationExport(config, panels.reports, resolvedPanels), null, 2), "application/json", `acryl508-${rackRows(config).map(units => `${units}u`).join("-")}-${config.hp}hp.json`);
    showExported("JSON");
  }
  function exportSheets() {
    if (mode === "stand") {
      download(standSvg(stand), "image/svg+xml", `acryl508-stand-${stand.config.width}mm-${stand.config.angle}deg-sheets.svg`);
      showExported("SVG");
      return;
    }
    download(configurationSvg(config, panels), "image/svg+xml", `acryl508-${rackRows(config).map(units => `${units}u`).join("-")}-${config.hp}hp-sheets.svg`);
    showExported("SVG");
  }
  function updateConfig(update: Partial<CaseConfiguration>) { setConfig(current => ({ ...current, ...update })); }
  function cutoutAction(action: CutoutAction) {
    setConfig(current => ({ ...current, cutouts: action.type === "add"
      ? current.cutouts.length < maxCutouts ? [...current.cutouts, action.cutout] : current.cutouts
      : action.type === "remove" ? current.cutouts.filter(cutout => cutout.id !== action.id)
      : current.cutouts.map(cutout => cutout.id === action.id ? { ...cutout, ...action.patch } : cutout) }));
  }
  return <div className="app-shell">
    <ConfiguratorHeader mode={mode} onModeChange={setMode} dark={dark} onThemeChange={toggleTheme} onInfo={openInfo} onExport={exportDesign} />
    <main id="configure" className="workspace">
      <h1 className="sr-only">{mode === "case" ? "Acrylic Eurorack case configurator" : "Slotted acrylic synth stand designer"}</h1>
      {mode === "stand" ? <StandDesigner stand={stand} dark={dark} onChange={patch => setStandConfig(current => ({ ...current, ...patch }))} onExportJson={exportDesign} onExportSvg={exportSheets} /> : <div className="configurator-grid"><div className="preview-column"><PreviewStage panels={panels} config={config} dark={dark} /><BuildSummary config={config} onExportJson={exportDesign} onExportSvg={exportSheets} /></div><ConfigurationPanel panels={panels} onCutoutAction={cutoutAction} config={config} onChange={updateConfig} /></div>}
    </main>
    <div className={`export-toast ${exported ? "toast-visible" : ""}`} role="status">{exported && <><Check size={15} />{exported === "SVG" ? "All sheets downloaded as SVG." : "Configuration downloaded as JSON."}</>}</div>
    <dialog ref={dialog} className="info-dialog" aria-labelledby="dialog-title" onClose={() => setInfo(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="dialog-top"><span className="eyebrow">ACRYL508 / FIELD NOTES</span><button className="icon-button" aria-label="Close notes" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      {info === "materials" ? <><Layers3 size={29} className="dialog-icon" /><h2 id="dialog-title">Material is the design.</h2><p>Cast acrylic, also known as GS. A single sheet thickness across every panel, with exposed edges and visible connections.</p><div className="material-library">{acrylicTints.map(tint => <button key={tint.id} onClick={() => { if (mode === "stand") setStandConfig(current => ({ ...current, tint })); else updateConfig({ tint, ...(config.individualPanelTints ? { panelTints: panelTintsFrom(tint) } : {}) }); dialog.current?.close(); }}><span style={{ background: tint.color }} /><strong>{tint.label}</strong><ArrowUpRight size={15} /></button>)}</div><p className="dialog-small">Colours are visual approximations. Select the actual sheets and check physical samples before fabrication. Extruded (XT) acrylic is outside this design.</p></> : mode === "stand" ? <><h2 id="dialog-title">Slot together. Play at your angle.</h2><p>A synth stand made entirely from flat, laser-cut acrylic. Solid support ribs and three cross braces form a slotted grid.</p><ol className="build-notes">{standBuildNotes.map((note, index) => <li key={note}><strong>{["Assemble the grid.", "One material throughout.", "Support across the width.", "Dial in the fit.", "Test the prototype."][index]}</strong><span>{note}</span></li>)}</ol><p className="dialog-small">Fabrication reference: <a href="https://www.acrylite.co/resources/fabrication-manuals/laser-machining-acrylite" target="_blank" rel="noreferrer">ACRYLITE laser machining guidance</a>. Laser settings and internal corners affect stress in the cut acrylic.</p><div className="dialog-actions"><button className="button button-dark" onClick={exportDesign}><ArrowDownToLine size={15} />Export JSON</button><button className="button button-orange" onClick={exportSheets}><ArrowDownToLine size={15} />SVG sheets</button></div></> : <><h2 id="dialog-title">Simple parts. Thoughtful details.</h2><p>Shape your system around the way you patch. This configurator explores a removable, mechanically assembled GS acrylic enclosure.</p><ol className="build-notes"><li><strong>One material, one thickness.</strong><span>Five enclosure panels. The side panels also form the stance and optional handles with rounded hand openings. All parts share one sheet thickness; use one tint throughout or choose a tint for each sheet. The preview includes aluminium rails and black hardware.</span></li><li><strong>Interlock, then secure.</strong><span>Slide the base and front/rear panel tabs into the closed slots of one side panel. Fit the rails, then the second side over the remaining tabs. The rail-end screws retain the sides with load-spreading washers. No glue or extra case-panel screws. To disassemble, support the case, remove the rail screws on one side, and withdraw that side panel.</span></li><li><strong>Find your footing.</strong><span>Choose a flat, 10°, 20° or 30° stance. Wedge, arch and sled profiles shape the side panels themselves, keeping their contact edges level on the table. Handles extend from one or both side panels; Auto uses a pair above 84 HP or from 6U. Adjust handle width and height; rounded roots blend the grips into the sides. Sled openings use thicker runners and rounded inner corners. Enable the patch cable holder to extend the rear plate with evenly spaced, rounded fingers. Adjust finger height and slit width to suit your cables. The case stays at five acrylic sheets. Grip strength and loaded stability need prototype validation.</span></li><li><strong>Space to breathe.</strong><span>Choose slits or holes, then layer waves, ripples or organic variation onto their sizes and positions. The pattern editor preserves borders and material between vents, and omits vents near custom cuts. Geometry limits still need prototype validation. The base sits above retaining material, and the side panels extend beyond the end-panel slots. Outer dimensions include these margins; your HP, row spacing and depth above the base stay unchanged.</span></li><li><strong>Power is a considered choice.</strong><span>Sinusoda Juice uses the data-sheet envelope of 226 × 86 × 19 mm and 23 headers. Its 28 mounting holes are estimated from the photograph; verify centres and diameters against your board before drilling. Use at least 14 evenly distributed screws with nylon washers. The preview assumes 5 mm standoffs; check module, cable and electrical clearances. Trolley Bus has 28 horizontal headers, a 423 × 80 mm board and a conservative 435 mm installation envelope from the setup drawing. Its eight photo-estimated screw mounts adapt Befaco’s adhesive mounting method; the two cover screws are excluded. Verify dimensions, fasteners and insulation against your board. CompactPWR uses the manufacturer’s 174 × 79 × 20 mm envelope, 20 headers and four photo-estimated corner mounts. Its separate barrel/switch or USB-C inlet and cabling are not reserved.</span></li><li><strong>Make it yours.</strong><span>Import a filled SVG or add text using a supplied or imported font. Choose an enclosure side, width, rotation and position for each cutout. The outside view shows the finished panel. After all cuts, only the largest piece attached to the original panel perimeter is kept; loose letter centres and other islands are removed, with a warning.</span></li><li><strong>A specification to build on.</strong><span>Export JSON for the complete specification, or download one full-size SVG containing every acrylic sheet as a named vector group. Dimensions describe the enclosure, excluding the integral grip, cable holder and stance extensions. Joint fit, laser kerf, corner relief, screw engagement and loaded retention need prototype testing before fabrication.</span></li></ol><div className="dialog-actions"><button className="button button-dark" onClick={exportDesign}><ArrowDownToLine size={15} />Export JSON</button><button className="button button-orange" onClick={exportSheets}><ArrowDownToLine size={15} />SVG sheets</button></div></>}
    </dialog>
  </div>;
}
