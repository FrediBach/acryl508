import { ArrowDown, ArrowUp, ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { useId, useState, type CSSProperties } from "react";
import { accessoryBendAngles, acrylicTints, busboards, footShapes, handleCount, handleSides, handleDimensions, handleSizeLimits, sledWebThickness, maxRackUnits, maxSideMarginRatio, minSideMarginRatio, panelSides, panelThickness, panelThicknessesFrom, caseThicknessLabel, jointThickness, panelTint, panelTintsFrom, panelTransparency, panelTransparenciesFrom, rackFormatLabel, rackRows, rackRowAngles, rackRowLayout, maxRowAngle, maxTotalRowAngle, ventStyles, sidePanelMargin, totalRackUnits, type CaseConfiguration, type PanelSide, type RackUnit } from "@/lib/configurator";

import { materialLabel, type AcrylicTransparency } from "@/lib/acrylic-material";
import { ColorChooser, TransparencyChooser, MaterialPreviewNote } from "@/components/material-controls";
import { ConfigSection } from "@/components/config-section";
import { CutoutControls } from "@/components/cutout-controls";
import { VentControls } from "@/components/vent-controls";
import { flatFeetLayout, flatFootStyles, flatFootHeightLimits } from "@/lib/flat-feet";
import { patchBoardLayout, patchBoardLimits, patchBoardSides } from "@/lib/patch-board";
import { cableHolderLayout, cableHolderLimits } from "@/lib/cable-holder";
import type { CasePanels } from "@/lib/case-panels";
import type { CutoutAction } from "@/lib/custom-cutouts";

type Props = { panels: CasePanels; onCutoutAction: (action: CutoutAction) => void; config: CaseConfiguration; onChange: (update: Partial<CaseConfiguration>) => void };
function RangeField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  function commitDraft() {
    const number = Number(draft);
    if (draft.trim() && Number.isFinite(number)) onChange(Math.min(max, Math.max(min, Math.round(number))));
    setEditing(false);
  }
  return <div className="range-field"><div className="field-heading"><label htmlFor={id}>{label}</label><div className="number-field"><input type="number" aria-label={`${label} in ${unit}`} min={min} max={max} step={1} value={editing ? draft : value} inputMode="numeric" onFocus={() => { setDraft(String(value)); setEditing(true); }} onBlur={commitDraft} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} onChange={event => { setDraft(event.target.value); const number = Number(event.target.value); if (event.target.value && Number.isInteger(number) && number >= min && number <= max) onChange(number); }} /><span>{unit}</span></div></div><input id={id} className="range-input" type="range" min={min} max={max} step={1} value={value} style={{ "--range-progress": `${(value - min) / Math.max(1, max - min) * 100}%` } as CSSProperties} onChange={event => onChange(event.currentTarget.valueAsNumber)} /><div className="range-labels"><span>{min} {unit}</span><span>{max} {unit}</span></div></div>;
}
function SideMarginField({ config, onChange }: { config: CaseConfiguration; onChange: (value: number) => void }) {
  const value = Math.min(maxSideMarginRatio, Math.max(minSideMarginRatio, config.sideMarginRatio ?? maxSideMarginRatio));
  const margin = sidePanelMargin(config);
  return <div className="range-field"><div className="field-heading"><label htmlFor="side-margin">Side panel edge margin</label><output className="margin-value" htmlFor="side-margin">{margin.toFixed(1)} mm</output></div><input id="side-margin" className="range-input" type="range" min={minSideMarginRatio} max={maxSideMarginRatio} step={0.1} value={value} aria-describedby="side-margin-note" aria-valuetext={`${margin.toFixed(1)} millimetres`} style={{ "--range-progress": `${(value - minSideMarginRatio) / (maxSideMarginRatio - minSideMarginRatio) * 100}%` } as CSSProperties} onChange={event => onChange(event.currentTarget.valueAsNumber)} /><div className="range-labels"><span>Near flush · {jointThickness(config)} mm</span><span>Original · {jointThickness(config) * 2} mm</span></div><p className="control-note" id="side-margin-note">Material retained beyond the end slots and below the base. The minimum keeps each slot centre 1.5× its width from the sheet edge; fabrication validation is still required.</p></div>;
}
export function ConfigurationPanel({ config, panels, onChange, onCutoutAction }: Props) {
  const rows = rackRows(config);
  const rowAngles = rackRowAngles(config);
  const rowLayout = rackRowLayout(config);
  const angledRows = rowLayout.some(row => row.angle > 0);
  const handleMode = config.handleMode === "single" ? "left" : config.handleMode ?? "auto";
  const handleSize = handleDimensions(config);
  const board = patchBoardLayout(config);
  const holder = cableHolderLayout(config);
  const bends = accessoryBendAngles(config);
  const feet = flatFeetLayout(config);
  const rackUnits = totalRackUnits(config);
  function updateRows(nextRows: RackUnit[], nextAngles = rowAngles) {
    const update = { rows: nextRows.length, rowUnits: nextRows, rowAngles: nextAngles };
    onChange({ ...update, rowAngles: rackRowAngles({ ...config, ...update }) });
  }
  function replaceRow(index: number, units: RackUnit) { updateRows(rows.map((row, rowIndex) => rowIndex === index ? units : row)); }
  function moveRow(index: number, direction: -1 | 1) {
    const next = [...rows], nextAngles = [...rowAngles], target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    [nextAngles[index], nextAngles[target]] = [nextAngles[target], nextAngles[index]];
    updateRows(next, nextAngles);
  }
  function selectTint(tint: typeof acrylicTints[number]) {
    onChange({ tint, ...(config.individualPanelTints ? { panelTints: panelTintsFrom(tint) } : {}) });
  }
  function selectTransparency(transparency: AcrylicTransparency) {
    onChange({ transparency, ...(config.individualPanelTints ? { panelTransparencies: panelTransparenciesFrom(transparency) } : {}) });
  }
  function toggleIndividualTints() {
    onChange(config.individualPanelTints
      ? { individualPanelTints: false }
      : { individualPanelTints: true, panelThicknesses: { ...panelThicknessesFrom(config.thickness), ...config.panelThicknesses }, panelTints: config.panelTints ?? panelTintsFrom(config.tint), panelTransparencies: config.panelTransparencies ?? panelTransparenciesFrom(config.transparency) });
  }
  function selectPanelTint(side: PanelSide, tintId: string) {
    const tint = acrylicTints.find(option => option.id === tintId) ?? config.tint;
    onChange({ panelTints: { ...panelTintsFrom(config.tint), ...config.panelTints, [side]: tint } });
  }
  const accessoriesSummary = [config.handle && `${handleCount(config)} ${handleCount(config) === 1 ? "handle" : "handles"}`, config.cableHolder && "Cable holder", config.patchBoard && "Patch cable board"].filter(Boolean).join(" · ") || "No accessories";
  const powerSummary = config.busboard !== "none" && !panels.powerBoard?.fits ? `${busboards[config.busboard]} · Does not fit` : `${busboards[config.busboard]}${panels.mountingConflicts > 0 ? " · Mount conflicts" : ""}`;
  return <aside className="control-panel accordion-control-panel case-control-panel" aria-label="Case controls">
    <div className="panel-heading"><h2>Your configuration</h2><span className="micro-label">01—07</span></div>
    <p className="config-intro">Open a section to fine-tune your case.</p>
    <ConfigSection number="01" title="Dimensions" summary={`${config.hp} HP · ${config.depth} mm deep`} defaultOpen>
      <RangeField label="Width" value={config.hp} min={20} max={168} unit="HP" onChange={hp => onChange({ hp })} />
      <div className="preset-row"><span>Quick set</span>{[42, 62, 84, 104, 126].map(hp => <button key={hp} onClick={() => onChange({ hp })} aria-pressed={config.hp === hp} className={config.hp === hp ? "preset-active" : ""}>{hp}</button>)}</div>
      <RangeField label="Internal depth" value={config.depth} min={50} max={180} unit="mm" onChange={depth => onChange({ depth })} />
    </ConfigSection>
    <ConfigSection number="02" title="Rows & stance" summary={`${rackFormatLabel(config)} · ${config.angle === 0 ? feet.enabled ? `Flat · ${flatFootStyles.find(style => style.value === feet.style)?.label} feet` : "Flat stance" : `${config.angle}° stance`}${angledRows ? " · Angled rows" : ""}`}>
      <div className="config-group">
      <div className="field-heading"><span>Rack rows</span><span className="field-note">{rackFormatLabel(config)} · {rackUnits}U total</span></div>
      <div className="rack-layout" aria-label="Rack row layout">
        <span className="rack-edge">REAR</span>
        {rows.map((units, index) => <div className="rack-row" key={index}>
          <span className="rack-row-number">{String(index + 1).padStart(2, "0")}</span>
          <div className="rack-size" role="group" aria-label={`Row ${index + 1} size`}>
            {([1, 3] as const).map(option => <button key={option} className={units === option ? "rack-size-active" : ""} aria-pressed={units === option} disabled={option > units && rackUnits - units + option > maxRackUnits} onClick={() => replaceRow(index, option)}>{option}U</button>)}
          </div>
          <button className="rack-icon" aria-label={`Move row ${index + 1} toward rear`} title="Move toward rear" disabled={index === 0} onClick={() => moveRow(index, -1)}><ArrowUp size={13} /></button>
          <button className="rack-icon" aria-label={`Move row ${index + 1} toward front`} title="Move toward front" disabled={index === rows.length - 1} onClick={() => moveRow(index, 1)}><ArrowDown size={13} /></button>
          <button className="rack-icon rack-remove" aria-label={`Remove row ${index + 1}`} title="Remove row" disabled={rows.length === 1} onClick={() => updateRows(rows.filter((_, rowIndex) => rowIndex !== index), rowAngles.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={13} /></button>
        </div>)}
        <span className="rack-edge">FRONT</span>
      </div>
      <div className="rack-add"><span>Add row</span>{([1, 3] as const).map(units => <button key={units} disabled={rackUnits + units > maxRackUnits} onClick={() => updateRows([...rows, units])}><Plus size={11} />{units}U</button>)}</div>
      </div>
      <div className="config-group">
        <h4 className="config-group-title">Stance</h4>
      <div className="segmented-control stance-control" role="group" aria-label="Stance angle">{[0, 10, 20, 30].map(angle => <button key={angle} className={`segment ${config.angle === angle ? "segment-active" : ""}`} aria-pressed={config.angle === angle} onClick={() => onChange({ angle, rowAngles: rackRowAngles({ ...config, angle }) })}>{angle === 0 ? "Flat" : `${angle}°`}</button>)}</div>
      {config.angle > 0 ? <>
      <fieldset className="foot-shape-field" aria-describedby="foot-shape-note">
        <legend>Side profile <span className="field-note">One continuous sheet</span></legend>
        <div className="segmented-control foot-shape-control">{footShapes.map(shape => <button key={shape.value} className={`segment ${config.footShape === shape.value ? "segment-active" : ""}`} aria-pressed={config.footShape === shape.value} title={shape.description} onClick={() => onChange({ footShape: shape.value })}>{shape.label}</button>)}</div>
      </fieldset>
      <p className="control-note" id="foot-shape-note">{footShapes.find(shape => shape.value === config.footShape)?.description}</p>
      {config.footShape === "sled" && <p className="control-note">{panelThickness(config, "left") === panelThickness(config, "right") ? `At least ${sledWebThickness(panelThickness(config, "left"))} mm of material around the opening.` : `Material around each opening: left ${sledWebThickness(panelThickness(config, "left"))} mm, right ${sledWebThickness(panelThickness(config, "right"))} mm.`} Short, shallow stances stay solid where the opening would leave too little material.</p>}
      <p className="control-note">The sides extend to the floor. Five panels, with no extra stance hardware.</p>
      </> : <>
      <div className="inline-field"><label htmlFor="flat-feet">Flat-case feet</label><button id="flat-feet" role="switch" aria-checked={Boolean(config.flatFeet)} aria-label="Flat-case feet" aria-describedby="flat-feet-note" className={`toggle ${config.flatFeet ? "toggle-on" : ""}`} onClick={() => onChange({ flatFeet: !config.flatFeet })}><span>{config.flatFeet ? <Plus size={10} /> : <Minus size={10} />}</span></button></div>
      <p className="control-note" id="flat-feet-note">{feet.enabled ? "Feet cut into the side sheets lift the case evenly without tilting it." : angledRows ? "Angled rows keep their automatic low arch supports. Enable flat-case feet to choose a style and height." : "Add integral feet beneath the side panels while keeping the case level."}</p>
      {feet.enabled && <>
        <div className="segmented-control foot-shape-control" role="group" aria-label="Flat feet style">{flatFootStyles.map(style => <button key={style.value} className={`segment ${feet.style === style.value ? "segment-active" : ""}`} aria-pressed={feet.style === style.value} title={style.description} onClick={() => onChange({ flatFootStyle: style.value })}>{style.label}</button>)}</div>
        <p className="control-note">{flatFootStyles.find(style => style.value === feet.style)?.description}</p>
        <RangeField label="Foot height" value={feet.height} min={flatFootHeightLimits.min} max={flatFootHeightLimits.max} unit="mm" onChange={flatFootHeight => onChange({ flatFootHeight })} />
        <p className="control-note">Height below the enclosure. All profiles use simple cuts in the existing sheets, with no extra parts or hardware.</p>
      </>}
      </>}
      </div>
      {rows.length > 1 && <details className="config-disclosure" aria-label="Additional row angles">
        <summary><span>Additional row angles</span><span>{angledRows ? "Custom tilt" : "All flat"}</span><ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="config-disclosure-body">
        <div className="field-heading"><span>Angle additional rows</span><span className="field-note">FRONT → REAR</span></div>
        <p className="control-note">Each row adds tilt to the row in front of it. The front row follows the stance above. Set all to 0° for a flat layout.</p>
        {rowLayout.slice(0, -1).reverse().map(row => {
          const available = maxTotalRowAngle - config.angle - rowAngles.reduce((sum, angle, index) => sum + (index === row.index ? 0 : angle), 0);
          return <div key={row.index}>
            <RangeField label={`Row ${row.index + 1} extra angle`} value={rowAngles[row.index]} min={0} max={Math.min(maxRowAngle, available)} unit="°" onChange={angle => onChange({ rowAngles: rowAngles.map((current, index) => index === row.index ? angle : current) })} />
            <p className="control-note">{row.units}U · {config.angle + row.angle}° from the table{row.gap > 0 ? ` · ${row.gap.toFixed(1)} mm extra spacing at this bend` : ""}</p>
          </div>;
        })}
        <p className="control-note">{angledRows ? "Rail spacing expands at each bend and support feet are included in the side panels." : "Angled rows automatically add rail clearance and support feet."} Total tilt is limited to {maxTotalRowAngle}°.</p>
        </div>
      </details>}
    </ConfigSection>
    <ConfigSection number="03" title="Material" summary={`${config.individualPanelTints ? "Individual materials" : materialLabel(config.tint, config.transparency)} · ${caseThicknessLabel(config)} mm acrylic`} id="materials">
      <div className="config-group">
      <ColorChooser tint={config.tint} onChange={selectTint} label={config.individualPanelTints ? "Apply color to all sheets" : "Acrylic color"} />
      <TransparencyChooser value={config.transparency} onChange={selectTransparency} label={config.individualPanelTints ? "All sheets’ transparency" : "Transparency"} />
      <MaterialPreviewNote />
      <div className="inline-field"><label htmlFor="individual-panel-tints">Individual sheet materials</label><button id="individual-panel-tints" role="switch" aria-checked={Boolean(config.individualPanelTints)} aria-label="Use individual acrylic materials for each sheet" aria-describedby="individual-panel-tints-note" className={`toggle ${config.individualPanelTints ? "toggle-on" : ""}`} onClick={toggleIndividualTints}><span>{config.individualPanelTints ? <Plus size={10} /> : <Minus size={10} />}</span></button></div>
      <p className="control-note" id="individual-panel-tints-note">{config.individualPanelTints ? "Choose a color, transparency and thickness for each sheet. Slots and tabs adapt to the adjoining sheets." : "All five sheets use the same color, transparency and thickness."}</p>
      {config.individualPanelTints && <div className="panel-tint-list" aria-label="Individual sheet materials">{panelSides.map(side => {
        const selected = panelTint(config, side.value);
        return <div className="panel-material" key={side.value}><label className="inline-field" htmlFor={`panel-tint-${side.value}`}><span><i style={{ background: selected.color }} />{side.label}</span><span className="select-wrap"><select id={`panel-tint-${side.value}`} aria-label={`${side.label} color`} value={selected.id} onChange={event => selectPanelTint(side.value, event.target.value)}>{acrylicTints.map(tint => <option key={tint.id} value={tint.id}>{tint.label}</option>)}</select><ChevronDown size={12} /></span></label><TransparencyChooser compact label={`${side.label} transparency`} value={panelTransparency(config, side.value)} onChange={transparency => onChange({ panelTransparencies: { ...config.panelTransparencies, [side.value]: transparency } })} /><div className="inline-field"><label htmlFor={`panel-thickness-${side.value}`}>{side.label} thickness</label><div className="select-wrap"><select id={`panel-thickness-${side.value}`} value={panelThickness(config, side.value)} onChange={event => onChange({ panelThicknesses: { ...config.panelThicknesses, [side.value]: Number(event.target.value) } })}>{[...new Set([3, 4, 5, 6, panelThickness(config, side.value)])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} mm</option>)}</select><ChevronDown size={12} /></div></div></div>;
      })}</div>}
      <div className="inline-field"><label htmlFor="thickness">{config.individualPanelTints ? "Apply thickness to all sheets" : "Sheet thickness"}</label><div className="select-wrap"><select id="thickness" value={config.individualPanelTints ? caseThicknessLabel(config) : config.thickness} onChange={event => onChange({ thickness: Number(event.target.value), ...(config.individualPanelTints ? { panelThicknesses: panelThicknessesFrom(Number(event.target.value)) } : {}) })}>{caseThicknessLabel(config).includes("–") && <option value={caseThicknessLabel(config)} disabled>Mixed</option>}{[...new Set([3, 4, 5, 6, config.thickness, panelThickness(config, "front")])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} mm</option>)}</select><ChevronDown size={12} /></div></div>
      </div>
      <div className="config-group">
      <SideMarginField config={config} onChange={sideMarginRatio => onChange({ sideMarginRatio })} />
      </div>
    </ConfigSection>
    <ConfigSection number="04" title="Accessories" summary={accessoriesSummary}>
      <div className="config-group">
      <div className="inline-field"><label htmlFor="handle">Integrated handles</label><button id="handle" role="switch" aria-checked={config.handle} aria-label="Integrated handles" aria-describedby="handle-note" className={`toggle ${config.handle ? "toggle-on" : ""}`} onClick={() => onChange({ handle: !config.handle })}><span>{config.handle ? <Plus size={10} /> : <Minus size={10} />}</span></button></div>
      {config.handle && <div className="segmented-control" role="group" aria-label="Handle layout">{([{ value: "auto", label: "Auto" }, { value: "left", label: "Left side" }, { value: "right", label: "Right side" }, { value: "pair", label: "Both sides" }] as const).map(option => <button key={option.value} className={`segment ${handleMode === option.value ? "segment-active" : ""}`} aria-pressed={handleMode === option.value} onClick={() => onChange({ handleMode: option.value })}>{option.label}</button>)}</div>}
      <p className="control-note handle-note" id="handle-note">{config.handle ? `${handleCount(config) === 2 ? "A grip in each side panel" : `One grip in the ${handleSides(config)[0]} side panel`}. ` : "Grips cut into extended side panels. "}Auto pairs the handles above 84 HP or from 6U.</p>
      {config.handle && <>
        <RangeField label="Handle width" value={handleSize.width} min={handleSizeLimits.width.min} max={handleSizeLimits.width.max} unit="mm" onChange={handleWidth => onChange({ handleWidth })} />
        <RangeField label="Handle height" value={handleSize.height} min={handleSizeLimits.height.min} max={handleSizeLimits.height.max} unit="mm" onChange={handleHeight => onChange({ handleHeight })} />
        <RangeField label="Handle bend angle" value={bends.handle} min={0} max={bends.handleMax} unit="°" onChange={handleBendAngle => onChange({ handleBendAngle })} />
        <p className="control-note">Bends outward. {bends.stacked ? `Added to the board bend; up to ${bends.handleMax}° here keeps the total within 90°. ` : ""}0° keeps the handle straight.</p>
        <p className="control-note">Outer width and height above the rim. Both handles share the same size, with rounded roots.</p>
      </>}
      </div>
      <div className="config-group">
      <div className="inline-field"><label htmlFor="patch-board">Patch cable board</label><button id="patch-board" role="switch" aria-checked={Boolean(config.patchBoard)} aria-label="Patch cable board" aria-describedby="patch-board-note" className={`toggle ${config.patchBoard ? "toggle-on" : ""}`} onClick={() => onChange({ patchBoard: !config.patchBoard })}><span>{config.patchBoard ? <Plus size={10} /> : <Minus size={10} />}</span></button></div>
      <p className="control-note" id="patch-board-note">Round holes in an extended side panel for parking 3.5 mm patch cable plugs.</p>
      {config.patchBoard && <>
        <div className="segmented-control" role="group" aria-label="Patch cable board placement">{([{ value: "left", label: "Left side" }, { value: "right", label: "Right side" }, { value: "both", label: "Both sides" }] as const).map(option => <button key={option.value} className={`segment ${(config.patchBoardSide ?? "left") === option.value ? "segment-active" : ""}`} aria-pressed={(config.patchBoardSide ?? "left") === option.value} onClick={() => onChange({ patchBoardSide: option.value })}>{option.label}</button>)}</div>
        <RangeField label="Board width" value={board.width} min={patchBoardLimits.width.min} max={patchBoardLimits.width.max} unit="mm" onChange={patchBoardWidth => onChange({ patchBoardWidth })} />
        <RangeField label="Board height" value={board.height} min={patchBoardLimits.height.min} max={patchBoardLimits.height.max} unit="mm" onChange={patchBoardHeight => onChange({ patchBoardHeight })} />
        <RangeField label="Board bend angle" value={bends.board} min={0} max={90} unit="°" onChange={patchBoardBendAngle => onChange({ patchBoardBendAngle })} />
        <p className="control-note">Bends outward from the case. A handle above this board follows its angle.</p>
        <RangeField label="Hole spacing" value={board.spacing} min={patchBoardLimits.spacing.min} max={patchBoardLimits.spacing.max} unit="mm" onChange={patchBoardSpacing => onChange({ patchBoardSpacing })} />
        <p className="control-note">{board.columns} × {board.rows} grid · {board.holeCount} holes per side · {board.holeCount * patchBoardSides(config).length} total. Ø{board.holeDiameter} mm holes, spaced centre to centre. Height above the rim; a handle on the same side sits above the grid. Check plug fit with a sample cut.</p>
      </>}
      </div>
      <div className="config-group">
      <div className="inline-field"><label htmlFor="cable-holder">Patch cable holder</label><button id="cable-holder" role="switch" aria-checked={Boolean(config.cableHolder)} aria-label="Patch cable holder" aria-describedby="cable-holder-note" className={`toggle ${config.cableHolder ? "toggle-on" : ""}`} onClick={() => onChange({ cableHolder: !config.cableHolder })}><span>{config.cableHolder ? <Plus size={10} /> : <Minus size={10} />}</span></button></div>
      <p className="control-note" id="cable-holder-note">{config.cableHolder ? `${holder.slitCount} evenly spaced slits between rounded fingers on the back plate. Slits stay open at the top for dropping cables in.` : "Extend the back plate with evenly spaced fingers to hold patch cables."}</p>
      {config.cableHolder && <>
        <RangeField label="Finger height" value={holder.height} min={cableHolderLimits.height.min} max={cableHolderLimits.height.max} unit="mm" onChange={cableHolderHeight => onChange({ cableHolderHeight })} />
        <RangeField label="Holder bend angle" value={bends.holder} min={0} max={90} unit="°" onChange={cableHolderBendAngle => onChange({ cableHolderBendAngle })} />
        <p className="control-note">Bends backward, away from the modules. 90° places the fingers horizontally.</p>
        <RangeField label="Slit width" value={holder.slitWidth} min={cableHolderLimits.slitWidth.min} max={cableHolderLimits.slitWidth.max} unit="mm" onChange={cableHolderSlitWidth => onChange({ cableHolderSlitWidth })} />
        <p className="control-note">Height above the rim. Choose a slit wider than the cable and narrower than its plug. Spacing adapts evenly to the case width.</p>
      </>}
      </div>
      {(config.handle || config.patchBoard || config.cableHolder) && <p className="control-note">Bends add one sheet thickness of clearance plus the curve length, with an inside radius of twice the sheet thickness. Bent handles use a shorter root while preserving the grip opening. Preview shows the formed sheet; SVG and stock sheets stay flat. Validate the bend allowance with a sample before cutting.</p>}
    </ConfigSection>
    <ConfigSection number="05" title="Ventilation" summary={config.vents ? `${ventStyles.find(style => style.value === config.ventStyle)?.label} · ${panels.ventilation.openings.length} openings` : "Off · Solid bottom panel"}>
      <VentControls config={config} panels={panels} onChange={onChange} />
    </ConfigSection>
    <ConfigSection number="06" title="Power & assembly" summary={powerSummary}>
      <div className="inline-field"><label htmlFor="busboard">Busboard</label><div className="select-wrap board-select"><select id="busboard" value={config.busboard} onChange={event => onChange({ busboard: event.target.value as CaseConfiguration["busboard"] })}>{Object.entries(busboards).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={12} /></div></div>
      {config.busboard === "sinusoda" && <>
        <p className="control-note board-note">Juice · 226 × 86 × 19 mm · 23 headers. Centred on the base. All 28 mounting holes are estimated from the data-sheet photo (Ø3.2 mm assumed); verify against your board before drilling. Use at least 14 evenly spaced screws with nylon washers.</p>
        <p className="control-note">Preview assumes 5 mm standoffs. {panels.powerBoard?.fits ? `${panels.powerBoard.moduleClearance.toFixed(1)} mm remains above the board for modules and cables.` : "Board does not fit: allow at least 226 × 86 mm inside the case (45 HP and at least 2U total). Preview and bottom mounting holes are omitted."}</p>
        {panels.mountingConflicts > 0 && <p className="control-note" role="alert">Bottom custom cutouts overlap or approach {panels.mountingConflicts} mounting points. Move these cuts to preserve the mounts.</p>}
      </>}
      {config.busboard === "trolley" && <>
        <p className="control-note board-note">Trolley Bus · 423 × 80 mm · 28 horizontal headers · 25 mm over the regulator cover, 15 mm elsewhere. Eight photo-estimated screw mounts (Ø3.2 mm assumed); verify before drilling. Befaco supplies adhesive mounts; this is a screw-mount adaptation.</p>
        <p className="control-note">The product page lists 423 mm; the setup drawing shows 435 mm including an apparent connector projection. Fit checks reserve 435 mm, with the PCB shifted 6 mm left. Preview assumes 5 mm standoffs.</p>
        <p className="control-note" role="status">{panels.powerBoard?.fits ? `${panels.powerBoard.moduleClearance.toFixed(1)} mm remains above the cover for modules and cables.` : "Board does not fit: allow 435 × 80 mm inside the case (86 HP and at least 2U total). Preview and bottom mounting holes are omitted."} The separate 4HP ON/OFF module and cable routing are not reserved.</p>
        {panels.mountingConflicts > 0 && <p className="control-note" role="alert">Bottom custom cutouts overlap or approach {panels.mountingConflicts} mounting points. Move these cuts to preserve the mounts.</p>}
      </>}
      {config.busboard === "compactpwr" && <>
        <p className="control-note board-note">CompactPWR · 174 × 79 × 20 mm · 20 headers. Centred on the base, with four photo-estimated corner mounts (Ø3.2 mm assumed). Verify the hole pattern and hardware before drilling.</p>
        <p className="control-note" role="status">Preview assumes 5 mm insulating standoffs. {panels.powerBoard?.fits ? `${panels.powerBoard.moduleClearance.toFixed(1)} mm remains above the board for modules and cables.` : "Board does not fit: allow at least 174 × 79 mm inside the case (35 HP and at least 2U total). Preview and bottom mounting holes are omitted."} The separate barrel/switch or USB-C inlet and its cables are not reserved.</p>
        {panels.mountingConflicts > 0 && <p className="control-note" role="alert">Bottom custom cutouts overlap or approach {panels.mountingConflicts} mounting points. Move these cuts to preserve the mounts.</p>}
      </>}
      <div className="hardware-note"><span className="hardware-dot" />Black hardware <span>Mechanical assembly · no glue</span></div>
      <p className="control-note">Case panels interlock in closed slots. Rail-end screws retain the sides; removing one side releases the panels.</p>
    </ConfigSection>
    <ConfigSection number="07" title="Custom cutouts" summary={config.cutouts.length ? `${config.cutouts.length} ${config.cutouts.length === 1 ? "cutout" : "cutouts"} added` : "No cutouts · Import SVG or add text"}>
      <CutoutControls config={config} panels={panels} onAction={onCutoutAction} />
    </ConfigSection>
  </aside>;
}
