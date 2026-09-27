import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { PerspectiveCamera, Vector3 } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { presentationPose } = await loadTypescript("../lib/presentation-path.ts");
const start = { radius: 8, phi: 0.9, theta: 0.6 };

test("presentation starts at the current pose and successive turns vary their elevation", () => {
  assert.deepEqual(presentationPose(start, 0), start);
  assert.ok(Math.abs(presentationPose(start, 0.001).theta - start.theta) < 1e-7, "Orbit eases in from rest");
  const turns = [1, 2, 3, 4].map(turn => presentationPose(start, 36 * turn + 1.5));
  for (let i = 1; i < turns.length; i++) {
    assert.ok(Math.abs(turns[i].theta - turns[i - 1].theta - Math.PI * 2) < 1e-7);
    assert.ok(Math.abs(turns[i].phi - turns[i - 1].phi) > 0.05, "Same azimuth, different elevation");
  }
  for (let seconds = 3; seconds < 3600; seconds += 0.1) {
    const pose = presentationPose(start, seconds);
    assert.ok(pose.phi > 0.6 && pose.phi < Math.PI / 2, "Stay above the floor and away from the poles");
    assert.ok(pose.radius >= start.radius && pose.radius <= start.radius * 1.12, "Distance stays gently bounded");
  }
});

test("camera holds when paused, rebases on refits, and does not jump after backgrounding", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const require = createRequire(import.meta.url), React = require("react"), { createRoot } = require("react-dom/client");
  const camera = new PerspectiveCamera();
  camera.position.set(5, 4, 6);
  const controls = { current: { target: new Vector3(0, 1, 0), minDistance: 1, maxDistance: 30, minPolarAngle: 0, maxPolarAngle: Math.PI / 2, update() {} } };
  let frame, invalidations = 0;
  const state = { camera, invalidate: () => invalidations++ };
  const code = ts.transpileModule(readFileSync(new URL("../components/use-presentation-camera.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const mockedRequire = name => name === "@react-three/fiber" ? { useThree: () => state, useFrame: callback => { frame = callback; } } : name === "@/lib/presentation-path" ? { presentationPose } : require(name);
  new vm.Script(`(function(require,module,exports){${code}\n})`).runInThisContext()(mockedRequire, mod, mod.exports);
  function Rig({ active }) { mod.exports.usePresentationCamera(controls, active); return null; }
  const root = createRoot(document.getElementById("root"));
  const render = active => React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Rig, { active }))));
  const tick = delta => frame(state, delta);
  try {
    await render(false);
    const initial = camera.position.clone(), idleCount = invalidations;
    tick(1 / 60);
    assert.ok(camera.position.equals(initial));
    assert.equal(invalidations, idleCount, "Paused mode does not request frames");
    await render(true);
    tick(1 / 60);
    assert.ok(camera.position.distanceTo(initial) < 1e-10, "No jump on activation");
    for (let i = 0; i < 600; i++) tick(1 / 60);
    assert.ok(camera.position.distanceTo(initial) > 1);
    const direction = camera.getWorldDirection(new Vector3());
    assert.ok(direction.dot(controls.current.target.clone().sub(camera.position).normalize()) > 0.999999, "Always looks at the object");
    await render(false);
    const paused = camera.position.clone(), pausedCount = invalidations;
    for (let i = 0; i < 60; i++) tick(1 / 60);
    assert.ok(camera.position.equals(paused));
    assert.equal(invalidations, pausedCount);
    await render(true);
    tick(1 / 60);
    assert.ok(camera.position.distanceTo(paused) < 1e-10, "Resume starts from paused pose");
    camera.position.set(9, 8, 7);
    controls.current.target.set(1, 2, 3);
    const refit = camera.position.clone();
    tick(1 / 60);
    assert.ok(camera.position.distanceTo(refit) < 1e-10, "Refits become the new orbit origin");
    tick(120);
    assert.ok(camera.position.distanceTo(refit) < 0.02, "Hidden-tab delta cannot skip ahead");
    await React.act(async () => root.unmount());
  } finally {
    dom.window.close();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});
