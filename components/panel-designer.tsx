"use client";
import { LedStripControls } from "./led-strip-controls";
import { FabricationButton } from "./fabrication-button";
import { memo, lazy, Suspense, useId, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { ArrowDownToLine, Check, Copy, Maximize, Minimize, Plus, Trash2 } from "lucide-react";
import { ConfigSection } from "@/components/config-section";
import { NumberControl } from "@/components/cutout-controls";
import { ColorChooser, MaterialPreviewNote, TransparencyChooser } from "@/components/material-controls";
import { PanelArtworkControls } from "@/components/panel-artwork-controls";
import { materialLabel } from "@/lib/acrylic-material";
import { outlinePath, placedCutout, polygonBounds } from "@/lib/custom-cutouts";
import { alignPanelItems, componentOutline, maxPanelArtwork, maxPanelComponents, newPanelComponent, panelFormats, panelRound, type DesignedPanel, type PanelAlignment, type PanelArtwork, type PanelComponent, type PanelConfiguration, type PanelFormat } from "@/lib/panel-designer";
import { ventPresets } from "@/lib/vent-design";
const PanelPreview = memo(lazy(() => import("@/components/panel-preview").then(module => ({ default: module.PanelPreview }))));
type Props = { config?: PanelConfiguration; panel: DesignedPanel; dark: boolean; onChange: (patch: Partial<PanelConfiguration>) => void; onExportJson: () => void; onExportSvg: () => void; onOpenFabrication: () => void };
type Item = PanelComponent | PanelArtwork;
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  const id = useId();
  return <div className="inline-field"><label htmlFor={id}>{label}</label><button id={id} role="switch" className={`toggle ${value ? "toggle-on" : ""}`} aria-label={label} aria-checked={value} onClick={onChange}><span /></button></div>;
}

