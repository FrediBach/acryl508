import assert from "node:assert/strict";
import test from "node:test";
import clipping from "polygon-clipping";
import { Euler, ExtrudeGeometry, ShapeUtils, Vector3 } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, caseDimensions, configurationExport, panelThickness, panelTint, panelTransparency, rackRowAngles, rackRowLayout } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels, caseCanExport } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg, casePathData, caseSheetLayout, caseSheetMaterial } = await loadTypescript("../lib/svg-export.ts");
const { caseFabrication, packSheets, stockSvg } = await loadTypescript("../lib/fabrication.ts");
const { readCase, parseProject, makeProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const { mapPolygons, shapesToPolygons, geometryArea, polygonBounds } = await loadTypescript("../lib/custom-cutouts.ts");
const { backboardMountLayout } = await loadTypescript("../lib/backboard-mount.ts");
const { caseRowPanelConfiguration } = await loadTypescript("../lib/case-row-panels.ts");
const near = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const config = { ...defaultConfiguration, vents: false, backboardMount: true };
const box = (left, bottom, right, top) => [[[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]]];
const worldPolygons = (shapes, angle) => {
  const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  return mapPolygons(shapesToPolygons(shapes), (x, y) => [100 * (c * x - s * y), 100 * (s * x + c * y)]);
};

function verifyExtrusion(shape, thickness) {
  const points = shape.extractPoints(24);
  const expectedArea = Math.abs(ShapeUtils.area(points.shape)) - points.holes.reduce((sum, ring) => sum + Math.abs(ShapeUtils.area(ring)), 0);
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
  try {
    const positions = geometry.getAttribute("position");
    assert.ok(positions.array.every(Number.isFinite));
    let capArea = 0;
    for (let i = 0; i < positions.count; i += 3) if ([0, 1, 2].every(j => positions.getZ(i + j) === 0)) {
      capArea += Math.abs((positions.getX(i + 1) - positions.getX(i)) * (positions.getY(i + 2) - positions.getY(i)) - (positions.getY(i + 1) - positions.getY(i)) * (positions.getX(i + 2) - positions.getX(i))) / 2;
    }
    near(capArea, expectedArea, 4e-5);
  } finally { geometry.dispose(); }
}

function sharpMountSide(plain, mount, side) {
  const [original] = shapesToPolygons(plain.faces[side].shapes);
  return clipping.difference(clipping.union([[original[0]]], mount.extension), original.slice(1).map(ring => [ring]), mount.slots);
}

function newOutlineRun(sharp, rounded) {
  const previous = sharp[0][0], outline = rounded[0][0].slice(0, -1);
  const changed = outline.map(point => previous.every(other => Math.hypot(point[0] - other[0], point[1] - other[1]) > 1e-7));
  const starts = changed.flatMap((value, i) => value && !changed[(i + changed.length - 1) % changed.length] ? [i] : []);
  assert.equal(starts.length, 1, "only the case-to-support transition changes its outline");
  const start = starts[0], points = [];
  for (let i = start; changed[i % changed.length]; i++) points.push(outline[i % outline.length]);
  return { points, before: outline[(start + outline.length - 1) % outline.length], after: outline[(start + points.length) % outline.length] };
}

function circleThrough(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  assert.ok(Math.abs(d) > 1e-12, "the transition is curved rather than a straight chamfer");
  const square = point => point[0] ** 2 + point[1] ** 2;
  const center = [
    (square(a) * (b[1] - c[1]) + square(b) * (c[1] - a[1]) + square(c) * (a[1] - b[1])) / d,
    (square(a) * (c[0] - b[0]) + square(b) * (a[0] - c[0]) + square(c) * (b[0] - a[0])) / d,
  ];
  return { center, radius: Math.hypot(a[0] - center[0], a[1] - center[1]) };
}

test("backboard settings round-trip and legacy files retain their desktop case", () => {
  const current = { ...config, angle: 40, backboardThickness: 24, backboardClearance: 0.8, backboardEngagement: 110, backboardElevation: 65 };
  const expected = readCase(current);
  assert.equal(expected.angle, 40);
  assert.equal(configurationExport(current).backboardMount.patchingAngleDegrees, 40);
  assert.deepEqual(parseProject(JSON.stringify(configurationExport(current))).designs.case, expected);
  assert.deepEqual(parseProject(JSON.stringify(makeProject("Backboard", "case", { ...initialDesigns, case: current }, []))).designs.case, expected);
  assert.throws(() => readCase({ ...current, angle: 41 }), /Patching angle/);
  assert.throws(() => readCase({ ...current, backboardMount: false }), /Stance angle/);
  const legacy = { ...defaultConfiguration };
  for (const key of Object.keys(legacy).filter(key => key.startsWith("backboard"))) delete legacy[key];
  const restored = readCase(legacy);
  assert.equal(restored.backboardMount, false);
  assert.equal(restored.backboardThickness, 18);
  assert.equal(restored.backboardClearance, 0.5);
  assert.equal(restored.backboardEngagement, 80);
  assert.equal(restored.backboardElevation, 30);
  assert.equal(configurationSvg(legacy, createCasePanels(legacy)), configurationSvg(defaultConfiguration, createCasePanels(defaultConfiguration)));
  for (const [key, minimum, maximum] of [["backboardThickness", 6, 50], ["backboardClearance", 0, 3], ["backboardEngagement", 40, 180], ["backboardElevation", -200, 150]]) {
    for (const value of [minimum, maximum]) assert.equal(readCase({ ...current, [key]: value })[key], value);
    for (const value of [minimum - 0.01, maximum + 0.01, NaN, Infinity, "18", null]) assert.throws(() => readCase({ ...current, [key]: value }), `${key}: ${value}`);
  }
});

test("40° patching keeps cumulative row tilt within the 75° surface limit", () => {
  const current = { ...config, angle: 40, rows: 3, rowUnits: [3, 3, 3], rowAngles: [60, 60, 0] };
  assert.deepEqual(rackRowAngles(current), [0, 35, 0]);
  for (const row of rackRowLayout(current)) assert.ok(current.angle + row.angle <= 75);
  assert.equal(createCasePanels(current).mount.layout.angle, 40);
});

test("negative elevation intent survives project round-trips while exports report the connecting-parts limit", () => {
  for (const backboardElevation of [-12, -200]) {
    const current = { ...config, angle: 30, backboardElevation };
    const panels = createCasePanels(current), mount = panels.mount.layout;
    const exported = configurationExport(current);
    assert.equal(readCase(current).backboardElevation, backboardElevation);
    assert.equal(parseProject(JSON.stringify(exported)).designs.case.backboardElevation, backboardElevation);
    assert.equal(parseProject(JSON.stringify(makeProject("Lower mount", "case", { ...initialDesigns, case: current }, []))).designs.case.backboardElevation, backboardElevation);
    assert.equal(mount.requestedElevation, backboardElevation);
    assert.ok(mount.minimumElevation < -20 && mount.minimumElevation > -30, "the standard 30° case permits about 24 mm below zero");
    assert.equal(mount.elevation, Math.max(backboardElevation, mount.minimumElevation));
    assert.equal(mount.elevationLimited, backboardElevation < mount.minimumElevation);
    assert.equal(exported.configuration.backboardElevation, backboardElevation);
    assert.equal(exported.backboardMount.elevationMm, mount.elevation);
    assert.equal(exported.backboardMount.requestedElevationMm, backboardElevation);
    assert.equal(exported.backboardMount.minimumElevationMm, mount.minimumElevation);
    assert.equal(exported.backboardMount.elevationLimited, mount.elevationLimited);
    near(-Math.sin(Math.PI / 6) * caseDimensions(current).length / 2 - mount.boardTop * 100, mount.elevation);
    assert.ok(caseCanExport(panels));
    assert.ok(!/NaN|Infinity/.test(configurationSvg(current, panels)));
  }
});

test("reducing the angle or case length safely raises the elevation limit without losing the requested value", () => {
  const current = { ...config, angle: 30, backboardElevation: -12 };
  const original = backboardMountLayout(current, caseDimensions(current));
  near(original.elevation, -12);
  for (const changed of [{ ...current, angle: 0 }, { ...current, angle: 10 }, { ...current, angle: 20, rowUnits: [1] }]) {
    const imported = readCase(changed), mount = backboardMountLayout(imported, caseDimensions(imported));
    assert.equal(imported.backboardElevation, -12);
    assert.equal(mount.minimumElevation, 0);
    assert.equal(mount.elevation, 0);
    assert.equal(mount.elevationLimited, true);
  }
  const restored = readCase(current);
  near(backboardMountLayout(restored, caseDimensions(restored)).elevation, -12);
});

test("mounted cases suppress desktop feet and conflicting rear hooks", () => {
  for (const angle of [0, 20, 40]) {
    const current = { ...config, angle, rows: 2, rowUnits: [3, 1], rowAngles: [35, 0] };
    const panels = createCasePanels(current);
    const conflicting = { ...current, flatFeet: true, flatFootHeight: 30, footShape: "sled", backHook: true, cableHolder: true };
    const resolved = createCasePanels(conflicting);
    for (const side of ["left", "right", "rear"]) near(geometryArea(clipping.xor(resolved.faces[side].original, panels.faces[side].original)), 0);
    assert.deepEqual(resolved.bends.rear, []);
    const restored = readCase(conflicting), exported = configurationExport(conflicting);
    assert.equal(restored.backHook, false);
    assert.equal(restored.cableHolder, false);
    assert.equal(exported.flatFeet.enabled, false);
    assert.equal(exported.rowLayout.automaticFeet, false);
    assert.equal(exported.backHook.enabled, false);
    assert.equal(exported.cableHolder.enabled, false);
  }
});

test("the backboard tucks beneath the rear support for a shorter default mount", () => {
  for (const angle of [20, 30]) {
    const current = { ...config, angle }, dimensions = caseDimensions(current);
    const mount = backboardMountLayout(current, dimensions);
    const previousFront = Math.cos(angle * Math.PI / 180) * dimensions.length / 2;
    const reduction = previousFront - mount.frontOuter * 100;
    assert.ok(reduction > 35 && reduction < 45, `The ${angle}° mount moves approximately 40 mm closer (${reduction} mm)`);
    near(mount.compactInsetMm, reduction);
    assert.ok(mount.frontOuter >= 0, "the saddle remains beneath the rear half of the case");
  }
});

test("the mounting root gains a tangent circular fillet without thinning the support or narrowing the board gap", () => {
  let capped = 0;
  for (const rowUnits of [[1], [3]]) for (const angle of [0, 20, 40]) for (const backboardElevation of [-200, 0, 30, 150]) for (const [left, right, rear] of [[3, 6, 4], [6, 3, 6]]) {
    const current = { ...config, rowUnits, angle, backboardElevation, individualPanelTints: true, panelThicknesses: { left, right, rear } };
    const panels = createCasePanels(current), mount = panels.mount.layout;
    const plain = createCasePanels({ ...current, backboardMount: false, angle: 0, flatFeet: false });
    near(mount.rootRadius * 100, 3 * Math.max(left, right));
    for (const side of ["left", "right"]) {
      const sharp = sharpMountSide(plain, panels.mount, side), rounded = shapesToPolygons(panels.faces[side].shapes);
      assert.equal(rounded.length, 1, "the reinforced root stays connected to the case and saddle");
      near(geometryArea(clipping.difference(sharp, rounded)), 0, 1e-8);
      const added = clipping.difference(rounded, sharp);
      assert.ok(geometryArea(added) > 1e-6, "rounding adds acrylic at the inside corner");
      near(geometryArea(clipping.difference(added, panels.mount.reserved)), 0, 1e-8);
      const holes = polygons => polygons.flatMap(polygon => polygon.slice(1).map(ring => [ring]));
      near(geometryArea(clipping.xor(holes(rounded), holes(sharp))), 0, 1e-8);

      const { points, before, after } = newOutlineRun(sharp, rounded);
      assert.ok(points.length >= 4, "the root has a sampled arc");
      const { center, radius } = circleThrough(points[0], points[Math.floor(points.length / 2)], points.at(-1));
      assert.ok(radius > 0 && radius <= mount.rootRadius + 1e-7);
      if (radius < mount.rootRadius - 1e-6) capped++;
      for (const point of points) near(Math.hypot(point[0] - center[0], point[1] - center[1]), radius, 1e-7);
      const direction = (a, b) => {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      };
      for (const [a, b] of [[direction(before, points[0]), direction(points[0], points[1])], [direction(points.at(-2), points.at(-1)), direction(points.at(-1), after)]]) {
        assert.ok(a[0] * b[0] + a[1] * b[1] >= Math.cos(3 * Math.PI / 180), "the sampled curve joins both straight edges tangentially");
      }
      for (let i = 1; i < points.length; i++) assert.ok(Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) <= 2 * radius * Math.sin(2.5 * Math.PI / 180) + 1e-7);

      const world = mapPolygons(rounded, (x, y) => [mount.cos * x - mount.sin * y, mount.sin * x + mount.cos * y]);
      near(geometryArea(clipping.intersection(world, box(mount.frontInner, mount.boardBottom - 0.2, mount.rearInner, mount.boardTop))), 0, 1e-8);
      verifyExtrusion(panels.faces[side].shapes[0], panelThickness(current, side) / 100);
    }
    assert.ok(caseCanExport(panels));
  }
  assert.ok(capped > 0, "short 1U runs exercise a smaller fitting radius");
});

