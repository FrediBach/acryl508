"use client";

import { useState } from "react";
import { BuildSummary } from "@/components/build-summary";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { ConfiguratorHeader } from "@/components/configurator-header";
import { PreviewStage } from "@/components/preview-stage";
import { acrylicTints } from "@/lib/configurator";

export function ConfiguratorShell() {
  const [hp, setHp] = useState(104);
  const [rows, setRows] = useState(2);
  const [depth, setDepth] = useState(180);
  const [tint, setTint] = useState(acrylicTints[0]);
  const configuration = { hp, rows, depth, tint };

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-zinc-100">
      <ConfiguratorHeader />
      <main id="configure" className="configurator-grid">
        <ConfigurationPanel
          {...configuration}
          onHpChange={setHp}
          onRowsChange={setRows}
          onDepthChange={setDepth}
          onTintChange={setTint}
        />
        <PreviewStage {...configuration} />
        <BuildSummary {...configuration} />
      </main>
    </div>
  );
}
