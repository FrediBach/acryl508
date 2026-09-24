import assert from "node:assert/strict";
import test from "node:test";
import polygonClipping from "polygon-clipping";
import { loadTypescript } from "./load-typescript.mjs";

const { createSynthStand, defaultStandConfiguration, standExport, standSvg, standSheetLayout } = await loadTypescript("../lib/synth-stand.ts");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≈ ${b}`);
const rect = (x1, y1, x2, y2) => [[[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]];
const ys = polygons => polygons.flat(2).map(point => point[1]);
const area = polygons => polygons.reduce((sum, polygon) => sum + polygon.reduce((total, ring, index) => {
  const signed = ring.slice(1).reduce((value, point, i) => value + ring[i][0] * point[1] - point[0] * ring[i][1], 0) / 2;
  return total + (index ? -1 : 1) * Math.abs(signed);
}, 0), 0);

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
      near(stand.front, -stand.stopHeight * Math.sin(radians) - 2 * stand.config.thickness * Math.cos(radians));
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

test("rounded outlines stay connected, remove only outer material and preserve slots and cable holes", () => {
  for (const width of [180, 550, 1400]) for (const angle of [0, 1, 25, 45]) for (const thickness of [5, 10]) for (const cornerRadius of [1, 3, 10]) {
    const config = { ...defaultStandConfiguration, width, depth: 120, height: 20, angle, thickness, clearance: 0.4, cableHoles: true, cableHoleDiameter: 32, cornerRadius };
    const square = createSynthStand(config), rounded = createSynthStand({ ...config, roundedEdges: true });
    for (const part of rounded.parts) {
      const original = square.parts.find(other => other.id === part.id);
      assert.equal(part.polygons.length, 1);
      assert.equal(part.polygons[0].length, original.polygons[0].length);
      assert.ok(part.polygons.flat(2).every(point => point.every(Number.isFinite)));
      assert.ok(area(polygonClipping.difference(part.polygons, original.polygons)) < 1e-7, "rounding must not add material into the synth envelope (within floating-point tolerance)");
      assert.ok(polygonClipping.difference(original.polygons, part.polygons).length, "outside corners are actually removed");
      near(Math.min(...ys(part.polygons)), 0);
      near(Math.max(...ys(part.polygons)), part.height);
      const centers = part.kind === "rib" ? rounded.bracePositions : rounded.ribPositions;
      const halfSlot = rounded.slotWidth / 2 + rounded.reliefRadius + 0.01;
      for (const x of centers) {
        const jointZone = rect(x - halfSlot, -1, x + halfSlot, rounded.braceHeight + 1);
        assert.deepEqual(polygonClipping.intersection(part.polygons, jointZone), polygonClipping.intersection(original.polygons, jointZone));
      }
      if (part.kind === "brace") part.polygons[0].slice(1).forEach((ring, index) => {
        const originalRing = original.polygons[0][index + 1];
        assert.equal(ring.length, originalRing.length);
        ring.forEach(([x, y], i) => { near(x, originalRing[i][0]); near(y, originalRing[i][1]); });
      });
    }
  }
});

test("brace corners use the selected circular radius and rounding survives exports and legacy defaults", () => {
  const stand = createSynthStand({ ...defaultStandConfiguration, roundedEdges: true, cornerRadius: 7 });
  const brace = stand.parts.find(part => part.kind === "brace");
  const corner = [-stand.braceWidth / 2, 0], center = [corner[0] + 7, 7];
  const arc = brace.polygons[0][0].filter(([x, y]) => x <= center[0] + 1e-8 && y <= center[1] + 1e-8);
  assert.ok(arc.length > 10);
  for (const [x, y] of arc) near(Math.hypot(x - center[0], y - center[1]), 7);
  assert.equal(standExport(stand).edgeRounding.requestedRadius, 7);
  assert.equal(standExport(stand).edgeRounding.throughThicknessBevel, false);
  assert.deepEqual(standExport(stand).parts, stand.parts);
  assert.match(standSvg(stand), /Outer corners: up to 7 mm radius/);
  const { roundedEdges, cornerRadius, ...legacy } = defaultStandConfiguration;
  assert.equal(roundedEdges, false); assert.equal(cornerRadius, 3);
  assert.deepEqual(createSynthStand(legacy).parts, createSynthStand(defaultStandConfiguration).parts);
  assert.deepEqual(createSynthStand({ ...stand.config, roundedEdges: false }).parts, createSynthStand(defaultStandConfiguration).parts);
  assert.equal(createSynthStand({ ...stand.config, cornerRadius: Infinity }).config.cornerRadius, 3);
});

test("compact front is the default, optional extension changes depth exactly and height no longer adds a toe", () => {
  const compact = createSynthStand(defaultStandConfiguration);
  assert.equal(compact.frontExtension.enabled, false);
  assert.equal(compact.frontExtension.length, 0);
  assert.ok(compact.front > -compact.config.height * Math.sin(compact.config.angle * Math.PI / 180) - 30 - 2 * compact.config.thickness);
  near(createSynthStand({ ...defaultStandConfiguration, height: 200 }).front, compact.front);
  for (const angle of [0, 25, 45]) for (const thickness of [5, 10]) for (const roundedEdges of [false, true]) for (const frontExtensionLength of [5, 15, 100]) {
    const config = { ...defaultStandConfiguration, depth: 120, angle, thickness, roundedEdges, cornerRadius: 10, cableHoles: true };
    const base = createSynthStand(config);
    const extended = createSynthStand({ ...config, frontExtension: true, frontExtensionLength });
    near(extended.dimensions.depth - base.dimensions.depth, frontExtensionLength);
    near(base.front - extended.front, frontExtensionLength);
    near(extended.frontHeight, base.frontHeight);
    near(extended.stopHeight, base.stopHeight);
    for (const part of extended.parts) {
      assert.equal(part.polygons.length, 1);
      assert.ok(part.polygons.flat(2).every(point => point.every(Number.isFinite)));
      near(Math.min(...part.polygons.flat(2).map(point => point[0])), part.minX);
      near(Math.min(...ys(part.polygons)), 0);
      const original = base.parts.find(other => other.id === part.id);
      if (part.kind === "brace") assert.deepEqual(part.polygons, original.polygons);
      else for (const x of base.bracePositions) {
        const halfSlot = base.slotWidth / 2 + base.reliefRadius + 0.01;
        const jointZone = rect(x - halfSlot, -1, x + halfSlot, base.braceHeight + 1);
        assert.deepEqual(polygonClipping.intersection(part.polygons, jointZone), polygonClipping.intersection(original.polygons, jointZone));
      }
    }
  }
  const extended = createSynthStand({ ...defaultStandConfiguration, frontExtension: true, frontExtensionLength: 15 });
  assert.equal(standExport(extended).frontExtension.length, 15);
  assert.match(standSvg(extended), /Front extension: 15 mm beyond the front stops/);
  assert.deepEqual(createSynthStand({ ...extended.config, frontExtension: false }).parts, compact.parts);
  const { frontExtension, frontExtensionLength, ...legacy } = defaultStandConfiguration;
  assert.equal(frontExtension, false); assert.equal(frontExtensionLength, 15);
  assert.deepEqual(createSynthStand(legacy).parts, compact.parts);
  assert.equal(createSynthStand({ ...extended.config, frontExtensionLength: NaN }).config.frontExtensionLength, 15);
});

test("diagonal construction preserves legacy defaults and exports explicit sheet placement", () => {
  const { advancedMode, diagonalAngle, ...legacy } = defaultStandConfiguration;
  assert.equal(advancedMode, false);
  assert.equal(diagonalAngle, 25);
  const standard = createSynthStand(legacy);
  assert.deepEqual(standard.parts, createSynthStand(defaultStandConfiguration).parts);
  const stand = createSynthStand({ ...defaultStandConfiguration, advancedMode: true, cableHoles: true });
  assert.ok(stand.diagonal.angle > 0);
  assert.ok(stand.slotWidth > standard.slotWidth);
  assert.notDeepEqual(stand.parts, standard.parts);
  assert.deepEqual(createSynthStand({ ...stand.config, advancedMode: false, cableHoles: false }).parts, standard.parts);
  const data = standExport(stand);
  assert.equal(data.version, 5);
  assert.deepEqual(data.diagonal, stand.diagonal);
  assert.deepEqual(data.parts, stand.parts);
  assert.equal(data.cableManagement.aligned, false);
  assert.match(standSvg(stand), /diagonal/);
  assert.match(standSvg(stand), /not straight through/);
  assert.equal(createSynthStand({ ...stand.config, diagonalAngle: NaN }).config.diagonalAngle, 25);
  assert.equal(createSynthStand({ ...stand.config, diagonalAngle: 90 }).config.diagonalAngle, 40);
});

test("diagonal extremes retain connected sheets, closed cable holes, and nonoverlapping exports", () => {
  for (const width of [180, 550, 1400]) for (const depth of [120, 600]) for (const angle of [0, 45]) for (const thickness of [5, 10]) for (const diagonalAngle of [5, 25, 40]) for (const roundedEdges of [false, true]) {
    const stand = createSynthStand({ ...defaultStandConfiguration, advancedMode: true, width, depth, angle, thickness, diagonalAngle,
      height: 20, cableHoles: true, cableHoleDiameter: 32, roundedEdges, cornerRadius: 10, frontExtension: true, frontExtensionLength: 100 });
    assert.ok(stand.diagonal.angle > 0 && stand.diagonal.angle <= diagonalAngle + 1e-7);
    assert.ok(stand.supportSpacing <= 220);
    assert.ok(stand.cableHoles.diameter >= 8);
    for (const part of stand.parts) {
      assert.equal(part.polygons.length, 1, `${part.id} stays connected: ${JSON.stringify(stand.config)}`);
      assert.equal(part.polygons[0].length, part.kind === "rib" ? 1 : stand.cableHoles.countPerBrace + 1);
      assert.ok(part.polygons.flat(2).every(p => p.every(Number.isFinite)));
      near(Math.min(...ys(part.polygons)), 0);
      const xs = part.polygons.flat(2).map(p => p[0]);
      near(Math.min(...xs), part.minX);
      near(Math.max(...xs) - Math.min(...xs), part.width);
      near(Math.max(...ys(part.polygons)), part.height);
      // The complete swept sheets remain under the instrument width.
      const { width: ox, yaw } = part.placement;
      for (const x of xs) for (const z of [-thickness / 2, thickness / 2]) {
        assert.ok(Math.abs(ox + x * Math.cos(yaw) + z * Math.sin(yaw)) <= width / 2 + 1e-7);
      }
    }
    const layout = standSheetLayout(stand);
    const boxes = layout.parts.map(({ part, x, y }) => ({ left: x + part.minX, right: x + part.minX + part.width, top: y - part.height, bottom: y }));
    boxes.forEach((box, i) => {
      assert.ok(box.left >= 10 - 1e-7 && box.right <= layout.width - 10 + 1e-7);
      assert.ok(box.top >= 10 - 1e-7 && box.bottom <= layout.height - 10 + 1e-7);
      boxes.slice(i + 1).forEach(other => assert.ok(box.right < other.left || other.right < box.left || box.bottom < other.top || other.bottom < box.top));
    });
    assert.doesNotMatch(standSvg(stand), /NaN|Infinity|undefined/);
  }
});

test("oblique slots clear the complete finite-thickness intersection at every joint", () => {
  for (const diagonalAngle of [5, 25, 40]) for (const thickness of [5, 10]) for (const clearance of [0, 0.4]) {
    const stand = createSynthStand({ ...defaultStandConfiguration, advancedMode: true, width: 1400, depth: 120, diagonalAngle, thickness, clearance });
    const theta = stand.diagonal.angle * Math.PI / 180;
    const halfOverlap = thickness * (1 + Math.sin(theta)) / (2 * Math.cos(theta));
    near(stand.slotWidth, 2 * halfOverlap + clearance);
    for (const rib of stand.parts.filter(p => p.kind === "rib")) for (const brace of stand.parts.filter(p => p.kind === "brace")) {
      const u = brace.position / Math.cos(theta);
      const worldX = rib.placement.width + u * Math.cos(rib.placement.yaw);
      near(worldX - brace.placement.width, rib.position);
      const ribSlice = polygonClipping.intersection(rib.polygons, rect(u - halfOverlap + 1e-6, -1, u + halfOverlap - 1e-6, 1000));
      const braceSlice = polygonClipping.intersection(brace.polygons, rect(rib.position - halfOverlap + 1e-6, -1, rib.position + halfOverlap - 1e-6, 1000));
      near(Math.min(...ys(ribSlice)) - Math.max(...ys(braceSlice)), 0.2);
      // Check each actual corner of the two sheet strips, not just centre lines.
      for (const ribNormal of [-thickness / 2, thickness / 2]) for (const braceNormal of [-thickness / 2, thickness / 2]) {
        const localU = (brace.position + braceNormal + ribNormal * Math.sin(theta)) / Math.cos(theta);
        assert.ok(Math.abs(localU - u) <= stand.slotWidth / 2 + 1e-7);
        const localX = rib.placement.width + localU * Math.sin(theta) + ribNormal * Math.cos(theta) - brace.placement.width;
        assert.ok(Math.abs(localX - rib.position) <= stand.slotWidth / 2 + 1e-7);
      }
    }
  }
});

test("diagonal contact profiles clear the instrument over the full sheet thickness", () => {
  for (const angle of [0, 25, 45]) for (const diagonalAngle of [5, 40]) {
    const stand = createSynthStand({ ...defaultStandConfiguration, advancedMode: true, width: 1400, depth: 120, angle, diagonalAngle, thickness: 10 });
    const a = angle * Math.PI / 180, theta = stand.diagonal.angle * Math.PI / 180;
    const instrument = [[[[0, stand.frontHeight], [120 * Math.cos(a), stand.frontHeight + 120 * Math.sin(a)],
      [120 * Math.cos(a) - 70 * Math.sin(a), stand.frontHeight + 120 * Math.sin(a) + 70 * Math.cos(a)],
      [-70 * Math.sin(a), stand.frontHeight + 70 * Math.cos(a)], [0, stand.frontHeight]]]];
    const rib = stand.parts[0];
    for (const v of [-5, -2.5, 0, 2.5, 5]) {
      const depthProfile = rib.polygons.map(poly => poly.map(ring => ring.map(([u, y]) => [u * Math.cos(theta) - v * Math.sin(theta), y])));
      assert.ok(area(polygonClipping.intersection(depthProfile, instrument)) < 1e-7, "no acrylic penetrates the instrument envelope");
    }
  }
});