test("new root material is reserved from custom cuts and the curved outline reaches fabrication exports", () => {
  const current = { ...config, angle: 40, backboardElevation: -200 };
  const panels = createCasePanels(current), plain = createCasePanels({ ...current, backboardMount: false, angle: 0, flatFeet: false });
  const sheet = caseSheetLayout(panels), fabrication = caseFabrication(current, panels), svg = configurationSvg(current, panels);
  for (const side of ["left", "right"]) {
    const face = panels.faces[side], sharp = sharpMountSide(plain, panels.mount, side), rounded = shapesToPolygons(face.shapes);
    const added = clipping.difference(rounded, sharp), bounds = polygonBounds(added);
    const size = Math.min(bounds.width, bounds.height) / 40;
    let center;
    for (let x = 1; x < 20 && !center; x++) for (let y = 1; y < 20 && !center; y++) {
      const point = [bounds.left + bounds.width * x / 20, bounds.bottom + bounds.height * y / 20];
      const square = box(point[0] - size / 2, point[1] - size / 2, point[0] + size / 2, point[1] + size / 2);
      if (geometryArea(clipping.difference(square, added)) < 1e-12) center = point;
    }
    assert.ok(center, "the regression cut lies wholly within newly added acrylic");
    const cut = { id: "fillet-cut", name: "Square", side, source: { kind: "svg", fileName: "square.svg" }, polygons: box(-0.5, -0.5, 0.5, 0.5), width: size * 100, rotation: 0, x: face.direction * center[0] * 100, y: (center[1] - face.centerY) * 100 };
    const conflicting = createCasePanels({ ...current, cutouts: [cut] });
    assert.match(conflicting.faces[side].report.error, /backboard|mount|support/i);
    assert.equal(caseCanExport(conflicting), false);
    assert.equal(caseFabrication(current, conflicting).blocked, true);
    assert.throws(() => configurationSvg(current, conflicting));

    const part = sheet.parts.find(({ item }) => item.id === side).item;
    const arc = newOutlineRun(sharp, rounded).points;
    for (const [x, y] of arc) assert.ok(part.polygons[0][0].some(point => Math.hypot(point[0] - x * 100, point[1] + y * 100) < 1e-7), "the laser-cut part contains every preview fillet point");
    assert.deepEqual(fabrication.parts.find(item => item.id === side).polygons, part.polygons);
    assert.ok(svg.includes(`d="${casePathData(part.polygons)}"`));
  }
});

