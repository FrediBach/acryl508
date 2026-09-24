"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { Check, Layers3, X } from "lucide-react";
import { BuildSummary } from "@/components/build-summary";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { ConfiguratorHeader, type DesignerMode } from "@/components/configurator-header";
import { useSynthProtector } from "@/components/use-synth-protector";
import { ProtectorDesigner } from "@/components/protector-designer";
import { protectorBuildNotes, protectorExport, protectorSvg } from "@/lib/synth-protector";
import { PanelDesigner } from "@/components/panel-designer";
import { createPanel, normalizePanelConfiguration, panelBuildNotes, panelExport, panelSvg } from "@/lib/panel-designer";
import { useSynthStand } from "@/components/use-synth-stand";
import { StandDesigner } from "@/components/stand-designer";
import { standBuildNotes, standExport, standSvg } from "@/lib/synth-stand";
import { PreviewStage } from "@/components/preview-stage";
import { configurationExport, panelTintsFrom, panelTransparenciesFrom, rackRows, type CaseConfiguration } from "@/lib/configurator";

import { ColorChooser, TransparencyChooser, MaterialPreviewNote } from "@/components/material-controls";
import { caseCanExport, createCasePanels } from "@/lib/case-panels";
import { maxCutouts, type CutoutAction } from "@/lib/custom-cutouts";
import { configurationSvg } from "@/lib/svg-export";
import { useDesignHistory } from "./use-design-history";
import { useGeometryInput } from "./use-geometry-input";
import { ProjectToolbar } from "./project-toolbar";
import { FabricationWorkspace } from "./fabrication-workspace";
import { caseFabrication, panelFabrication, protectorFabrication, standFabrication } from "@/lib/fabrication";
import { initialDesigns, type Designs } from "@/lib/project";

