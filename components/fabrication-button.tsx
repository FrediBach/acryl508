import { LayoutGrid } from "lucide-react";

export function FabricationButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="button summary-export summary-fabrication" aria-haspopup="dialog" aria-controls="fabrication-dialog" onClick={onClick}><LayoutGrid size={15} />Fabrication workspace</button>;
}
