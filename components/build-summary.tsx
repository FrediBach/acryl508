import { Box, Check, Download, Layers3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { rowIds, type CaseConfiguration } from "@/lib/configurator";

export function BuildSummary({ hp, rows, depth, tint }: CaseConfiguration) {
  const acrylicArea = (hp / 104) * rows * (depth / 180);
  const estimate = Math.round(198 + acrylicArea * 82);

  return (
    <aside
      id="guide"
      className="summary-panel order-3"
      aria-label="Design summary"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Build summary</p>
          <h2 className="mt-1 text-lg font-semibold">
            A508 / {rows * 3}U–{hp}
          </h2>
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
          <Box className="size-4 text-[#ff6a52]" />
        </div>
      </div>

      <div className="summary-visual">
        <div
          className="mini-case"
          style={{ aspectRatio: `${Math.max(1.2, hp / (rows * 35))}` }}
        >
          {rowIds.slice(0, rows).map((rowId) => (
            <span key={rowId} />
          ))}
        </div>
      </div>

      <dl className="spec-list">
        <div>
          <dt>Format</dt>
          <dd>
            {rows * 3}U / {hp} HP
          </dd>
        </div>
        <div>
          <dt>Material</dt>
          <dd>3 mm {tint.label}</dd>
        </div>
        <div>
          <dt>Outer width</dt>
          <dd>{Math.round(hp * 5.08 + 26)} mm</dd>
        </div>
        <div>
          <dt>Rail depth</dt>
          <dd>{depth} mm</dd>
        </div>
        <div>
          <dt>Usable power</dt>
          <dd>{rows * 20} headers</dd>
        </div>
      </dl>

      <Separator className="bg-white/[0.07]" />

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Layers3 className="size-4 text-zinc-500" />
          <span>{rows * 4 + 2} cut parts</span>
          <Check className="ml-auto size-3.5 text-emerald-400" />
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Sparkles className="size-4 text-zinc-500" />
          <span>Ready for nesting</span>
          <Check className="ml-auto size-3.5 text-emerald-400" />
        </div>
      </div>

      <div className="mt-auto rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-zinc-500">Material estimate</span>
          <span className="font-mono text-lg">€{estimate}</span>
        </div>
        <p className="mt-2 text-[0.68rem] leading-4 text-zinc-600">
          Indicative only. Hardware, rails, power, tax, and shipping are
          calculated at export.
        </p>
        <Button className="mt-4 h-10 w-full bg-zinc-100 text-zinc-950 hover:bg-white">
          <Download />
          Prepare fabrication files
        </Button>
      </div>
    </aside>
  );
}
