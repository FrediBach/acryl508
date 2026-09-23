import { ChevronRight, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ConfiguratorHeader() {
  return (
    <header className="app-header">
      <a href="#" className="brand" aria-label="Acryl508 home">
        <span className="brand-mark" aria-hidden="true">
          A
        </span>
        <span>
          ACRYL<span className="text-[#ff5b42]">508</span>
        </span>
      </a>
      <nav
        className="hidden items-center gap-7 text-sm text-zinc-500 md:flex"
        aria-label="Primary navigation"
      >
        <a className="nav-link nav-link-active" href="#configure">
          Configurator
        </a>
        <a className="nav-link" href="#materials">
          Materials
        </a>
        <a className="nav-link" href="#guide">
          Build guide
        </a>
      </nav>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="hidden border-white/10 bg-white/[0.03] text-zinc-400 sm:flex"
        >
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Autosaved
        </Badge>
        <Button
          variant="outline"
          size="icon"
          className="border-white/10 bg-transparent"
          aria-label="Save project"
        >
          <Save />
        </Button>
        <Button className="h-9 bg-[#ff5b42] px-4 text-[#180704] hover:bg-[#ff725c]">
          Export design
          <ChevronRight />
        </Button>
      </div>
    </header>
  );
}
