import { ArrowUpRight, Moon, Sun } from "lucide-react";
export type DesignerMode = "case" | "stand" | "protector" | "panel";
type Props = { mode: DesignerMode; onModeChange: (mode: DesignerMode) => void; dark: boolean; onThemeChange: () => void; onInfo: (tab: "materials" | "guide") => void };
export function ConfiguratorHeader({ mode, onModeChange, dark, onThemeChange, onInfo }: Props) {
  return <header className="app-header">
    <a href="#configure" className="brand" aria-label="Acryl508 home"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>acryl<span className="brand-number">508</span><span className="brand-period">.</span></span></a>
    <div className="designer-mode-switch" role="group" aria-label="Designer mode">
      <button aria-pressed={mode === "case"} className={mode === "case" ? "mode-active" : ""} onClick={() => onModeChange("case")}>Case designer</button>
      <button aria-pressed={mode === "stand"} className={mode === "stand" ? "mode-active" : ""} onClick={() => onModeChange("stand")}>Synth stand</button>
      <button aria-pressed={mode === "protector"} className={mode === "protector" ? "mode-active" : ""} onClick={() => onModeChange("protector")}>Synth protector</button>
      <button aria-pressed={mode === "panel"} className={mode === "panel" ? "mode-active" : ""} onClick={() => onModeChange("panel")}>Panel designer</button>
    </div>
    <nav className="primary-nav" aria-label="Primary navigation">
      <button className="nav-link" onClick={() => onInfo("materials")}>Material library</button>
      <button className="nav-link" onClick={() => onInfo("guide")}>Build notes <ArrowUpRight size={12} /></button>
    </nav>
    <div className="header-actions"><button className="icon-button theme-toggle" onClick={onThemeChange} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`Switch to ${dark ? "light" : "dark"} mode`}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button></div>
  </header>;
}
