"use client";
import { useState } from "react";
import { caseRowPanelConfiguration } from "@/lib/case-row-panels";
import { rackRows, type CaseConfiguration } from "@/lib/configurator";
import { caseCanExport, type CasePanels } from "@/lib/case-panels";
import type { CutoutAction } from "@/lib/custom-cutouts";
import { PanelDesigner } from "./panel-designer";
import { PreviewStage } from "./preview-stage";
import { BuildSummary } from "./build-summary";
import { ConfigurationPanel } from "./configuration-panel";

type Props = { config: CaseConfiguration; previewConfig: CaseConfiguration; panels: CasePanels; dark: boolean;
  onChange: (patch: Partial<CaseConfiguration>) => void; onCutoutAction: (action: CutoutAction) => void;
  onExportJson: () => void; onExportSvg: () => void; onOpenFabrication: () => void };

export function CaseDesigner({ config, previewConfig, panels, dark, onChange, onCutoutAction, ...exports }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const attached = panels.rowPanels.find(row => row.index === editing);
  if (attached && config.rowPanels?.[attached.index]) {
    const panelConfig = caseRowPanelConfiguration(config, attached.index);
    return <PanelDesigner key={attached.id} config={panelConfig} panel={attached.panel} dark={dark}
      attachment={{ label: attached.label, canExport: caseCanExport(panels), onClose: () => setEditing(null) }} {...exports}
      onChange={patch => onChange({ rowPanels: rackRows(config).map((_, index) => index === attached.index
        ? { ...panelConfig, ...patch } : config.rowPanels?.[index] ?? null) })} />;
  }
  return <div className="configurator-grid"><div className="preview-column">
    <PreviewStage panels={panels} config={previewConfig} dark={dark} />
    <BuildSummary canExportSvg={caseCanExport(panels)} config={config} {...exports} />
  </div><ConfigurationPanel panels={panels} onCutoutAction={onCutoutAction} config={config} onChange={onChange} onEditRowPanel={setEditing} /></div>;
}