test("compact saddles clear the enclosure and keep their slots separate from existing joints", () => {
  const pointSegmentDistance = (point, start, end) => {
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(point[0] - start[0] - t * dx, point[1] - start[1] - t * dy);
  };
  const ringDistance = (a, b) => Math.min(...a.flatMap(point => b.slice(1).map((end, i) => pointSegmentDistance(point, b[i], end))),
    ...b.flatMap(point => a.slice(1).map((end, i) => pointSegmentDistance(point, a[i], end))));
  for (const angle of [0, 10, 20, 30, 40]) for (const backboardElevation of [-200, -12, 0, 30, 150]) for (const [left, right, rear] of [[3, 6, 4], [6, 3, 6], [5, 5, 3]]) {
    const current = { ...config, angle, backboardElevation, individualPanelTints: true, panelThicknesses: { left, right, rear, bottom: 4, front: 5 } };
    const dimensions = caseDimensions(current), panels = createCasePanels(current), mount = panels.mount.layout;
    const plain = createCasePanels({ ...current, backboardMount: false, angle: 0 });
    const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
    const rotate = (polygons) => mapPolygons(polygons, (x, y) => [c * x - s * y, s * x + c * y]);
    const body = rotate(box(-dimensions.length / 2, 0, dimensions.length / 2, dimensions.height));
    const saddle = box(mount.frontOuter * 100, mount.boardBottom * 100, mount.rearOuter * 100, mount.bridgeTop * 100);
    near(geometryArea(clipping.intersection(body, saddle)), 0, 1e-6);
    for (const jaw of panels.mount.parts) {
      // Project both faces of every actual extruded vertex into the world side
      // view, independently of the mount's computed contact-face coordinates.
      const vertices = jaw.shapes[0].getPoints().flatMap(point => [0, jaw.thickness / 100].map(z =>
        new Vector3(point.x, point.y, z).applyEuler(new Euler(...jaw.rotation)).add(new Vector3(...jaw.position))
          .applyEuler(new Euler(radians, 0, 0)).multiplyScalar(100)));
      const projected = box(Math.min(...vertices.map(point => -point.z)), Math.min(...vertices.map(point => point.y)),
        Math.max(...vertices.map(point => -point.z)), Math.max(...vertices.map(point => point.y)));
      near(geometryArea(clipping.intersection(body, projected)), 0, 1e-6);
    }
    const slots = mapPolygons(panels.mount.slots, (x, y) => [x * 100, y * 100]);
    for (const side of ["left", "right"]) {
      const originals = shapesToPolygons(plain.faces[side].shapes)[0].slice(1);
      const finalHoles = shapesToPolygons(panels.faces[side].shapes)[0].slice(1);
      assert.equal(finalHoles.length, originals.length + slots.length, "each mounting slot remains a separate closed hole");
      for (const slot of slots) for (const original of originals) {
        const hole = original.map(([x, y]) => [x * 100, y * 100]);
        near(geometryArea(clipping.intersection([slot], [[hole]])), 0, 1e-6);
        assert.ok(ringDistance(slot[0], hole) >= mount.web * 100 - 1e-6, "mounting slots retain a full web before existing panel joints and rail holes");
      }
    }
    assert.ok(caseCanExport(panels));
  }
});

