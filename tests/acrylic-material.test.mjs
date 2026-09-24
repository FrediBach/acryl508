import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { acrylicMaterial, acrylicTints } = await loadTypescript("../lib/acrylic-material.ts");
const { defaultConfiguration, panelTransparency, configurationExport } = await loadTypescript("../lib/configurator.ts");

test("all shop colors support distinct transparent, see-through, opal and opaque materials", () => {
  assert.deepEqual(acrylicTints.map(tint => tint.shopLabel), ["Farblos", "Schwarz", "Weiss", "Grau", "Orange", "Rot", "Gelb", "Blau", "Grün", "Umbra", "Braun"]);
  for (const tint of acrylicTints) {
    const clear = acrylicMaterial(tint, 0.05, "transparent");
    const seeThrough = acrylicMaterial(tint, 0.05, "see-through");
    const opal = acrylicMaterial(tint, 0.05, "opal");
    const opaque = acrylicMaterial(tint, 0.05, "opaque");
    assert.equal(opaque.transmission, 0);
    assert.ok(clear.transmission > seeThrough.transmission && seeThrough.transmission > opal.transmission && opal.transmission > 0);
    assert.ok(clear.roughness < seeThrough.roughness && seeThrough.roughness < opal.roughness);
    for (const material of [clear, seeThrough, opal, opaque]) {
      assert.equal(material.opacity, 1, "Use optical transmission without alpha fading");
      assert.equal(material.thickness, 0.05);
      assert.equal(material.metalness, 0);
    }
  }
  const colorless = acrylicMaterial(acrylicTints[0], 0.06);
  assert.equal(colorless.color.getHexString(), "ffffff", "Colorless has no cyan tint");
  assert.equal(colorless.attenuationColor, "#ffffff");
});

test("sheet transparency follows individual mode and falls back for legacy or partial configurations", () => {
  const config = { ...defaultConfiguration, transparency: "opal", individualPanelTints: true, panelTransparencies: { front: "opaque" } };
  assert.equal(panelTransparency(config, "front"), "opaque");
  assert.equal(panelTransparency(config, "rear"), "opal");
  assert.equal(panelTransparency({ ...config, individualPanelTints: false }, "front"), "opal");
  assert.equal(panelTransparency({ tint: defaultConfiguration.tint }, "front"), "transparent");
  assert.equal(configurationExport(config).configuration.panelTransparencies.front, "opaque");
});

test("milky sheets retain their pigment and diffuse more light as thickness increases", () => {
  const orange = acrylicTints.find(tint => tint.id === "orange");
  const thin = acrylicMaterial(orange, 0.03, "opal");
  const thick = acrylicMaterial(orange, 0.1, "opal");
  assert.ok(thick.transmission < thin.transmission);
  assert.ok(thick.roughness > thin.roughness);
  assert.ok(thick.clearcoat > 0 && thick.clearcoatRoughness < thick.roughness, "Surface reflection stays smoother than the diffused interior");
  assert.ok(thick.color.g < thick.color.r * 0.25 && thick.color.b < thick.color.g * 0.3, "Milky orange remains orange rather than pale pink");
  assert.equal(thick.opacity, 1, "Thicker sheets never use alpha fading");
});
