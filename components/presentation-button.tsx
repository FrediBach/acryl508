"use client";
import { Pause, Play } from "lucide-react";

export function PresentationButton({ active, onClick, disabled = false }: { active: boolean; onClick: () => void; disabled?: boolean }) {
  const label = active ? "Pause presentation mode" : "Start presentation mode";
  return <button type="button" className={`icon-button ${active ? "tool-active" : ""}`} aria-label={label} aria-pressed={active} title={label} disabled={disabled} onClick={onClick}>{active ? <Pause size={17} /> : <Play size={17} />}</button>;
}
