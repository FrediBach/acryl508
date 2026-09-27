import { caseThicknesses, isCustomRow, rackRows, type CaseConfiguration } from "./configurator";
import { createPanel, defaultPanelConfiguration, normalizePanelConfiguration, type PanelConfiguration } from "./panel-designer";
import { bands, tabbedProfile } from "./panel-joints";
import { shapesToPolygons } from "./custom-cutouts";
import type { MultiPolygon } from "polygon-clipping";

export function caseRowPanelConfiguration(config: CaseConfiguration, index: number): PanelConfiguration {
  return normalizePanelConfiguration({ ...defaultPanelConfiguration, tint: config.tint, transparency: config.transparency ?? defaultPanelConfiguration.transparency,
    ...config.rowPanels?.[index], format: "intellijel-1u", hp: config.hp, mountingCount: "four" }, 168);
}

export function createCaseRowPanels(config: CaseConfiguration) {
  const rows = rackRows(config);
  return rows.flatMap((_, index) => {
    if (!isCustomRow(config, index)) return [];
    const panelConfig = caseRowPanelConfiguration(config, index), t = panelConfig.thickness;
    const sheets = caseThicknesses(config), width = config.hp * 5.08, height = 39.65;
    // Use the enclosure's tab profile and closed-slot proportions, in mm here.
    const tabs = bands((-height / 2 + 2 * t) / 100, (height / 2 - 2 * t) / 100, t / 100, 0.55).map(tab => ({ start: tab.start * 100, end: tab.end * 100 }));
    const outline = shapesToPolygons([tabbedProfile(width, -height / 2, height / 2, tabs, sheets.left, sheets.right)]);
    const protectedJoints: MultiPolygon = tabs.flatMap(tab => [-1, 1].map(side => {
      const outer = width / 2 + (side < 0 ? sheets.left : sheets.right), root = width / 2 - t;
      return [[[side * root, tab.start], [side * outer, tab.start], [side * outer, tab.end], [side * root, tab.end], [side * root, tab.start]]] as MultiPolygon[number];
    }));
    const panel = createPanel(panelConfig, 168, { outline, width, height, protectedJoints });
    // Recess by one sheet thickness to retain a full web above each closed slot.
    return [{ id: `row-${index + 1}` as const, index, label: `${index === 0 ? "Top" : "Bottom"} 1U panel`, panel,
      attachment: { tabs, normal: -2 * t, thickness: t, protectedJoints } }];
  });
}
