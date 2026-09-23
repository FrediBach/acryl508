export type AcrylicTint = {
  id: string;
  label: string;
  color: string;
};

export type CaseConfiguration = {
  hp: number;
  rows: number;
  depth: number;
  tint: AcrylicTint;
};

export const acrylicTints: AcrylicTint[] = [
  { id: "smoke", label: "Smoke", color: "#5d6470" },
  { id: "clear", label: "Clear", color: "#dbe9ef" },
  { id: "frost", label: "Frost", color: "#b9c4ca" },
  { id: "amber", label: "Amber", color: "#bd6d28" },
];

export const rowOptions = [
  { label: "3U", value: 1 },
  { label: "6U", value: 2 },
  { label: "9U", value: 3 },
];

export const rowIds = ["lower", "middle", "upper"];
