"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, Download, FileText, FolderOpen, Redo2, Save, Undo2, Upload, X } from "lucide-react";
import { getFontAssets, getFonts, getServerFonts, prepareFonts, replaceFonts, subscribeFonts } from "@/lib/project-fonts";
import { initialDesigns, makeProject, maxProjectBytes, parseProject, type DesignerMode, type Designs, type Project } from "@/lib/project";
import { listSavedProjects, readSavedProject, writeSavedProject, type ProjectEntry } from "@/lib/project-storage";

export function downloadFile(contents: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Props = { designs: Designs; mode: DesignerMode; canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; onRestore: (project: Project) => void; onReady: () => void };
export function ProjectToolbar({ designs, mode, canUndo, canRedo, onUndo, onRedo, onRestore, onReady }: Props) {
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [name, setName] = useState("Untitled project"), [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Recovering your workspace…"), [error, setError] = useState("");
  const [saved, setSaved] = useState<ProjectEntry[]>([]), [busy, setBusy] = useState(false);
  const fonts = useSyncExternalStore(subscribeFonts, getFonts, getServerFonts);
  const input = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const callbacks = useRef({ onRestore, onReady });
  useEffect(() => { callbacks.current = { onRestore, onReady }; }, [onRestore, onReady]);
  useEffect(() => {
    let cancelled = false;
    async function recover() {
      try {
        const saved = await readSavedProject("autosave");
        if (saved) {
          const project = parseProject(JSON.stringify(saved.project));
          const prepared = await prepareFonts(project.fonts);
          if (cancelled) return;
          replaceFonts(project.fonts, prepared); callbacks.current.onRestore(project); setName(project.name);
          setStatus("Recovered autosave");
        } else if (!cancelled) setStatus("Autosave ready");
        if (!cancelled) setAutosaveEnabled(true);
      } catch (error) { if (!cancelled) { setError(message(error)); setStatus("Autosave unavailable"); } }
      finally { if (!cancelled) { setReady(true); callbacks.current.onReady(); } }
    }
    void recover();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!ready || !autosaveEnabled) return;
    let cancelled = false;
    const project = makeProject(name, mode, designs, getFontAssets());
    let saved = false;
    const timer = setTimeout(() => {
      setStatus("Saving…");
      void writeSavedProject("autosave", project).then(() => { if (!cancelled) { saved = true; setStatus("Autosaved in this browser"); } })
        .catch(error => { if (!cancelled) { setStatus("Not saved"); setError(message(error)); } });
    }, 700);
    const flush = () => { void writeSavedProject("autosave", project).catch(() => {}); };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!saved) event.preventDefault(); };
    // Flush on backgrounding; warn on immediate navigation before the debounce.
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", beforeUnload);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("pagehide", flush); window.removeEventListener("beforeunload", beforeUnload); };
  }, [ready, autosaveEnabled, designs, mode, name, fonts]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (menu.current && event.target && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function closeMenu() {
    if (!menu.current) return;
    menu.current.open = false;
    menu.current.querySelector("summary")?.focus();
  }
  const savedLocally = status === "Autosaved in this browser";
  function project() { return makeProject(name, mode, designs, getFontAssets()); }
  async function restore(next: Project) {
    const prepared = await prepareFonts(next.fonts);
    // Validate every asset before changing any live design or font.
    replaceFonts(next.fonts, prepared); onRestore(next); setName(next.name); setError(""); setAutosaveEnabled(true);
    dialog.current?.close();
    const fontIds = new Set(["helvetiker", "optimer", ...next.fonts.map(font => font.id)]);
    const missing = [...next.designs.case.cutouts, ...next.designs.panel.artwork].some(a => a.source.kind === "text" && !fontIds.has(a.source.fontId));
    setStatus("Project opened");
    if (missing) setError("Reimport missing fonts to edit existing text; outlines are preserved.");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <section className="project-toolbar" aria-label="Project tools">
    <div className="project-identity">
      <FileText size={14} className="project-file-icon" aria-hidden="true" />
      <label htmlFor="project-name" className="sr-only">Project name</label>
      <input id="project-name" className="project-title-input" aria-label="Project name" title="Rename project" maxLength={100} value={name} disabled={!ready} style={{ width: `${Math.min(32, Math.max(14, name.length + 1))}ch` }} onChange={event => setName(event.target.value)} />
      <span className="project-save-status" role="status" title={status}>{savedLocally && <Check size={12} aria-hidden="true" />}<span>{savedLocally ? "Saved locally" : status}</span></span>
    </div>
    <p className="project-slogan">Acrylic sheet projects for electronic musicians</p>
    <div className="project-actions">
      <div className="project-history" role="group" aria-label="Design history">
        <button className="icon-button" aria-label="Undo design change" title="Undo · Ctrl/Cmd Z" disabled={!canUndo || !ready} onClick={onUndo}><Undo2 size={15} /></button>
        <button className="icon-button" aria-label="Redo design change" title="Redo · Ctrl/Cmd Shift Z" disabled={!canRedo || !ready} onClick={onRedo}><Redo2 size={15} /></button>
      </div>
      <details ref={menu} className="project-menu" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); closeMenu(); } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
        <summary aria-label="Project actions" aria-disabled={busy || !ready} onClick={event => { if (busy || !ready) event.preventDefault(); }}>Project <ChevronDown size={13} aria-hidden="true" /></summary>
        <div className="project-menu-panel" onClick={event => { if ((event.target as Element).closest("button")) closeMenu(); }}>
          <button disabled={busy || !ready} onClick={() => void run(async () => { await writeSavedProject(crypto.randomUUID(), project()); setAutosaveEnabled(true); setStatus("Named copy saved in this browser"); })}><Save size={15} /><span>Save copy</span></button>
          <button disabled={busy || !ready} onClick={() => void run(async () => { setSaved(await listSavedProjects()); dialog.current?.showModal(); })}><FolderOpen size={15} /><span>Open</span></button>
          <div className="project-menu-separator" />
          <button disabled={busy || !ready} onClick={() => input.current?.click()}><Upload size={15} /><span>Import JSON</span></button>
          <button aria-label="Download project" title="Back up all six designs, imported models and fonts" disabled={busy || !ready} onClick={() => { downloadFile(JSON.stringify(project()), "application/json", `${(name.trim() || "acryl508-project").replace(/[^a-z0-9_-]/gi, "-")}.acryl508.json`); setStatus("Project file downloaded"); }}><Download size={15} /><span>Download project</span></button>
          <p>Saved on this device</p>
        </div>
      </details>
    </div>
    {error && <p className="project-error" role="alert">{error}</p>}
    <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Import project JSON" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void run(async () => { if (file.size > maxProjectBytes) throw new Error("Choose a project smaller than 80 MB."); await restore(parseProject(await file.text(), designs, getFontAssets())); }); }} />
    <dialog ref={dialog} className="info-dialog project-dialog" aria-labelledby="projects-title">
      <div className="dialog-top"><h2 id="projects-title">Saved projects</h2><button className="icon-button" aria-label="Close projects" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      <p>Saved on this browser and device. Download a project file for a portable backup.</p>
      {!saved.length && <p>No named copies yet. Use Save copy to keep a version of your workspace.</p>}
      <ul className="project-list">{saved.map(item => <li key={item.id}><div><strong>{item.name}</strong><small>{new Date(item.updated).toLocaleString()}</small></div><button className="cutout-button" disabled={busy} onClick={() => void run(async () => { const entry = await readSavedProject(item.id); if (!entry) throw new Error("This project is no longer available."); await restore(parseProject(JSON.stringify(entry.project))); })}>Open project</button></li>)}</ul>
      <button className="cutout-button" disabled={busy} onClick={() => void run(async () => { await writeSavedProject(crypto.randomUUID(), project()); await restore(makeProject("Untitled project", "case", initialDesigns, [])); })}>Save current & start new</button>
      {error && <p className="project-error" role="alert">{error}</p>}
    </dialog>
  </section>;
}
function message(error: unknown) { return error instanceof Error ? error.message : "The project could not be saved or opened. Download a project file to keep your work."; }
