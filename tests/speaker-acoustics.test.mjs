import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { loadTypescript } from "./load-typescript.mjs";
const acoustics = await loadTypescript("../lib/speaker-acoustics.ts");
const speakerModule = await loadTypescript("../lib/speaker.ts");
const { speakerAcousticChamber: chamber, speakerAcousticComparison: compare } = acoustics;
const { createSpeaker, defaultSpeakerConfiguration: defaults, speakerExport } = speakerModule;
const { parseProject } = await loadTypescript("../lib/project.ts");
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`);

test("air-volume and mode estimates obey dimensional scaling without inventing a sound response", () => {
  const ref = chamber(defaults), equal = compare(ref, ref);
  close(ref.grossLitres, 5.94); close(equal.tuningRatio, 1); close(equal.stiffnessRatio, 1);
  close(equal.modes[0].currentHz, 343 / (2 * 0.27));
  const doubled = { width: ref.width * 2, height: ref.height * 2, depth: ref.depth * 2, grossLitres: ref.grossLitres * 8 };
  const bigger = compare(doubled, ref);
  close(bigger.volumeRatio, 8); close(bigger.tuningRatio, 1 / Math.sqrt(8)); close(bigger.stiffnessRatio, 1 / 8);
  bigger.modes.forEach(mode => close(mode.currentHz, mode.referenceHz / 2));
  const reshaped = compare({ ...ref, width: ref.width * 2, height: ref.height / 2 }, ref);
  close(reshaped.tuningRatio, 1);
  close(reshaped.modes[0].currentHz, reshaped.modes[0].referenceHz / 2);
  close(reshaped.modes[1].currentHz, reshaped.modes[1].referenceHz * 2);
  const displaced = compare(doubled, ref, 1.2);
  close(displaced.currentLitres, doubled.grossLitres - 1.2);
  close(displaced.referenceLitres, ref.grossLitres - 1.2);
  close(displaced.tuningRatio, Math.sqrt((ref.grossLitres - 1.2) / (doubled.grossLitres - 1.2)));
  for (const invalid of [-1, NaN, Infinity, ref.grossLitres]) assert.throws(() => compare(ref, ref, invalid));
});

test("live acoustic geometry matches the assembled chamber across allowed dimensions and damping", () => {
  for (const width of [280, 420]) for (const height of [210, 300]) for (const depth of [110, 220]) for (const thickness of [3, 8]) for (const damping of [false, true]) {
    const s = createSpeaker({ ...defaults, width, height, depth, thickness, damping, dampingThickness: 2,
      individualSheetMaterials: true, sheetThicknesses: { left: 8, right: 3, baffle: 8, rear: 8 } });
    const c = chamber(s.config);
    close(c.grossLitres, s.grossVolumeLitres); close(c.width, s.innerWidth); close(c.height, s.innerHeight); close(c.depth, s.innerDepth);
    for (const displacement of [0, 4]) {
      const result = compare(c, chamber(defaults), displacement);
      assert.ok(result.currentLitres > 0); assert.ok(Number.isFinite(result.tuningRatio));
      assert.ok(result.modes.every(m => m.currentHz >= 350 && m.currentHz <= 2000));
    }
  }
  const base = chamber(defaults);
  assert.deepEqual(chamber({ ...defaults, handle: true, flatFeet: true, grilleGap: 25, dotDiameter: 6 }), base);
});

test("air displacement persists without changing fabrication geometry, and legacy designs use gross volume", () => {
  const s = createSpeaker({ ...defaults, acousticDisplacementLitres: 1.4 });
  assert.deepEqual(s.parts, createSpeaker(defaults).parts);
  const exported = speakerExport(s);
  assert.deepEqual(parseProject(JSON.stringify(exported)).designs.speaker, s.config);
  close(exported.acoustics.currentLitres, 5.94 - 1.4);
  assert.match(exported.acoustics.model, /not a frequency response/);
  delete exported.configuration.acousticDisplacementLitres;
  assert.equal(parseProject(JSON.stringify(exported)).designs.speaker.acousticDisplacementLitres, 0);
  assert.equal(createSpeaker({ ...defaults, acousticDisplacementLitres: 100 }).config.acousticDisplacementLitres, 4);
  assert.throws(() => parseProject(JSON.stringify({ ...exported, configuration: { ...defaults, acousticDisplacementLitres: "1.4" } })));
});

test("live chart updates, pins a reference, resets it and accepts displacement input", async () => {
  const dom = new JSDOM('<div id="root"></div>'), previous = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const require = createRequire(import.meta.url), React = require("react"), { createRoot } = require("react-dom/client");
  const mod = { exports: {} }, file = new URL("../components/speaker-acoustics.tsx", import.meta.url);
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new vm.Script(`(function(require,module,exports){${code}\n})`).runInThisContext()(name => name === "@/lib/speaker" ? speakerModule : name === "@/lib/speaker-acoustics" ? acoustics : require(name), mod, mod.exports);
  const { SpeakerAcoustics } = mod.exports, container = document.getElementById("root"), root = createRoot(container);
  let config = { ...defaults }, received;
  const render = () => React.act(async () => root.render(React.createElement(SpeakerAcoustics, { config, onChange: patch => { received = patch; } })));
  const click = text => React.act(async () => [...container.querySelectorAll("button")].find(b => b.textContent === text).click());
  try {
    await render();
    assert.match(container.textContent, /Same volume as reference/);
    const first = container.querySelector(".acoustic-current-point").getAttribute("cx");
    config = { ...config, depth: 180 }; await render();
    assert.notEqual(container.querySelector(".acoustic-current-point").getAttribute("cx"), first);
    assert.match(container.textContent, /More air volume/);
    await click("Use current as reference");
    assert.match(container.textContent, /Same volume as reference/);
    config = { ...config, depth: 120 }; await render();
    assert.match(container.textContent, /Less air volume/);
    await click("Use default");
    assert.match(container.textContent, /Same volume as reference/);
    const range = container.querySelector('input[type="range"]');
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(range, "1.25");
      range.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.deepEqual(received, { acousticDisplacementLitres: 1.25 });
    config = { ...config, ...received }; await render();
    assert.match(container.textContent, /4.69 L/);
    assert.match(container.querySelector("svg desc").textContent, /does not predict sound level/);
    assert.doesNotMatch(container.querySelector("svg").outerHTML, /NaN|Infinity/);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});
