import { CircleHelp, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  acrylicTints,
  rowOptions,
  type AcrylicTint,
} from "@/lib/configurator";

type ConfigurationPanelProps = {
  depth: number;
  hp: number;
  rows: number;
  tint: AcrylicTint;
  onDepthChange: (value: number) => void;
  onHpChange: (value: number) => void;
  onRowsChange: (value: number) => void;
  onTintChange: (value: AcrylicTint) => void;
};

function FieldLabel({
  children,
  value,
}: {
  children: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {children}
      </span>
      <span className="font-mono text-sm text-zinc-200">{value}</span>
    </div>
  );
}

function sliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function ConfigurationPanel({
  depth,
  hp,
  rows,
  tint,
  onDepthChange,
  onHpChange,
  onRowsChange,
  onTintChange,
}: ConfigurationPanelProps) {
  return (
    <aside
      className="control-panel order-2 lg:order-1"
      aria-label="Case controls"
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Badge className="bg-[#ff5b42]/10 text-[#ff755f]">
            Concept 01
          </Badge>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="About case geometry"
                />
              }
            >
              <CircleHelp />
            </TooltipTrigger>
            <TooltipContent>
              Dimensions update the 3D case instantly.
            </TooltipContent>
          </Tooltip>
        </div>
        <h1 className="text-[2rem] font-semibold leading-[1.05] tracking-[-0.045em]">
          Shape your
          <br />
          signal space.
        </h1>
        <p className="mt-3 max-w-[28ch] text-sm leading-6 text-zinc-500">
          Configure a precise acrylic enclosure around the way you patch.
        </p>
      </div>

      <Separator className="bg-white/[0.07]" />

      <section className="space-y-3" aria-labelledby="rack-size-label">
        <FieldLabel value={`${rows * 3}U`}>Rack size</FieldLabel>
        <div id="rack-size-label" className="segmented-control">
          {rowOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "segment",
                rows === option.value && "segment-active",
              )}
              onClick={() => onRowsChange(option.value)}
              aria-pressed={rows === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <FieldLabel value={`${hp} HP`}>Width</FieldLabel>
        <Slider
          min={42}
          max={126}
          step={2}
          value={[hp]}
          onValueChange={(value) => onHpChange(sliderValue(value))}
          aria-label="Case width in horizontal pitch"
          className="acryl-slider"
        />
        <div className="flex justify-between font-mono text-[0.65rem] text-zinc-600">
          <span>42 HP</span>
          <span>126 HP</span>
        </div>
      </section>

      <section className="space-y-4">
        <FieldLabel value={`${depth} mm`}>Internal depth</FieldLabel>
        <Slider
          min={80}
          max={250}
          step={5}
          value={[depth]}
          onValueChange={(value) => onDepthChange(sliderValue(value))}
          aria-label="Internal case depth in millimeters"
          className="acryl-slider"
        />
        <div className="flex justify-between font-mono text-[0.65rem] text-zinc-600">
          <span>80 mm</span>
          <span>250 mm</span>
        </div>
      </section>

      <section className="space-y-3">
        <FieldLabel value={tint.label}>Acrylic tint</FieldLabel>
        <div className="grid grid-cols-4 gap-2">
          {acrylicTints.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cn(
                "tint-swatch",
                tint.id === option.id && "tint-swatch-active",
              )}
              onClick={() => onTintChange(option)}
              aria-label={`${option.label} acrylic`}
              aria-pressed={tint.id === option.id}
            >
              <span
                className="tint-color"
                style={{ backgroundColor: option.color }}
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div id="materials" className="material-note">
        <ShieldCheck className="size-4 text-emerald-400" />
        <div>
          <p className="text-xs font-medium text-zinc-200">
            Fabrication-safe geometry
          </p>
          <p className="mt-1 text-[0.7rem] leading-4 text-zinc-500">
            All clearances follow the selected 3 mm sheet profile.
          </p>
        </div>
      </div>
    </aside>
  );
}
