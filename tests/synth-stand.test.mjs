import assert from "node:assert/strict";
import test from "node:test";
import polygonClipping from "polygon-clipping";
import { loadTypescript } from "./load-typescript.mjs";

const { createSynthStand, defaultStandConfiguration, standExport, standSvg, standSheetLayout } = await loadTypescript("../lib/synth-stand.ts");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≈ ${b}`);
const rect = (x1, y1, x2, y2) => [[[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]];
const ys = polygons => polygons.flat(2).map(point => point[1]);

test("stand support edge follows synth depth and angle, with extra ribs for wider instruments", () => {
  for (const width of [180, 490, 550, 1000, 1400]) {
    for (const angle of [0, 15, 25, 45]) {
      const stand = createSynthStand({ ...defaultStandConfiguration, width, angle });
      assert.equal(stand.parts.length, stand.ribCount + 3);
      assert.ok(stand.supportSpacing <= 220);
      near(stand.ribPositions[0], -stand.ribPositions.at(-1));
      assert.equal(new Set(stand.parts.map(part => part.id)).size, stand.parts.length);
      const radians = angle * Math.PI / 180;
      const deck = stand.parts[0].polygons[0][0];
      const endpoint = [stand.config.depth * Math.cos(radians), stand.frontHeight + stand.config.depth * Math.sin(radians)];
      // Boolean operations may remove collinear vertices (notably at 0°).
      assert.ok(deck.slice(1).some((b, i) => {
        const a = deck[i], [x, y] = endpoint;
        const cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
        return Math.abs(cross) < 1e-7 && x >= Math.min(a[0], b[0]) - 1e-7 && x <= Math.max(a[0], b[0]) + 1e-7 && y >= Math.min(a[1], b[1]) - 1e-7 && y <= Math.max(a[1], b[1]) + 1e-7;
      }));
      assert.ok(stand.front < -stand.config.height * Math.sin(radians));
      assert.ok(stand.rear > stand.config.depth * Math.cos(radians));
    }
  }
  assert.ok(createSynthStand({ ...defaultStandConfiguration, width: 1400 }).ribCount > createSynthStand({ ...defaultStandConfiguration, width: 180 }).ribCount);
});

test("every supported extreme produces connected parts with complementary, non-colliding half-laps", () => {
  for (const width of [180, 550, 1400]) for (const depth of [120, 280, 600]) for (const height of [20, 200]) for (const angle of [0, 25, 45]) for (const thickness of [5, 10]) for (const clearance of [0, 0.4]) {
    const stand = createSynthStand({ ...defaultStandConfiguration, width, depth, height, angle, thickness, clearance });
    for (const part of stand.parts) {
      assert.equal(part.polygons.length, 1, `${part.id} must stay connected`);
      assert.equal(part.polygons[0].length, 1, "all slots must open to an edge");
      assert.ok(part.polygons.flat(2).every(point => point.every(Number.isFinite)));
      near(Math.min(...ys(part.polygons)), 0);
    }
    const rib = stand.parts[0], brace = stand.parts.find(part => part.kind === "brace");
    for (const z of stand.bracePositions) {
      const ribSlice = polygonClipping.intersection(rib.polygons, rect(z - thickness / 2 + 1e-6, -1, z + thickness / 2 - 1e-6, 1000));
      assert.ok(ribSlice.length);
      const ribLowest = Math.min(...ys(ribSlice));
      for (const x of stand.ribPositions) {
        const braceSlice = polygonClipping.intersection(brace.polygons, rect(x - thickness / 2 + 1e-6, -1, x + thickness / 2 - 1e-6, 1000));
        assert.ok(braceSlice.length);
        const braceHighest = Math.max(...ys(braceSlice));
        near(ribLowest - braceHighest, 0.2);
      }
    }
    near(stand.slotWidth, thickness + clearance);
  }
});

test("flat export contains each actual part once at millimetre scale with no overlapping layout boxes", () => {
  const stand = createSynthStand({ ...defaultStandConfiguration, width: 1400, depth: 600, angle: 45 });
  const layout = standSheetLayout(stand);
  const boxes = layout.parts.map(({ part, x, y }) => ({ left: x + part.minX, right: x + part.minX + part.width, top: y - part.height, bottom: y }));
  boxes.forEach((box, i) => {
    assert.ok(box.left >= 10 - 1e-7 && box.top >= 10 - 1e-7 && box.right <= layout.width - 10 + 1e-7 && box.bottom <= layout.height - 10 + 1e-7);
    boxes.slice(i + 1).forEach(other => assert.ok(box.right < other.left || other.right < box.left || box.bottom < other.top || other.bottom < box.top));
  });
  const svg = standSvg(stand);
  assert.match(svg, /width="[\d.]+mm" height="[\d.]+mm"/);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined|<text/);
  assert.equal((svg.match(/<path /g) ?? []).length, stand.parts.length);
  for (const part of stand.parts) assert.ok(svg.includes(`id="${part.id}"`));
  const json = standExport(stand);
  assert.deepEqual(json.parts, stand.parts);
  assert.equal(json.mode, "synth-stand");
  assert.equal(json.construction.totalParts, stand.parts.length);
  assert.equal(json.construction.loadRating, null);
  assert.equal(json.construction.kerfCompensated, false);
  assert.equal(json.construction.hardware, 0);
});

test("invalid input is bounded before geometry and export", () => {
  const stand = createSynthStand({ ...defaultStandConfiguration, width: NaN, depth: -4, height: Infinity, angle: 90, thickness: 0, clearance: -1 });
  assert.equal(stand.config.width, defaultStandConfiguration.width);
  assert.equal(stand.config.depth, 120);
  assert.equal(stand.config.height, defaultStandConfiguration.height);
  assert.equal(stand.config.angle, 45);
  assert.equal(stand.config.thickness, 5);
  assert.equal(stand.config.clearance, 0);
  assert.doesNotMatch(standSvg(stand), /NaN|Infinity/);
});

test("cable holes stay closed and preserve brace borders and complete joint regions", () => {
  for (const width of [180, 490, 550, 1400]) for (const thickness of [5, 6, 10]) for (const cableHoleDiameter of [8, 20, 32]) {
    const config = { ...defaultStandConfiguration, width, thickness, clearance: 0.4, cableHoleDiameter };
    const original = createSynthStand(config);
    const stand = createSynthStand({ ...config, cableHoles: true });
    const { diameter, minimumWeb, centers } = stand.cableHoles;
    assert.ok(diameter <= cableHoleDiameter && diameter >= 8);
    assert.equal(centers.length, stand.ribCount - 1);
    const originalBrace = original.parts.find(part => part.kind === "brace").polygons;
    for (const part of stand.parts) {
      if (part.kind === "rib") {
        assert.deepEqual(part.polygons, original.parts.find(other => other.id === part.id).polygons);
        continue;
      }
      assert.equal(part.polygons.length, 1, "brace remains one connected part");
      assert.equal(part.polygons[0].length, centers.length + 1, "each passage is a closed internal hole");
      for (const { x, y } of centers) {
        assert.ok(y - diameter / 2 >= minimumWeb - 1e-7);
        assert.ok(stand.braceHeight - y - diameter / 2 >= minimumWeb - 1e-7);
        const insideHole = rect(x - diameter / 4, y - diameter / 4, x + diameter / 4, y + diameter / 4);
        assert.deepEqual(polygonClipping.intersection(part.polygons, insideHole), []);
        for (const ribX of stand.ribPositions) assert.ok(Math.abs(x - ribX) - diameter / 2 - stand.slotWidth / 2 - stand.reliefRadius >= minimumWeb - 1e-7);
      }
      for (const ribX of stand.ribPositions) {
        const halfWidth = stand.slotWidth / 2 + stand.reliefRadius + minimumWeb - 0.001;
        const jointZone = rect(ribX - halfWidth, -1, ribX + halfWidth, stand.braceHeight + 1);
        assert.deepEqual(polygonClipping.intersection(part.polygons, jointZone), polygonClipping.intersection(originalBrace, jointZone));
      }
    }
  }
});

test("cable-hole exports include the resolved diameter and holes, with unchanged defaults and toggle-off geometry", () => {
  const config = { ...defaultStandConfiguration, thickness: 5, cableHoles: true, cableHoleDiameter: 32 };
  const stand = createSynthStand(config), data = standExport(stand), svg = standSvg(stand);
  assert.equal(data.cableManagement.requestedDiameter, 32);
  assert.equal(data.cableManagement.diameter, 20);
  assert.equal(data.cableManagement.totalCount, (stand.ribCount - 1) * 3);
  assert.equal(data.configuration.cableHoles, true);
  for (const brace of stand.parts.filter(part => part.kind === "brace")) {
    const group = svg.match(new RegExp(`<g id="${brace.id}"[\\s\\S]*?</g>`))[0];
    const path = group.match(/<path d="([^"]+)"/)[1];
    assert.equal((path.match(/\bM/g) ?? []).length, stand.cableHoles.countPerBrace + 1);
  }
  const { cableHoles, cableHoleDiameter, ...legacy } = defaultStandConfiguration;
  assert.equal(cableHoles, false);
  assert.equal(cableHoleDiameter, 20);
  assert.deepEqual(createSynthStand(legacy).parts, createSynthStand(defaultStandConfiguration).parts);
  assert.deepEqual(createSynthStand({ ...config, cableHoles: false }).parts, createSynthStand({ ...defaultStandConfiguration, thickness: 5 }).parts);
  assert.equal(createSynthStand({ ...config, cableHoleDiameter: NaN }).config.cableHoleDiameter, 20);
});
