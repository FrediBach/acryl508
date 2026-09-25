import { defaultTint, defaultTransparency } from "./acrylic-material";

const appearanceKeys = new Set(["tint", "transparency", "panelTints", "panelTransparencies", "sheetTints", "sheetTransparencies"]);
// One-entry cache retains geometry inputs through appearance-only edits. Nested
// geometry and meshes are immutable and compared by identity, never serialized.
export function geometryInputCache<T extends object>() {
  let previous: T | undefined;
  return (config: T): T => {
    const entries = Object.entries(config).filter(([key]) => !appearanceKeys.has(key));
    if (previous && entries.length === Object.keys(previous).filter(key => !appearanceKeys.has(key)).length &&
      entries.every(([key, value]) => Object.is(previous![key as keyof T], value))) return previous;
    previous = { ...Object.fromEntries(entries), tint: defaultTint, transparency: defaultTransparency } as T;
    return previous;
  };
}
