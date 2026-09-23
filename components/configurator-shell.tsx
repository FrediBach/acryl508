"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Check, Layers3, X } from "lucide-react";
import { BuildSummary } from "@/components/build-summary";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { ConfiguratorHeader } from "@/components/configurator-header";
import { PreviewStage } from "@/components/preview-stage";
import { acrylicTints, configurationExport, defaultConfiguration, type CaseConfiguration } from "@/lib/configurator";

export function ConfiguratorShell() {
  const [config, setConfig] = useState(defaultConfiguration);
  const [dark, setDark] = useState(false);
  const [info, setInfo] = useState<"materials" | "guide" | null>(null);
  const [exported, setExported] = useState(false);
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
  function exportDesign() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(configurationExport(config), null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `acryl508-${config.rows * 3}u-${config.hp}hp.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
    if (exportTimer.current) clearTimeout(exportTimer.current);
    exportTimer.current = setTimeout(() => setExported(false), 4000);
  }
  function updateConfig(update: Partial<CaseConfiguration>) { setConfig(current => ({ ...current, ...update })); }
  return <div className="app-shell">
    <ConfiguratorHeader dark={dark} onThemeChange={toggleTheme} onInfo={openInfo} onExport={exportDesign} />
    <main id="configure" className="workspace">
      <div className="workspace-heading"><div><div className="eyebrow"><span className="orange-dot" />THE OPEN CASE SYSTEM <span>—</span> SERIES 01</div><h1>Less enclosure. <span>More possibility.</span></h1></div><div className="intro-aside"><p>A case for your way of making.</p><span>GS acrylic. Honest construction. Yours to shape.</span></div></div>
      <div className="configurator-grid"><div className="preview-column"><PreviewStage config={config} dark={dark} /><BuildSummary config={config} onExport={exportDesign} onGuide={() => openInfo("guide")} /></div><ConfigurationPanel config={config} onChange={updateConfig} /></div>
      <div className="principles-strip"><div><span>01</span><p>Nothing to hide.</p><small>Transparent by design.</small></div><div><span>02</span><p>Built to come apart.</p><small>Screws, not glue.</small></div><div><span>03</span><p>Every millimetre matters.</p><small>5.08 mm. One horizontal pitch.</small></div><button onClick={() => openInfo("guide")} aria-label="Explore our design principles"><ArrowUpRight size={21} /></button></div>
    </main>
    <footer className="app-footer"><span>acryl508 <span className="footer-dot">/</span> Independent by design.</span><span>DESIGN CONCEPT <i /> V.01</span><button onClick={() => openInfo("materials")}>Material matters <ArrowUpRight size={12} /></button></footer>
    <div className={`export-toast ${exported ? "toast-visible" : ""}`} role="status">{exported && <><Check size={15} />Configuration downloaded as JSON.</>}</div>
    <dialog ref={dialog} className="info-dialog" aria-labelledby="dialog-title" onClose={() => setInfo(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="dialog-top"><span className="eyebrow">ACRYL508 / FIELD NOTES</span><button className="icon-button" aria-label="Close notes" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      {info === "materials" ? <><Layers3 size={29} className="dialog-icon" /><h2 id="dialog-title">Material is the design.</h2><p>Cast acrylic, also known as GS. A single sheet thickness across every panel, with exposed edges and visible connections.</p><div className="material-library">{acrylicTints.map(tint => <button key={tint.id} onClick={() => { updateConfig({ tint }); dialog.current?.close(); }}><span style={{ background: tint.color }} /><strong>{tint.label}</strong><ArrowUpRight size={15} /></button>)}</div><p className="dialog-small">Colours are visual approximations. Select the actual sheet and check a physical sample before fabrication. Extruded (XT) acrylic is outside this design.</p></> : <><h2 id="dialog-title">Simple parts. Thoughtful details.</h2><p>Shape your system around the way you patch. This configurator explores a removable, mechanically assembled GS acrylic enclosure.</p><ol className="build-notes"><li><strong>One material, one thickness.</strong><span>Five enclosure panels, plus two side supports when legs are selected. The preview includes aluminium rails and black hardware.</span></li><li><strong>Space to breathe.</strong><span>Optional slots in the bottom panel. Internal depth is measured from the base to the module mounting plane, before power electronics.</span></li><li><strong>Power is a considered choice.</strong><span>Sinusoda and Trolley Bus are board-family preferences. The board preview is illustrative; exact dimensions, hole patterns and electrical clearances are not yet validated.</span></li><li><strong>A specification to build on.</strong><span>Export downloads your dimensions and material choices as JSON. Fabrication-ready drawings, validated screw joints and mounting templates are a next step.</span></li></ol><button className="button button-orange" onClick={exportDesign}><ArrowDownToLine size={15} />Export this configuration</button></>}
    </dialog>
  </div>;
}
