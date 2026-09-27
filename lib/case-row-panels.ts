import { rackRows, type CaseConfiguration } from "./configurator";
import { createPanel, defaultPanelConfiguration, normalizePanelConfiguration, type PanelConfiguration } from "./panel-designer";

export function caseRowPanelConfiguration(config: CaseConfiguration, index: number): PanelConfiguration {
  return normalizePanelConfiguration({ ...defaultPanelConfiguration, tint: config.tint, transparency: config.transparency ?? defaultPanelConfiguration.transparency,
    ...config.rowPanels?.[index], format: "intellijel-1u", hp: config.hp, mountingCount: "four" }, 168);
}

export function createCaseRowPanels(config: CaseConfiguration) {
  const rows = rackRows(config);
  return rows.flatMap((units, index) => {
    if (units !== 1 || (index !== 0 && index !== rows.length - 1) || !config.rowPanels?.[index]) return [];
    return [{ id: `row-${index + 1}` as const, index, label: `${index === 0 ? "Top" : "Bottom"} 1U panel`, panel: createPanel(caseRowPanelConfiguration(config, index), 168) }];
  });
}
