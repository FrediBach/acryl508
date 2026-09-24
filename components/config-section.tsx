import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function ConfigSection({ number, title, summary, children, defaultOpen = false, id }: { number: string; title: string; summary: string; children: ReactNode; defaultOpen?: boolean; id?: string }) {
  return <details className="config-section" open={defaultOpen} id={id}>
    <summary className="config-section-trigger">
      <span className="section-number" aria-hidden="true">{number}</span>
      <span className="config-section-label"><h3>{title}</h3><span className="config-section-summary">{summary}</span></span>
      <ChevronDown className="config-section-chevron" size={14} aria-hidden="true" />
    </summary>
    <div className="config-section-body">{children}</div>
  </details>;
}
