import { Rotate3D } from "lucide-react";
import { CasePreview } from "@/components/case-preview";
import { Badge } from "@/components/ui/badge";
import type { CaseConfiguration } from "@/lib/configurator";

export function PreviewStage({ hp, rows, depth, tint }: CaseConfiguration) {
  return (
    <section
      className="preview-stage order-1 lg:order-2"
      aria-label="Interactive 3D case preview"
    >
      <div className="stage-grid" aria-hidden="true" />
      <div className="stage-glow" aria-hidden="true" />
      <div className="stage-topline">
        <div className="flex items-center gap-2">
          <span className="status-dot" />
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-zinc-500">
            Live model
          </span>
        </div>
        <Badge
          variant="outline"
          className="border-white/10 bg-black/20 font-mono text-zinc-400"
        >
          {hp}HP · {rows * 3}U · {depth}mm
        </Badge>
      </div>
      <div className="canvas-wrap">
        <CasePreview hp={hp} rows={rows} depth={depth} tint={tint.color} />
      </div>
      <div className="stage-hint">
        <Rotate3D className="size-3.5" />
        Drag to rotate · scroll to zoom
      </div>
      <div className="dimension width-dimension">
        <span>{hp} HP</span>
      </div>
      <div className="dimension depth-dimension">
        <span>{depth} mm</span>
      </div>
    </section>
  );
}
