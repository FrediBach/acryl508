"use client";
import { Component, useEffect, type ReactNode } from "react";

export type SpeakerModelStatus = "loading" | "ready" | "error";
export type ModelStatusChange = (status: SpeakerModelStatus) => void;

// Scene-side status reporters render no DOM. The page owns the message, avoiding
// a nested Html React root being created/destroyed during Suspense or StrictMode.
export function ModelStatusReporter({ status, onStatusChange, children }: { status: SpeakerModelStatus; onStatusChange: ModelStatusChange; children?: ReactNode }) {
  useEffect(() => { onStatusChange(status); }, [status, onStatusChange]);
  return children;
}

export class SpeakerModelBoundary extends Component<{ children: ReactNode; onStatusChange: ModelStatusChange }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onStatusChange("error"); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function SpeakerModelMessage({ status }: { status: SpeakerModelStatus | null }) {
  if (!status || status === "ready") return null;
  return <div className="preview-fallback" role="status" style={{ pointerEvents: "none" }}>
    {status === "error" ? "The detailed MYND models could not load. Reload to try again." : "Loading MYND hardware…"}
  </div>;
}