test("negative elevation stops before the saddle roof reaches the enclosure at varied row lengths and sheet thicknesses", () => {
  for (const rowUnits of [[1], [3], [3, 3, 3]]) for (const angle of [0, 10, 20, 30, 40]) for (const [left, right, rear] of [[3, 6, 4], [6, 3, 6], [5, 5, 3]]) {
    const base = { ...config, rowUnits, rows: rowUnits.length, angle, individualPanelTints: true, panelThicknesses: { left, right, rear, bottom: 4, front: 5 } };
    const dimensions = caseDimensions(base), minimum = backboardMountLayout(base, dimensions).minimumElevation;
    assert.ok(Number.isInteger(minimum));
    assert.ok(minimum >= -200 && minimum <= 0);
    for (const backboardElevation of [minimum, Math.max(-200, minimum - 100)]) {
      const current = { ...base, backboardElevation }, panels = createCasePanels(current), mount = panels.mount.layout;
      assert.equal(mount.elevation, minimum);
      assert.equal(mount.elevationLimited, backboardElevation < minimum);
      if (minimum < 0) {
        assert.ok(-mount.sin * mount.frontOuter + mount.cos * mount.bridgeTop <= -mount.web + 1e-8, "the complete saddle roof retains one web below the inclined enclosure");
        assert.ok(mount.frontOuter <= mount.cos * mount.length / 2 + 1e-8);
      }
      const body = mapPolygons(box(-dimensions.length / 2, 0, dimensions.length / 2, dimensions.height), (x, y) => [mount.cos * x - mount.sin * y, mount.sin * x + mount.cos * y]);
      const saddle = box(mount.frontOuter * 100, mount.boardBottom * 100, mount.rearOuter * 100, mount.bridgeTop * 100);
      near(geometryArea(clipping.intersection(body, saddle)), 0, 1e-6);
      near((mount.rearInner - mount.frontInner) * 100, current.backboardThickness + current.backboardClearance);
      near((mount.boardTop - mount.boardBottom) * 100, current.backboardEngagement);
      for (const side of ["left", "right"]) assert.equal(clipping.union(panels.faces[side].polygons).length, 1, "each support remains attached to its original case side");
      assert.ok(caseCanExport(panels));
    }
  }
});

