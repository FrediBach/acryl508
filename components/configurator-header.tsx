import { ArrowUpRight, Moon, Sun } from "lucide-react";
type Props = { dark: boolean; onThemeChange: () => void; onInfo: (tab: "materials" | "guide") => void; onExport: () => void };
export function ConfiguratorHeader({ dark, onThemeChange, onInfo, onExport }: Props) {
  return <header className="app-header">
    <a href="#configure" className="brand" aria-label="Acryl508 home"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>acryl<span className="brand-number">508</span><span className="brand-period">.</span></span></a>
    <nav className="primary-nav" aria-label="Primary navigation">
      <a href="#configure" className="nav-link nav-link-active" aria-current="page">Configurator</a>
      <button className="nav-link" onClick={() => onInfo("materials")}>Material library</button>
      <button className="nav-link" onClick={() => onInfo("guide")}>Build notes <ArrowUpRight size={12} /></button>
    </nav>
    <div className="header-actions"><button className="icon-button theme-toggle" onClick={onThemeChange} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`Switch to ${dark ? "light" : "dark"} mode`}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button><span className="header-divider" /><button className="button button-dark header-export" onClick={onExport}>Export JSON <ArrowUpRight size={15} /></button></div>
  </header>;
}
