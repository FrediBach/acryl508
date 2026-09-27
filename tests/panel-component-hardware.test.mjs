import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const require = createRequire(import.meta.url), React = require("react");
const file = new URL("../components/panel-component-hardware.tsx", import.meta.url);
const code = ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new vm.Script(`(function(require,module,exports){${code}\n})`).runInThisContext()(require, mod, mod.exports);
const { PanelComponentHardware } = mod.exports;
const { newPanelComponent } = await loadTypescript("../lib/panel-designer.ts");
const { defaultConfiguration, rackRowLayout, rackRowPoint, panelThickness, sidePanelMargin } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { caseRowPanelConfiguration } = await loadTypescript("../lib/case-row-panels.ts");

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);
const nearPoint = (actual, expected) => actual.toArray().forEach((coordinate, index) => near(coordinate, expected.toArray()[index]));
const children = element => React.Children.toArray(element.props.children);
const mixedComponents = () => [
  { ...newPanelComponent("jack", "audio-in"), x: -62, y: 4, width: 8, height: 80, rotation: -40 },
  { ...newPanelComponent("pot", "level"), x: -25, y: -3, width: 9, bodyWidth: 22, bodyHeight: 22, rotation: 67 },
  { ...newPanelComponent("switch", "mode"), x: 12, y: 2, width: 5, rotation: -90 },
  { ...newPanelComponent("display", "meter"), x: 48, y: -1, width: 28, height: 10, rotation: 12 },
  { ...newPanelComponent("custom", "opening"), x: 85 },
];
const render = (components, thickness = 3, visible = true) => PanelComponentHardware({ components, thickness, visible });

function matrix(props = {}) {
  const scale = typeof props.scale === "number" ? [props.scale, props.scale, props.scale] : props.scale ?? [1, 1, 1];
  return new Matrix4().compose(new Vector3(...(props.position ?? [0, 0, 0])), new Quaternion().setFromEuler(new Euler(...(props.rotation ?? [0, 0, 0]))), new Vector3(...scale));
}

function geometries(element) {
  if (!element || typeof element !== "object") return [];
  if (typeof element.type === "function") return geometries(element.type(element.props));
  const own = typeof element.type === "string" && element.type.endsWith("Geometry") ? [{ type: element.type, args: element.props.args }] : [];
  return [...own, ...React.Children.toArray(element.props.children).flatMap(geometries)];
}

test("hardware follows the module toggle and leaves empty panels and custom openings bare", () => {
  assert.equal(render(mixedComponents(), 3, false), null);
  assert.equal(render([]), null);
  assert.equal(render([newPanelComponent("custom", "opening")]), null);
  const fitted = children(render(mixedComponents()));
  assert.deepEqual(fitted.map(element => element.props.userData.componentId), ["audio-in", "level", "mode", "meter"]);
  assert.ok(fitted.every(element => geometries(element).length > 0), "Each supported component produces actual hardware geometry");
});

test("edited controls retain their identity, position, rotation and selected sheet thickness", () => {
  const components = mixedComponents();
  for (const thickness of [1.5, 3, 6]) {
    const tree = render(components, thickness);
    assert.equal(tree.props.scale, 0.01, "Panel millimetres convert to scene units once");
    children(tree).forEach((element, index) => {
      const component = components[index];
      assert.equal(element.props.name, `panel-component-${component.id}`);
      assert.deepEqual(element.props.userData, { componentId: component.id, componentKind: component.kind });
      assert.deepEqual(element.props.position, [component.x, component.y, thickness]);
      assert.deepEqual(element.props.rotation, [0, 0, component.rotation * Math.PI / 180]);
    });
  }
});

test("hardware stays aligned with cutouts on tilted, recessed and exploded top and bottom panels", () => {
  for (const thickness of [1.5, 6]) {
    const config = { ...defaultConfiguration, hp: 84, rows: 3, rowUnits: [1, 3, 1], rowAngles: [25, 10, 0], angle: 12, vents: false };
    config.rowPanels = [0, 1, 2].map(index => index === 1 ? null : { ...caseRowPanelConfiguration(config, index), thickness, components: mixedComponents() });
    const panels = createCasePanels(config), rows = rackRowLayout(config);
    const rimHeight = config.depth + panelThickness(config, "bottom") + sidePanelMargin(config);
    const stance = matrix({ position: [0, 0.17, 0], rotation: [config.angle * Math.PI / 180, 0, 0] });
    for (const rowPanel of panels.rowPanels) for (const explode of [0, 0.4]) {
      const row = rows[rowPanel.index], tree = render(rowPanel.panel.components, thickness);
      const parent = stance.clone()
        .multiply(matrix({ position: [0, (rimHeight + row.rise) / 100, row.center / 100], rotation: [row.angle * Math.PI / 180, 0, 0] }))
        .multiply(matrix({ position: [0, rowPanel.attachment.normal / 100 + explode * 2, 0] }))
        .multiply(matrix({ rotation: [-Math.PI / 2, 0, 0] }))
        .multiply(matrix(tree.props));
      for (const element of children(tree)) {
        const component = rowPanel.panel.components.find(candidate => candidate.id === element.props.userData.componentId);
        const world = parent.clone().multiply(matrix(element.props));
        const surfacePoint = (x, y, elevation = 0) => {
          const point = rackRowPoint(row, -y, rowPanel.attachment.normal + thickness + explode * 200 + elevation);
          return new Vector3(x / 100, (rimHeight + point.y) / 100, point.z / 100).applyMatrix4(stance);
        };
        nearPoint(new Vector3().applyMatrix4(world), surfacePoint(component.x, component.y));
        nearPoint(new Vector3(0, 0, 1).applyMatrix4(world), surfacePoint(component.x, component.y, 1));
        for (const [x, y] of component.polygons[0][0]) {
          const local = new Vector3(x - component.x, y - component.y, 0).applyAxisAngle(new Vector3(0, 0, 1), -component.rotation * Math.PI / 180);
          nearPoint(local.applyMatrix4(world), surfacePoint(x, y));
        }
      }
    }
  }
});

test("round hardware uses the edited bore diameter and ignores unused opening height", () => {
  for (const kind of ["jack", "pot", "switch"]) {
    const component = { ...newPanelComponent(kind, kind), width: 8 };
    const original = geometries(render([component]));
    assert.deepEqual(geometries(render([{ ...component, height: 100 }])), original, `${kind}: a round bore has one diameter`);
    assert.notDeepEqual(geometries(render([{ ...component, width: 12 }])), original, `${kind}: edited bore dimensions affect the preview`);
  }
  const display = newPanelComponent("display", "meter");
  assert.notDeepEqual(geometries(render([{ ...display, height: 20 }])), geometries(render([display])), "Rectangular display height remains meaningful");
});