test("the downward board slot stays vertical and at measured width for every patching angle", () => {
  for (const angle of [0, 10, 20, 30, 40]) for (const backboardThickness of [6, 18, 50]) {
    const current = { ...config, angle, backboardThickness, backboardClearance: 0.8, backboardEngagement: 110, backboardElevation: 45 };
    const panels = createCasePanels(current), mount = backboardMountLayout(current, caseDimensions(current));
    assert.equal(mount.angle, angle);
    const front = mount.frontInner * 100, rear = mount.rearInner * 100, top = mount.boardTop * 100, bottom = mount.boardBottom * 100;
    near(rear - front, backboardThickness + 0.8);
    near(top - bottom, 110);
    near(-Math.sin(angle * Math.PI / 180) * caseDimensions(current).length / 2 - top, 45);
    assert.ok(caseCanExport(panels));
    for (const side of ["left", "right"]) {
      const face = panels.faces[side], world = worldPolygons(face.shapes, angle);
      assert.equal(face.shapes.length, 1, "mount and enclosure are one sheet");
      assert.equal(clipping.union(world).length, 1, "the load-bearing cheek is connected");
      near(geometryArea(clipping.intersection(world, box(front + 0.001, bottom - 20, rear - 0.001, top - 0.001))), 0, 1e-5);
      // A solid roof seats on the board; the full open notch below it allows insertion from above.
      near(geometryArea(clipping.intersection(world, box(front, top + 0.1, rear, top + 1.1))), rear - front, 1e-5);
      // Two separated legs capture the board down to the requested engagement.
      for (const height of [bottom + 0.01, (top + bottom) / 2, top - 0.1]) {
        const section = clipping.intersection(world, box(front - 40, height, rear + 40, height + 0.001));
        assert.equal(section.length, 2, "open U profile has one leg on either face of the board");
        const spans = section.map(polygon => polygonBounds([polygon])).sort((a, b) => a.left - b.left);
        near(spans[0].right, front, 1e-5);
        near(spans[1].left, rear, 1e-5);
      }
      verifyExtrusion(face.shapes[0], panelThickness(current, side) / 100);
    }
  }
});