function FrontEditor({ panel, config, selection, onSelect, onChange, snap, grid, guides, cutting }: { panel: DesignedPanel; config: PanelConfiguration; selection: string[]; onSelect: (ids: string[]) => void; onChange: Props["onChange"]; snap: boolean; grid: number; guides: boolean; cutting: boolean }) {
  const { width, height } = panel, patternId = useId().replace(/:/g, "");
  const cutPath = useMemo(() => outlinePath(panel.polygons), [panel.polygons]);
  const items: Item[] = [...config.components, ...config.artwork];
  const drag = useRef<{ pointer: number; start: { x: number; y: number }; items: { id: string; x: number; y: number }[]; anchor: { x: number; y: number } } | null>(null);
  const quantize = (value: number) => panelRound(snap ? Math.round(value / grid) * grid : value);
  function point(event: PointerEvent<SVGSVGElement | SVGGElement>) {
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); return { x: p.x, y: -p.y };
  }
  function moveItems(originals: { id: string; x: number; y: number }[], dx: number, dy: number) {
    const move = <T extends Item>(item: T): T => { const start = originals.find(i => i.id === item.id); return start ? { ...item, x: panelRound(Math.max(-500, Math.min(500, start.x + dx))), y: panelRound(Math.max(-500, Math.min(500, start.y + dy))) } : item; };
    onChange({ components: config.components.map(move), artwork: config.artwork.map(move) });
  }
  function handleItemPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (cutting) return;
    const id = (event.target as Element).closest("[data-item]")?.getAttribute("data-item");
    const item = items.find(item => item.id === id);
    if (!item) { onSelect([]); return; }
    event.stopPropagation();
    const ids = event.shiftKey ? selection.includes(item.id) ? selection.filter(id => id !== item.id) : [...selection, item.id] : selection.includes(item.id) ? selection : [item.id];
    onSelect(ids);
    const p = point(event), svg = event.currentTarget;
    if (p && svg && ids.includes(item.id)) { svg.focus(); svg.setPointerCapture(event.pointerId); drag.current = { pointer: event.pointerId, start: p, anchor: { x: item.x, y: item.y }, items: items.filter(i => ids.includes(i.id)).map(i => ({ id: i.id, x: i.x, y: i.y })) }; }
  }
  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const direction = directions[event.key];
    if (cutting || !direction || !selection.length) return;
    event.preventDefault(); const step = (snap ? grid : 0.1) * (event.shiftKey ? 10 : 1);
    moveItems(items.filter(i => selection.includes(i.id)), direction[0] * step, direction[1] * step);
  }
  const opacity = config.transparency === "opaque" ? 1 : config.transparency === "opal" ? 0.8 : config.transparency === "see-through" ? 0.55 : 0.35;
  return <div className="panel-editor-wrap"><svg className="panel-front-editor" viewBox={`${-width / 2 - 14} ${-height / 2 - 14} ${width + 28} ${height + 28}`} tabIndex={0} role="img" aria-label={cutting ? "Panel cutting layout with cut and engraving layers" : "Panel front editor. Select items and use arrow keys to move. Shift-click selects multiple items."}
    onKeyDown={keyboard} onPointerDown={handleItemPointerDown}
    onPointerMove={event => { const state = drag.current; if (!state || state.pointer !== event.pointerId) return; const p = point(event); if (p) moveItems(state.items, quantize(state.anchor.x + p.x - state.start.x) - state.anchor.x, quantize(state.anchor.y + p.y - state.start.y) - state.anchor.y); }}
    onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
    <defs><pattern id={patternId} width={grid} height={grid} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="0.16" fill="currentColor" opacity="0.25" /></pattern></defs>
    {!cutting && <path d={outlinePath(panel.original)} fill="var(--background)" stroke="var(--strong-border)" strokeWidth="0.2" />}
    {!cutting && guides && <g pointerEvents="none"><rect x={-width / 2} y={-height / 2} width={width} height={height} fill={`url(#${patternId})`} /><rect x={-width / 2} y={-height / 2} width={width} height="8" fill="currentColor" opacity="0.06" /><rect x={-width / 2} y={height / 2 - 8} width={width} height="8" fill="currentColor" opacity="0.06" /></g>}
    <path data-layer="cut" d={cutPath} fill={cutting ? "none" : config.tint.color} fillOpacity={cutting ? 1 : opacity} fillRule="evenodd" stroke={cutting ? "#ef4444" : "currentColor"} strokeWidth={cutting ? 0.2 : 0.15} pointerEvents="none" />
    {panel.engravings.map(a => <path key={a.id} data-layer="engrave" d={outlinePath(a.polygons)} fill={cutting ? "#2563eb" : config.tint.id === "black" ? "#eee8d7" : "#353b47"} fillRule="evenodd" pointerEvents="none" />)}
    {!cutting && guides && <g className="panel-guides" pointerEvents="none"><path d={`M${-width / 2},0H${width / 2}M0,${-height / 2}V${height / 2}`} /><path d={`M${-width / 2},${-height / 2 + 8}H${width / 2}M${-width / 2},${height / 2 - 8}H${width / 2}`} />{panel.components.map(c => <path key={c.id} d={outlinePath(c.body)} />)}</g>}
    {!cutting && items.map(item => { const polygons = "kind" in item ? componentOutline(item) : placedCutout(item), b = polygonBounds(polygons), selected = selection.includes(item.id);
      return <g key={item.id} className="panel-draggable" data-item={item.id}><title>{`${item.name} · ${item.x}, ${item.y} mm`}</title><rect x={b.left - 0.8} y={-b.top - 0.8} width={b.width + 1.6} height={b.height + 1.6} fill="transparent" stroke={selected ? "var(--signal)" : "none"} strokeWidth="0.35" strokeDasharray="1 0.8" /><path d={outlinePath(polygons)} fill="transparent" stroke={selected ? "var(--signal)" : "var(--muted-foreground)"} strokeWidth="0.2" fillRule="evenodd" /></g>;
    })}
    <g className="panel-dimensions" pointerEvents="none"><text x="0" y={height / 2 + 8} textAnchor="middle">{width.toFixed(2)} mm · {config.hp} HP</text><text transform={`translate(${-width / 2 - 7},0) rotate(-90)`} textAnchor="middle">{height} mm</text></g>
  </svg></div>;
}