export function ConfiguratorShell() {
  const [mode, setMode] = useState<DesignerMode>("case");
  const onHistoryTravel = useCallback((next: Designs, current: Designs) => {
    const changed = (Object.keys(next) as DesignerMode[]).find(key => next[key] !== current[key]);
    if (changed) setMode(changed);
  }, []);
  const { history, dispatch, travel } = useDesignHistory(initialDesigns, onHistoryTravel);
  const [ready, setReady] = useState(false);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const { case: config, stand: standConfig, panel: panelConfig, protector: protectorConfig } = history.present;
  function setDesign<K extends keyof Designs>(key: K, value: SetStateAction<Designs[K]>) {
    dispatch({ type: "set", value: current => {
      const next = typeof value === "function" ? (value as (config: Designs[K]) => Designs[K])(current[key]) : value;
      if (Object.keys(next).every(field => Object.is(next[field as keyof Designs[K]], current[key][field as keyof Designs[K]]))) return current;
      return { ...current, [key]: next };
    } });
  }
  const setConfig = (value: SetStateAction<Designs["case"]>) => setDesign("case", value);
  const setStandConfig = (value: SetStateAction<Designs["stand"]>) => setDesign("stand", value);
  const setPanelConfig = (value: SetStateAction<Designs["panel"]>) => setDesign("panel", value);
  const setProtectorConfig = (value: SetStateAction<Designs["protector"]>) => setDesign("protector", value);
  const panelInput = useGeometryInput(panelConfig), caseInput = useGeometryInput(config);
  const panelGeometry = useMemo(() => createPanel(panelInput), [panelInput]);
  const panel = useMemo(() => ({ ...panelGeometry, config: { ...panelGeometry.config, tint: panelConfig.tint, transparency: panelConfig.transparency } }), [panelGeometry, panelConfig.tint, panelConfig.transparency]);
  const { protector, protectorError, protectorBusy } = useSynthProtector(protectorConfig);
  const { stand, standError, standBusy } = useSynthStand(standConfig);
  const panels = useMemo(() => createCasePanels(caseInput), [caseInput]);
  const canExportCase = caseCanExport(panels);
  const fabrication = useMemo(() => mode === "case" ? caseFabrication(config, panels) : mode === "panel" ? panelFabrication(panel) : mode === "stand" ? standFabrication(stand, standError, standBusy) : protectorFabrication(protector, protectorError, protectorBusy), [mode, config, panels, panel, stand, standError, standBusy, protector, protectorError, protectorBusy]);
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
    if (mode === "panel") {
      download(JSON.stringify(panelExport(panel), null, 2), "application/json", `acryl508-panel-${panel.config.format}-${panel.config.hp}hp.json`);
      showExported("JSON");
      return;
    }
    if (mode === "protector") {
      if (protectorError || protectorBusy) return;
      download(JSON.stringify(protectorExport(protector), null, 2), "application/json", `acryl508-protector-${protector.config.width}mm-${protector.config.headroom}mm.json`);
      showExported("JSON");
      return;
    }
    if (mode === "stand") {
      if (standError || standBusy) return;
      download(JSON.stringify(standExport(stand), null, 2), "application/json", `acryl508-stand-${stand.config.width}mm-${stand.config.angle}deg.json`);
      showExported("JSON");
      return;
    }
    const resolvedPanels = Object.fromEntries(Object.entries(panels.faces).filter(([side]) => config.cutouts.some(cutout => cutout.side === side)).map(([side, face]) => [side, face.polygons]));
    download(JSON.stringify(configurationExport(config, panels.reports, resolvedPanels), null, 2), "application/json", `acryl508-${rackRows(config).map(units => `${units}u`).join("-")}-${config.hp}hp.json`);
    showExported("JSON");
  }
  function exportSheets() {
    if (mode === "panel") {
      if (!panel.canExport) return;
      download(panelSvg(panel), "image/svg+xml", `acryl508-panel-${panel.config.format}-${panel.config.hp}hp.svg`);
      showExported("SVG");
      return;
    }
    if (mode === "protector") {
      if (protectorError || protectorBusy) return;
      download(protectorSvg(protector), "image/svg+xml", `acryl508-protector-${protector.config.width}mm-${protector.config.headroom}mm-sheets.svg`);
      showExported("SVG");
      return;
    }
    if (mode === "stand") {
      if (standError || standBusy) return;
      download(standSvg(stand), "image/svg+xml", `acryl508-stand-${stand.config.width}mm-${stand.config.angle}deg-sheets.svg`);
      showExported("SVG");
      return;
    }
    if (!canExportCase) return;
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
  return <div className="app-shell" onPointerDownCapture={event => {
    if ((event.target as Element).closest('.workspace input[type="range"], .workspace .panel-front-editor, .workspace .cutout-layout')) dispatch({ type: "begin" });
  }} onFocusCapture={event => {
    if ((event.target as Element).closest('.workspace input[type="number"], .workspace input[type="text"]')) dispatch({ type: "begin" });
  }} onBlurCapture={() => dispatch({ type: "end" })}>
    <ConfiguratorHeader mode={mode} onModeChange={setMode} dark={dark} onThemeChange={toggleTheme} onInfo={openInfo} />
    <ProjectToolbar designs={history.present} mode={mode} canUndo={history.past.length > 0 || (history.group !== undefined && history.group !== history.present)} canRedo={history.future.length > 0} onUndo={() => travel("undo")} onRedo={() => travel("redo")} onRestore={project => { dispatch({ type: "reset", value: project.designs }); setMode(project.mode); setWorkspaceRevision(value => value + 1); }} onReady={() => setReady(true)} />
    <main key={workspaceRevision} id="configure" className="workspace" inert={!ready}>
      <h1 className="sr-only">{mode === "panel" ? "Acrylic Eurorack panel designer" : mode === "case" ? "Acrylic Eurorack case configurator" : mode === "protector" ? "Slotted acrylic synth protector designer" : "Slotted acrylic synth stand designer"}</h1>
      {mode === "panel" ? <PanelDesigner panel={panel} dark={dark} onChange={patch => setPanelConfig(current => Object.keys(patch).every(key => key === "tint" || key === "transparency") ? { ...current, ...patch } : normalizePanelConfiguration({ ...current, ...patch }))} onExportJson={exportDesign} onExportSvg={exportSheets} /> : mode === "protector" ? <ProtectorDesigner protector={protector} object={protectorConfig.object} objectError={protectorError} busy={protectorBusy} dark={dark} onChange={patch => setProtectorConfig(current => ({ ...current, ...patch }))} onExportJson={exportDesign} onExportSvg={exportSheets} /> : mode === "stand" ? <StandDesigner stand={stand} object={standConfig.object} objectError={standError} busy={standBusy} dark={dark} onChange={patch => setStandConfig(current => ({ ...current, ...patch }))} onExportJson={exportDesign} onExportSvg={exportSheets} /> : <div className="configurator-grid"><div className="preview-column"><PreviewStage panels={panels} config={config} dark={dark} /><BuildSummary canExportSvg={canExportCase} config={config} onExportJson={exportDesign} onExportSvg={exportSheets} /></div><ConfigurationPanel panels={panels} onCutoutAction={cutoutAction} config={config} onChange={updateConfig} /></div>}
      <FabricationWorkspace fabrication={fabrication} />
    </main>
    <div className={`export-toast ${exported ? "toast-visible" : ""}`} role="status">{exported && <><Check size={15} />{exported === "SVG" ? mode === "panel" ? "Panel cut and engrave layers downloaded as SVG." : "All sheets downloaded as SVG." : "Configuration downloaded as JSON."}</>}</div>
    <dialog ref={dialog} className="info-dialog" aria-labelledby="dialog-title" onClose={() => setInfo(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="dialog-top"><span className="eyebrow">ACRYL508 / FIELD NOTES</span><button className="icon-button" aria-label="Close notes" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      {info === "materials" ? <><Layers3 size={29} className="dialog-icon" /><h2 id="dialog-title">Material is the design.</h2><p>Cast acrylic, also known as GS. A single sheet thickness across every panel, with exposed edges and visible connections.</p><div className="material-library"><ColorChooser tint={mode === "panel" ? panelConfig.tint : mode === "protector" ? protectorConfig.tint : mode === "stand" ? standConfig.tint : config.tint} onChange={tint => { if (mode === "panel") setPanelConfig(current => ({ ...current, tint })); else if (mode === "protector") setProtectorConfig(current => ({ ...current, tint })); else if (mode === "stand") setStandConfig(current => ({ ...current, tint })); else updateConfig({ tint, ...(config.individualPanelTints ? { panelTints: panelTintsFrom(tint) } : {}) }); }} label={mode === "panel" ? "Panel acrylic color" : mode === "protector" ? "Protector acrylic color" : mode === "stand" ? "Stand acrylic color" : "Apply color to all sheets"} /><TransparencyChooser value={mode === "panel" ? panelConfig.transparency : mode === "protector" ? protectorConfig.transparency : mode === "stand" ? standConfig.transparency : config.transparency} onChange={transparency => { if (mode === "panel") setPanelConfig(current => ({ ...current, transparency })); else if (mode === "protector") setProtectorConfig(current => ({ ...current, transparency })); else if (mode === "stand") setStandConfig(current => ({ ...current, transparency })); else updateConfig({ transparency, ...(config.individualPanelTints ? { panelTransparencies: panelTransparenciesFrom(transparency) } : {}) }); }} /><MaterialPreviewNote /></div><p className="dialog-small">Colours are visual approximations. Select the actual sheets and check physical samples before fabrication. Extruded (XT) acrylic is outside this design.</p></> : mode === "panel" ? <><h2 id="dialog-title">A face for your next idea.</h2><p>Blank panels, DIY openings and engraved artwork in one flat acrylic sheet.</p><ol className="build-notes">{panelBuildNotes.map((note, index) => <li key={note}><strong>{["Choose the format.", "Fit your components.", "Cut or engrave.", "Arrange the layout.", "Export the operations."][index]}</strong><span>{note}</span></li>)}</ol></> : mode === "protector" ? <><h2 id="dialog-title">A little room above the controls.</h2><p>One oversized top sheet. Adjustable edge supports and optional through-tabs with removable retaining strips.</p><ol className="build-notes">{protectorBuildNotes.map((note, index) => <li key={note}><strong>{["Locate the feet.", "Set the clearance.", "Retain the feet.", "Slot together.", "Test the prototype."][index]}</strong><span>{note}</span></li>)}</ol></> : mode === "stand" ? <><h2 id="dialog-title">Slot together. Play at your angle.</h2><p>A synth stand made entirely from flat, laser-cut acrylic. Solid support ribs and three cross braces form a slotted grid.</p><ol className="build-notes">{standBuildNotes.map((note, index) => <li key={note}><strong>{["Assemble the grid.", "One material throughout.", "Support across the width.", "Dial in the fit.", "Test the prototype."][index]}</strong><span>{note}</span></li>)}</ol><p className="dialog-small">Fabrication reference: <a href="https://www.acrylite.co/resources/fabrication-manuals/laser-machining-acrylite" target="_blank" rel="noreferrer">ACRYLITE laser machining guidance</a>. Laser settings and internal corners affect stress in the cut acrylic.</p></> : <><h2 id="dialog-title">Simple parts. Thoughtful details.</h2><p>Shape your system around the way you patch. This configurator explores a removable, mechanically assembled GS acrylic enclosure.</p><ol className="build-notes"><li><strong>One material, one thickness.</strong><span>Five enclosure panels. The side panels also form the stance and optional handles with rounded hand openings. All parts share one sheet thickness; use one tint throughout or choose a tint for each sheet. The preview includes aluminium rails and black hardware.</span></li><li><strong>Interlock, then secure.</strong><span>Slide the base and front/rear panel tabs into the closed slots of one side panel. Fit the rails, then the second side over the remaining tabs. The rail-end screws retain the sides with load-spreading washers. No glue or extra case-panel screws. To disassemble, support the case, remove the rail screws on one side, and withdraw that side panel.</span></li><li><strong>Find your footing.</strong><span>Choose a flat, 10°, 20° or 30° stance. Each additional row can add its own tilt toward the rear, up to 75° total from the table. Angled rows expand rail spacing at each bend, reshape the side and rear panels, and automatically include integral support feet. Wedge, arch and sled profiles shape the side panels themselves, keeping their contact edges level on the table. Handles extend from one or both side panels; Auto uses a pair above 84 HP or from 6U. Adjust handle width and height; rounded roots blend the grips into the sides. Sled openings use thicker runners and rounded inner corners. Enable the patch cable holder to extend the rear plate with evenly spaced, rounded fingers. Adjust finger height and slit width to suit your cables. The case stays at five acrylic sheets. Grip strength and loaded stability need prototype validation.</span></li><li><strong>Space to breathe.</strong><span>Choose slits or holes, then layer waves, ripples or organic variation onto their sizes and positions. The pattern editor preserves borders and material between vents, and omits vents near custom cuts. Geometry limits still need prototype validation. The base sits above retaining material, and the side panels extend beyond the end-panel slots. Outer dimensions include these margins; your HP, row spacing and depth above the base stay unchanged.</span></li><li><strong>Power is a considered choice.</strong><span>Sinusoda Juice uses the data-sheet envelope of 226 × 86 × 19 mm and 23 headers. Its 28 mounting holes are estimated from the photograph; verify centres and diameters against your board before drilling. Use at least 14 evenly distributed screws with nylon washers. The preview assumes 5 mm standoffs; check module, cable and electrical clearances. Trolley Bus has 28 horizontal headers, a 423 × 80 mm board and a conservative 435 mm installation envelope from the setup drawing. Its eight photo-estimated screw mounts adapt Befaco’s adhesive mounting method; the two cover screws are excluded. Verify dimensions, fasteners and insulation against your board. CompactPWR uses the manufacturer’s 174 × 79 × 20 mm envelope, 20 headers and four photo-estimated corner mounts. Its separate barrel/switch or USB-C inlet and cabling are not reserved.</span></li><li><strong>Make it yours.</strong><span>Import a filled SVG or add text using a supplied or imported font. Choose an enclosure side, width, rotation and position for each cutout. The outside view shows the finished panel. After all cuts, only the largest piece attached to the original panel perimeter is kept; loose letter centres and other islands are removed, with a warning.</span></li><li><strong>A specification to build on.</strong><span>Export JSON for the complete specification, or download one full-size SVG containing every acrylic sheet as a named vector group. Dimensions describe the enclosure, excluding the integral grip, cable holder and stance extensions. Joint fit, laser kerf, corner relief, screw engagement and loaded retention need prototype testing before fabrication.</span></li></ol></>}
    </dialog>
  </div>;
}