test("vertical jaw sheets capture the board and their tabs fit the closed side slots", () => {
  for (const angle of [0, 10, 20, 30, 40]) for (const [left, right, rear] of [[3, 6, 4], [6, 3, 6]]) {
    const current = { ...config, angle, individualPanelTints: true, panelThicknesses: { left, right, rear }, backboardThickness: 23, backboardClearance: 0.6 };
    const panels = createCasePanels(current), mount = panels.mount.layout;
    const innerWidth = panels.layout.innerWidth * 100;
    for (const jaw of panels.mount.parts) {
      const rotation = new Euler(...jaw.rotation), stance = new Euler(angle * Math.PI / 180, 0, 0);
      const toWorld = (x, y, z) => new Vector3(x, y, z).applyEuler(rotation).add(new Vector3(...jaw.position)).applyEuler(stance).multiplyScalar(100);
      const shape = jaw.shapes[0], raw = mapPolygons(shapesToPolygons(jaw.shapes), (x, y) => [x * 100, y * 100]);
      const frontFace = toWorld(0, 0, 0), backFace = toWorld(0, 0, jaw.thickness / 100);
      const uMin = Math.min(-frontFace.z, -backFace.z), uMax = Math.max(-frontFace.z, -backFace.z);
      near(uMax - uMin, rear);
      near(frontFace.y, mount.boardBottom * 100);
      near(backFace.y, frontFace.y);
      assert.ok(Math.abs(uMax - mount.frontInner * 100) < 1e-6 || Math.abs(uMin - mount.rearInner * 100) < 1e-6, "each jaw's inner face seats on a different face of the board");
      // The sheet spans the full board width between the side cheeks below the seating roof.
      const midY = (mount.boardTop - mount.boardBottom) * 50;
      near(geometryArea(clipping.intersection(raw, box(-innerWidth / 2, midY, innerWidth / 2, midY + 1))), innerWidth, 1e-5);
      for (const [side, sign, thickness] of [["left", -1, left], ["right", 1, right]]) {
        const face = panels.faces[side], sideWorld = worldPolygons(face.shapes, angle);
        const sideHoles = sideWorld.flatMap(polygon => polygon.slice(1).map(ring => [ring]));
        const x = sign * (innerWidth / 2 + thickness / 2);
        const tabSections = clipping.intersection(raw, box(x - 0.001, -1000, x + 0.001, 1000));
        assert.equal(tabSections.length, 2, "two separated tabs are captured at each end of each jaw sheet");
        for (const section of tabSections) {
          const bounds = polygonBounds([section]);
          const bottom = toWorld(0, bounds.bottom / 100, 0).y, top = toWorld(0, bounds.top / 100, 0).y;
          assert.ok(bottom > mount.boardTop * 100, "closed slots remain above the board's insertion path");
          const tongue = box(uMin, bottom, uMax, top);
          near(geometryArea(clipping.intersection(sideWorld, tongue)), 0, 1e-5);
          near(geometryArea(clipping.difference(tongue, sideHoles)), 0, 1e-5);
        }
      }
      for (const point of shape.getPoints()) {
        const worldA = toWorld(point.x, point.y, 0), worldB = toWorld(point.x, point.y, jaw.thickness / 100);
        near(worldA.y, worldB.y);
        near(worldA.z, frontFace.z);
        near(worldB.z, backFace.z);
      }
    }
  }
});

