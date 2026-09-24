"use client";
import { useId, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import type { StandObject } from "@/lib/stand-object";

export function StandObjectControls({ model, error, onChange }: { model?: StandObject; error?: string; onChange: (object?: StandObject) => void }) {
  const id = useId(), request = useRef(0);
  const [busy, setBusy] = useState(false), [uploadError, setUploadError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    const token = ++request.current;
    setBusy(true); setUploadError("");
    try {
      const { readStandObject } = await import("@/lib/stand-object-import");
      const object = await readStandObject(file);
      if (token === request.current) onChange(object);
    } catch (failure) {
      if (token === request.current) setUploadError(failure instanceof Error ? failure.message : "The model could not be read.");
    } finally { if (token === request.current) setBusy(false); }
  }
  return <div className="stand-object-controls">
    <label className="stand-object-upload" htmlFor={id}><Upload size={16} /><span>{busy ? "Reading model…" : model ? "Replace 3D model" : "Upload a 3D model"}<small>Optional · STL or OBJ · up to 15 MB / 30,000 triangles</small></span></label>
    <input id={id} className="stand-object-file" type="file" accept=".stl,.obj" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
    <p className="control-note">Use your synth or any object. Models stay in this browser session. Choose the source units, set which side is up, then adjust the playing angle.</p>
    {model && <><div className="stand-object-name"><strong>{model.name}</strong><button className="icon-button" aria-label="Remove 3D model" title="Use manual dimensions" onClick={() => { ++request.current; setBusy(false); setUploadError(""); onChange(); }}><X size={15} /></button></div>
      <div className="stand-object-settings">
        <label>Model units<select value={model.units} onChange={event => onChange({ ...model, units: event.target.value as StandObject["units"] })}><option value="mm">Millimetres</option><option value="cm">Centimetres</option><option value="m">Metres</option><option value="in">Inches</option></select></label>
        <label>Up axis<select value={model.up} onChange={event => onChange({ ...model, up: event.target.value as StandObject["up"] })}><option value="z">Z up</option><option value="y">Y up</option><option value="x">X up</option><option value="-z">−Z up</option><option value="-y">−Y up</option><option value="-x">−X up</option></select></label>
        <label>Face forward<select value={model.turn} onChange={event => onChange({ ...model, turn: Number(event.target.value) })}>{[0, 90, 180, 270].map(value => <option key={value} value={value}>{value}°</option>)}</select></label>
      </div>
      <p className="control-note">Dimensions come from the model. Contact edges follow its underside across the whole acrylic thickness; they stay sharp even when other edges are rounded. Model fit adds no front stops: check that the object is restrained from sliding.</p>
    </>}
    {busy && <p className="control-note" role="status">Reading model…</p>}
    {(uploadError || error) && <p className="stand-object-error" role="alert">{uploadError || error}</p>}
  </div>;
}