export function PanelDesigner({ config: liveConfig, panel, dark, onChange, onExportJson, onExportSvg, onOpenFabrication }: Props) {
  const config = liveConfig ?? panel.config;
  const [view, setView] = useState<"front" | "perspective" | "cutting">("front");
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [expanded, setExpanded] = useState(false);
  const [snap, setSnap] = useState(true), [grid, setGrid] = useState(1), [guides, setGuides] = useState(true);
  const items: Item[] = [...config.components, ...config.artwork];
  const selection = selectedIds.filter(id => items.some(item => item.id === id));
  const selected = items.find(item => item.id === selection[0]);
  const selectedComponent = selected && "kind" in selected ? selected : undefined;
  const selectedArtwork = selected && "operation" in selected ? selected : undefined;
  function updateItem(patch: Partial<PanelComponent & PanelArtwork>) {
    if (!selected) return;
    onChange(selectedComponent ? { components: config.components.map(c => c.id === selected.id ? { ...c, ...patch } : c) } : { artwork: config.artwork.map(a => a.id === selected.id ? { ...a, ...patch } : a) });
  }
  function select(id: string) { setSelectedIds([id]); setView("front"); }
  function addComponent(kind: PanelComponent["kind"]) {
    const component = newPanelComponent(kind, crypto.randomUUID());
    onChange({ components: [...config.components, component] }); select(component.id);
  }
  function remove(item: Item) { onChange("kind" in item ? { components: config.components.filter(c => c.id !== item.id) } : { artwork: config.artwork.filter(a => a.id !== item.id) }); }
  function duplicate(item: Item) {
    const copy = { ...item, id: crypto.randomUUID(), name: `${item.name} copy`, x: item.x + 2, y: item.y - 2 };
    onChange("kind" in copy ? { components: [...config.components, copy] } : { artwork: [...config.artwork, copy] }); select(copy.id);
  }
  function align(action: PanelAlignment) { const next = alignPanelItems(config, selection, action); onChange({ components: next.components, artwork: next.artwork }); }
  const vents = (patch: Partial<PanelConfiguration["vents"]>) => onChange({ vents: { ...config.vents, ...patch } });
  return <div className="configurator-grid panel-designer"><div className="preview-column">
    <section className={`preview-stage ${expanded ? "preview-expanded" : ""}`} aria-label="Panel designer preview" onKeyDown={event => { if (event.key === "Escape") setExpanded(false); }}>
      <div className="stage-topline"><div className="model-label"><span className="status-dot" /><span>PANEL DESIGNER</span><span className="model-label-separator">/</span><span>{config.hp} HP · {panelFormats[config.format].label.toUpperCase()}</span></div><span className="stage-material">GS—{config.thickness} <span>•</span> {config.tint.label.toUpperCase()}</span></div>
      <div className="stage-watermark" aria-hidden="true">F-508</div>
      <div className="canvas-wrap">{view === "perspective" ? <Suspense fallback={<div className="preview-fallback" role="status">Preparing your panel…</div>}><PanelPreview panel={panel} dark={dark} /></Suspense> : <FrontEditor panel={panel} config={config} selection={selection} onSelect={setSelectedIds} onChange={onChange} snap={snap} grid={grid} guides={guides} cutting={view === "cutting"} />}</div>
      <div className="stage-side-tools"><button className="icon-button" aria-label={expanded ? "Exit expanded panel preview" : "Expand panel preview"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize size={16} /> : <Maximize size={16} />}</button></div>
      <div className="stage-bottom"><div className="view-control" role="group" aria-label="Panel view">{(["front", "perspective", "cutting"] as const).map(option => <button key={option} className={view === option ? "view-active" : ""} aria-pressed={view === option} onClick={() => setView(option)}>{option === "front" ? "Front editor" : option === "perspective" ? "Perspective" : "Cutting layout"}</button>)}</div><span className="stage-hint">{view === "front" ? "Drag to place · Shift-click to select" : view === "cutting" ? "Red: cut · Blue: engrave" : "Drag to orbit · Scroll to zoom"}</span></div>
      <div className="stage-caption"><span><Check size={12} />{view === "front" ? "+X right · +Y up · Origin at centre" : "Shared preview & export geometry"}</span><span>PROTOTYPE · MM</span></div>
    </section>
    <section className="summary-panel" aria-label="Panel specification"><div className="summary-title"><span className="micro-label">PANEL SPECIFICATION</span><h2>F508 <span>/</span> {config.hp} HP</h2></div><dl className="spec-list"><div><dt>Dimensions</dt><dd>{panel.width.toFixed(2)} × {panel.height} <small>mm</small></dd></div><div><dt>Openings</dt><dd>{config.components.length} components · {panel.vents.length} vents</dd></div><div><dt>Material</dt><dd>{config.thickness} mm GS <span className="spec-color" style={{ background: config.tint.color }} /></dd></div><div><dt>Mounting</dt><dd>{panel.mounts.length} {config.mounting}</dd></div></dl><div className="summary-actions"><FabricationButton onClick={onOpenFabrication} /><button className="button button-dark summary-export" onClick={onExportJson} title="Download only this design’s settings and geometry" aria-label="Export panel design JSON"><ArrowDownToLine size={15} />Design JSON</button><button className="button button-orange summary-export" disabled={!panel.canExport} onClick={onExportSvg} aria-label="Export panel cut and engrave SVG"><ArrowDownToLine size={15} />SVG layers</button></div></section>
  </div><aside className="control-panel accordion-control-panel" aria-label="Panel designer controls">
    <div className="panel-heading"><h2>Your panel</h2><span className="micro-label">01—07</span></div><p className="config-intro">A blank panel, a custom faceplate, or a little of both.</p>
    <ConfigSection number="01" title="Panel size & mounting" summary={`${panelFormats[config.format].label} · ${config.hp} HP`} defaultOpen>
      <label className="cutout-field">Panel format<select value={config.format} onChange={event => onChange({ format: event.target.value as PanelFormat })}>{Object.entries(panelFormats).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      <div className="cutout-numbers"><NumberControl label="Panel width (HP)" value={config.hp} min={config.format === "pulp-logic-1u" ? 6 : 2} max={84} onChange={hp => onChange({ hp })} /><NumberControl label="Width clearance (mm)" value={config.widthClearance} min={0.1} max={0.5} onChange={widthClearance => onChange({ widthClearance })} /></div>
      <div className="preset-row"><span>Quick set</span>{(config.format === "pulp-logic-1u" ? [6, 12, 18, 24] : [4, 8, 12, 20]).map(hp => <button key={hp} aria-pressed={config.hp === hp} className={config.hp === hp ? "preset-active" : ""} onClick={() => onChange({ hp })}>{hp} HP</button>)}</div>
      <p className="control-note">Actual width = HP × 5.08 − clearance. {config.format === "pulp-logic-1u" ? "Pulp Logic width rounds to multiples of 6 HP. Its 43.18 mm height differs from Intellijel’s 39.65 mm." : "The two 1U formats are not interchangeable."}</p>
      <label className="cutout-field">Mounting openings<select value={config.mounting} onChange={event => onChange({ mounting: event.target.value as PanelConfiguration["mounting"] })}><option value="holes">Round holes</option><option value="slots">Horizontal slots</option></select></label>
      <label className="cutout-field">Mounting count<select value={config.mountingCount} onChange={event => onChange({ mountingCount: event.target.value as PanelConfiguration["mountingCount"] })}><option value="auto">Automatic</option><option value="two">Two · left column</option><option value="four">Four · both columns</option></select></label>
      {config.mounting === "slots" && <NumberControl label="Slot travel (mm)" value={config.slotTravel} min={0} max={4} onChange={slotTravel => onChange({ slotTravel })} />}
      <p className="control-note">{panel.mounts[0].diameter} mm openings · {panelRound(panel.height - 2 * panelFormats[config.format].insetY)} mm vertical centres. <a href={panelFormats[config.format].source} target="_blank" rel="noreferrer">Manufacturer dimensions ↗</a></p>
    </ConfigSection>
    <ConfigSection number="02" title="Components & layout" summary={`${config.components.length} openings · ${selection.length} selected`} defaultOpen>
      <div className="panel-component-presets">{(["jack", "pot", "switch", "display", "custom"] as const).map(kind => <button key={kind} className="cutout-button" disabled={config.components.length >= maxPanelComponents} onClick={() => addComponent(kind)}><Plus size={12} />{kind === "custom" ? "Custom" : kind[0].toUpperCase() + kind.slice(1)}</button>)}</div>
      <p className="control-note">Starting sizes are examples. Enter your component’s actual cutout and body dimensions. Up to {maxPanelComponents} openings.</p>
      <Toggle label="Snap to grid" value={snap} onChange={() => setSnap(!snap)} /><label className="cutout-field">Grid spacing<select value={grid} onChange={event => setGrid(Number(event.target.value))}>{[0.5, 1, 2.54, 5.08].map(size => <option key={size} value={size}>{size} mm</option>)}</select></label><Toggle label="Show grid & body guides" value={guides} onChange={() => setGuides(!guides)} />
      <div className="cutout-list" aria-label="Panel items">{items.map(item => <div className="cutout-list-row" key={item.id}><input type="checkbox" aria-label={`Select ${item.name}`} checked={selection.includes(item.id)} onChange={event => setSelectedIds(event.target.checked ? [...selection, item.id] : selection.filter(id => id !== item.id))} /><button className={`cutout-choice ${selection.includes(item.id) ? "cutout-selected" : ""}`} onClick={() => select(item.id)} aria-pressed={selection.includes(item.id)}><span>{item.name}</span><small>{"operation" in item ? item.operation : item.shape}</small></button><button className="icon-button" aria-label={`Duplicate ${item.name}`} disabled={"kind" in item ? config.components.length >= maxPanelComponents : config.artwork.length >= maxPanelArtwork} onClick={() => duplicate(item)}><Copy size={12} /></button><button className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => remove(item)}><Trash2 size={12} /></button></div>)}</div>
      {items.length > 0 && <div className="cutout-actions"><button className="cutout-button" onClick={() => setSelectedIds(items.map(item => item.id))}>Select all</button><button className="cutout-button" onClick={() => setSelectedIds([])}>Clear selection</button></div>}
      {selected && <div className="cutout-editor" key={selected.id}><label className="cutout-field">Item name<input value={selected.name} maxLength={60} onChange={event => updateItem({ name: event.target.value })} /></label>
        {selection.length > 1 && <p className="control-note">Fields edit {selected.name}. Alignment and dragging move the selected group.</p>}
        {selectedComponent && <><label className="cutout-field">Opening shape<select value={selectedComponent.shape} onChange={event => updateItem({ shape: event.target.value as PanelComponent["shape"] })}><option value="circle">Round hole</option><option value="rectangle">Rounded rectangle</option><option value="slot">Rounded slot</option></select></label><div className="cutout-numbers"><NumberControl label={selectedComponent.shape === "circle" ? "Hole diameter (mm)" : "Opening width (mm)"} value={selectedComponent.width} min={1} max={150} onChange={width => updateItem({ width })} />{selectedComponent.shape !== "circle" && <NumberControl label="Opening height (mm)" value={selectedComponent.height} min={1} max={150} onChange={height => updateItem({ height })} />}{selectedComponent.shape === "rectangle" && <NumberControl label="Corner radius (mm)" value={selectedComponent.radius} min={0} max={30} onChange={radius => updateItem({ radius })} />}</div></>}
        {selectedArtwork && <><label className="cutout-field">Artwork operation<select value={selectedArtwork.operation} onChange={event => updateItem({ operation: event.target.value as PanelArtwork["operation"] })}><option value="engrave">Engrave surface</option><option value="cut">Cut through</option></select></label><NumberControl label="Artwork width (mm)" value={selectedArtwork.width} min={0.5} max={500} onChange={width => updateItem({ width })} /></>}
        <div className="cutout-numbers panel-item-position"><NumberControl label="X from centre (mm)" value={selected.x} min={-500} max={500} onChange={x => updateItem({ x })} /><NumberControl label="Y from centre (mm)" value={selected.y} min={-500} max={500} onChange={y => updateItem({ y })} /><NumberControl label="Item rotation (°)" value={selected.rotation} min={-180} max={180} onChange={rotation => updateItem({ rotation })} /></div>
        {selectedComponent && <><div className="cutout-numbers panel-item-position"><NumberControl label="Body clearance width (mm)" value={selectedComponent.bodyWidth} min={1} max={200} onChange={bodyWidth => updateItem({ bodyWidth })} /><NumberControl label="Body clearance height (mm)" value={selectedComponent.bodyHeight} min={1} max={200} onChange={bodyHeight => updateItem({ bodyHeight })} /><NumberControl label="Max panel thickness (mm)" value={selectedComponent.maxPanelThickness} min={0} max={10} onChange={maxPanelThickness => updateItem({ maxPanelThickness })} /></div><p className="control-note">Body boxes include knobs, nuts and underside parts. Maximum panel thickness: 0 = unspecified; otherwise use the component’s limit after allowing for washers and thread engagement.</p></>}
      </div>}
      <div className="panel-alignment" role="group" aria-label="Align selected items">{([ ["column", "Align X"], ["row", "Align Y"], ["distribute-x", "Space X"], ["distribute-y", "Space Y"], ["center-x", "Centre X"], ["center-y", "Centre Y"] ] as [PanelAlignment, string][]).map(([action, label]) => <button className="cutout-button" key={action} disabled={selection.length < (action.startsWith("distribute") ? 3 : action.startsWith("center") ? 1 : 2)} onClick={() => align(action)}>{label}</button>)}</div>
      <p className="control-note">Shift-click or use checkboxes to select several items. Align uses the first item in the list; Space distributes centres evenly. Arrow keys nudge in the front editor; Shift moves ten steps. Shaded edge bands reserve 8 mm for rails.</p>
    </ConfigSection>
    <ConfigSection number="03" title="Artwork & labels" summary={`${config.artwork.length} artworks · Cut or engrave`} defaultOpen><PanelArtworkControls panel={panel} selected={selectedArtwork} onChange={onChange} onSelect={select} /><LedStripControls label="Bottom LED lighting" strip={config.ledStrip} onChange={ledStrip => onChange({ ledStrip })} error={panel.led?.error} /><p className="control-note">Edge-facing LEDs in a narrow through-slot illuminate the frosted artwork. Clear and translucent acrylic carry the glow best. Match the slot to your strip’s profile and allow space for wiring and retention.</p><p className="control-note">Engraving preserves letter centres. Cut-through artwork removes loose islands; use stencil lettering to retain them.</p></ConfigSection>
    <ConfigSection number="04" title="Ventilation pattern" summary={config.vents.enabled ? `${panel.vents.length} openings · ${config.vents.shape}` : "Off"}>
      <Toggle label="Panel ventilation" value={config.vents.enabled} onChange={() => vents({ enabled: !config.vents.enabled })} />
      {config.vents.enabled && <><label className="cutout-field">Vent shape<select value={config.vents.shape} onChange={event => vents({ shape: event.target.value as PanelConfiguration["vents"]["shape"] })}><option value="circles">Round holes</option><option value="slots">Short slits</option><option value="hexagons">Hexagons</option></select></label><Toggle label="Stagger vent rows" value={config.vents.staggered} onChange={() => vents({ staggered: !config.vents.staggered })} /><div className="cutout-numbers"><NumberControl label="Vent size (mm)" value={config.vents.size} min={1} max={15} onChange={size => vents({ size })} /><NumberControl label="Vent pitch (mm)" value={config.vents.pitch} min={4} max={30} onChange={pitch => vents({ pitch })} /><NumberControl label="Vent border (mm)" value={config.vents.margin} min={4} max={25} onChange={margin => vents({ margin })} /></div><div className="panel-pattern-presets" role="group" aria-label="Panel ventilation effects">{ventPresets.map(preset => <button className="cutout-button" key={preset.id} aria-pressed={JSON.stringify(config.vents.design) === JSON.stringify(preset.design)} onClick={() => vents({ design: preset.design })}>{preset.label}</button>)}</div><p className="control-note">Resolved pitch {panel.ventPitch} mm · border {panel.ventMargin} mm. Openings avoid mounting holes, body boxes and artwork, with at least {Math.max(2, config.thickness)} mm between vents. Pitch also limits the pattern to 600 openings. Patterns share the case designer’s effect engine.</p></>}
    </ConfigSection>
    <ConfigSection number="05" title="Panel material" summary={`${materialLabel(config.tint, config.transparency)} · ${config.thickness} mm`}><ColorChooser tint={config.tint} label="Panel acrylic color" onChange={tint => onChange({ tint })} /><TransparencyChooser value={config.transparency} onChange={transparency => onChange({ transparency })} /><NumberControl label="Panel thickness (mm)" value={config.thickness} min={1.5} max={6} onChange={thickness => onChange({ thickness })} /><MaterialPreviewNote /><p className="control-note">Thin acrylic can flex during patching; thicker sheets need enough thread on jacks and pots. Test the actual hardware and use load-spreading washers.</p></ConfigSection>
    <ConfigSection number="06" title="Fit & geometry checks" summary={panel.warnings.length ? `${panel.warnings.length} items to review` : "No geometry conflicts detected"} defaultOpen={false}><div aria-live="polite">{panel.warnings.length ? panel.warnings.map(warning => <p className="cutout-warning" key={warning}>{warning}</p>) : <p className="control-note">No conflicts detected by the geometry checks. Component envelopes and the rail reserve are approximate; verify against the real hardware.</p>}</div><p className="control-note">These checks do not calculate strength, flex or electrical shielding. Engraving is clipped to retained acrylic. Cutouts can change the outside edge and remove mounting material.</p></ConfigSection>
    <ConfigSection number="07" title="Fabrication notes" summary="Full-size SVG · Cut + engrave · JSON"><p className="control-note">Red outlines cut through; blue filled outlines engrave the surface. Assign both groups in your laser software. Curves are sampled; check the vectors and apply kerf compensation once in CAM.</p><p className="control-note">JSON includes settings, source artwork and resolved geometry. Download from the panel summary below the preview. Make a fit sample before cutting the finished panel.</p>{!panel.canExport && <p className="cutout-warning" role="alert">SVG export is unavailable until the geometry errors are resolved.</p>}</ConfigSection>
  </aside></div>;
}