test("mounting cheeks preserve existing panel joints and rail holes with mixed sheet thicknesses", () => {
  for (const [left, right, rear] of [[3, 6, 4], [6, 3, 6], [5, 5, 3]]) for (const angle of [0, 30, 40]) {
    const current = { ...config, angle, individualPanelTints: true, panelThicknesses: { left, right, rear, bottom: 4, front: 5 }, rows: 2, rowUnits: [3, 1], rowAngles: [25, 0] };
    const mounted = createCasePanels(current), plain = createCasePanels({ ...current, backboardMount: false, angle: 0 });
    assert.deepEqual(mounted.layout, plain.layout);
    assert.equal(mounted.mount.parts.length, 2);
    for (const side of ["left", "right"]) {
      const face = mounted.faces[side], holes = shapesToPolygons(face.shapes)[0].slice(1).map(ring => [ring]);
      for (const hole of shapesToPolygons(plain.faces[side].shapes)[0].slice(1)) {
        // Compare void area, independently of winding/order introduced by polygon unions.
        const originalHole = [[hole]];
        near(geometryArea(clipping.difference(originalHole, holes)), 0, 1e-8);
      }
      verifyExtrusion(face.shapes[0], panelThickness(current, side) / 100);
    }
    for (const side of ["front", "rear", "bottom"]) assert.deepEqual(mounted.faces[side].original, plain.faces[side].original);
    for (const part of mounted.mount.parts) {
      assert.equal(part.shapes.length, 1);
      assert.equal(part.thickness, rear);
      verifyExtrusion(part.shapes[0], part.thickness / 100);
    }
  }
});

test("both extra jaw sheets export in millimetres using the rear material and join the stock layout", () => {
  const current = { ...config, angle: 40, individualPanelTints: true, panelThicknesses: { rear: 4, left: 3, right: 6 }, panelTints: { rear: { id: "red", color: "#ff0000", label: "Red" } }, panelTransparencies: { rear: "opaque" } };
  const panels = createCasePanels(current), stock = caseSheetLayout(panels), fabrication = caseFabrication(current, panels), svg = configurationSvg(current, panels);
  assert.equal(stock.parts.length, 7);
  assert.equal(fabrication.parts.length, 7);
  assert.equal(configurationExport(current).acrylicParts.totalPanels, 7);
  assert.equal((svg.match(/data-part=/g) ?? []).length, 7);
  assert.match(svg, /data-units="mm"/);
  assert.ok(!/NaN|Infinity/.test(svg));
  assert.deepEqual(fabrication.parts.map(part => part.polygons), stock.parts.map(({ item }) => item.polygons));
  for (const jaw of panels.mount.parts) {
    const item = stock.parts.find(({ item }) => item.id === jaw.id).item;
    assert.deepEqual(caseSheetMaterial(current, item), { thickness: 4, tint: panelTint(current, "rear"), transparency: panelTransparency(current, "rear") });
    const shapeBounds = polygonBounds(shapesToPolygons(jaw.shapes));
    near(item.bounds.width, shapeBounds.width * 100);
    near(item.bounds.height, shapeBounds.height * 100);
    assert.match(svg, new RegExp(`data-part="${jaw.id}" data-thickness-mm="4" data-color="Red" data-transparency="opaque"`));
  }
  const { sheets, unplaced } = packSheets(fabrication.parts, 2000, 2000, 10, true);
  assert.deepEqual(unplaced, []);
  assert.equal(sheets.reduce((sum, sheet) => sum + sheet.parts.length, 0), 7);
  for (const sheet of sheets) {
    assert.ok(sheet.parts.every(part => part.thickness === sheet.thickness));
    assert.match(stockSvg(sheet, 2000, 2000), new RegExp(`${sheet.thickness} mm`));
  }
});

test("cutting a load-bearing mounting roof blocks fabrication while body artwork remains editable", () => {
  const cut = { id: "mount-cut", name: "Square", source: { kind: "svg", fileName: "square.svg" }, polygons: box(-0.5, -0.5, 0.5, 0.5), width: 3, rotation: 0 };
  for (const angle of [0, 30, 40]) for (const side of ["left", "right"]) {
    const current = { ...config, angle }, panels = createCasePanels(current), mount = panels.mount.layout, face = panels.faces[side];
    const a = angle * Math.PI / 180, u = (mount.frontInner + mount.rearInner) / 2, v = mount.boardTop + 0.025;
    const localX = Math.cos(a) * u + Math.sin(a) * v, localY = -Math.sin(a) * u + Math.cos(a) * v;
    const conflicting = createCasePanels({ ...current, cutouts: [{ ...cut, side, x: face.direction * localX * 100, y: (localY - face.centerY) * 100 }] });
    assert.match(conflicting.faces[side].report.error, /backboard|mount|support/i);
    assert.equal(caseCanExport(conflicting), false);
    assert.equal(caseFabrication(current, conflicting).blocked, true);
    assert.throws(() => configurationSvg(current, conflicting));
    const safe = createCasePanels({ ...current, cutouts: [{ ...cut, side, x: -face.direction * caseDimensions(current).length / 4, y: 0 }] });
    assert.ok(caseCanExport(safe));
    assert.equal(safe.faces[side].report.error, undefined);
  }
});

test("automatic power-inlet placement leaves the load-bearing mounting root intact", () => {
  for (const angle of [0, 30, 40]) for (const rows of [1, 3]) {
    const current = { ...config, angle, rows, rowUnits: Array(rows).fill(3), busboard: "compactpwr", compactPwrInletSide: "left" };
    const panels = createCasePanels(current);
    assert.ok(caseCanExport(panels));
    if (panels.inlet.fits) near(geometryArea(clipping.intersection(panels.mount.reserved, panels.inlet.reserved)), 0, 1e-8);
  }
});

test("mounted bounds enclose actual support and jaw vertices at size and elevation extremes", () => {
  for (const rowUnits of [[1], [3, 3, 3]]) for (const angle of [0, 30, 40]) for (const backboardElevation of [-200, -12, 0, 150]) for (const backboardEngagement of [40, 180]) {
    const current = { ...config, rowUnits, rows: rowUnits.length, angle, backboardElevation, backboardEngagement, hp: 20 };
    const panels = createCasePanels(current), { worldBounds } = panels.mount.layout;
    const vertices = worldPolygons(panels.faces.right.shapes, angle).flat(2).map(([u, v]) => ({ y: v / 100, z: -u / 100 }));
    for (const jaw of panels.mount.parts) for (const point of jaw.shapes[0].getPoints()) for (const z of [0, jaw.thickness / 100]) {
      vertices.push(new Vector3(point.x, point.y, z).applyEuler(new Euler(...jaw.rotation)).add(new Vector3(...jaw.position)).applyEuler(new Euler(angle * Math.PI / 180, 0, 0)));
    }
    for (const point of vertices) {
      assert.ok(point.y >= worldBounds.minY - 1e-8 && point.y <= worldBounds.maxY + 1e-8);
      assert.ok(point.z >= worldBounds.minZ - 1e-8 && point.z <= worldBounds.maxZ + 1e-8);
    }
    assert.ok(caseCanExport(panels));
  }
});

test("negative elevation bounds still include the case front when it sits below the mounting legs", () => {
  const current = { ...config, rows: 3, rowUnits: [3, 3, 3], angle: 30, backboardElevation: -200, backboardEngagement: 40 };
  const panels = createCasePanels(current), mount = panels.mount.layout;
  const frontBottom = -Math.sin(Math.PI / 6) * caseDimensions(current).length / 200;
  assert.ok(frontBottom < mount.boardBottom, "this configuration places the case front below the contact sheets");
  near(mount.worldBounds.minY, frontBottom);
  assert.ok(caseCanExport(panels));
});

test("a mount needs rail screws to retain its side cheeks even when custom 1U sheets are fitted", () => {
  for (const rows of [1, 2]) {
    const current = { ...config, rows, rowUnits: Array(rows).fill(1) };
    current.rowPanels = current.rowUnits.map((_, index) => caseRowPanelConfiguration(current, index));
    const panels = createCasePanels(current);
    assert.match(panels.mount.error, /rail|screw|retain/i);
    assert.equal(caseCanExport(panels), false);
    assert.equal(caseFabrication(current, panels).blocked, true);
    assert.throws(() => configurationSvg(current, panels));
    // Returning one row to rails restores the screws that capture the mount joints.
    current.rowPanels[0] = null;
    assert.ok(caseCanExport(createCasePanels(current)));
  }
});
