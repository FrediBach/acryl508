import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";

test("mode switching preserves independent designs and routes material choices and exports", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
  const previous = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const require = createRequire(import.meta.url), React = require("react"), { createRoot } = require("react-dom/client");
  const project = fileURLToPath(new URL("../", import.meta.url)), cache = new Map();
  // Test real controls and shell with only the WebGL renderers stubbed.
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    if (file.endsWith("/preview-stage.tsx")) return { PreviewStage: () => React.createElement("div", null, "Case preview") };
    if (file.endsWith("/stand-preview.tsx")) return { StandPreview: () => React.createElement("div", null, "Stand preview") };
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const localRequire = specifier => {
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return require(specifier);
      const base = specifier.startsWith("@/") ? path.join(project, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
      return /\.tsx?$/.test(resolved) ? load(resolved) : require(resolved);
    };
    new vm.Script(`(function(require, module, exports) {${code}\n})`, { filename: file }).runInThisContext()(localRequire, mod, mod.exports);
    return mod.exports;
  }
  const downloads = [], blobs = new Map(), originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = blob => { const url = `blob:test-${blobs.size}`; blobs.set(url, blob); return url; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download, blob: blobs.get(this.href) }); };
  const root = createRoot(document.getElementById("root"));
  const button = label => {
    const match = [...document.querySelectorAll("button")].find(element => element.getAttribute("aria-label") === label || element.textContent.trim() === label);
    assert.ok(match, `button ${label} exists`); return match;
  };
  const click = async label => React.act(async () => { button(label).click(); });
  try {
    const { ConfiguratorShell } = load(path.join(project, "components/configurator-shell.tsx"));
    await React.act(async () => { root.render(React.createElement(ConfiguratorShell)); });
    assert.equal(button("Case designer").getAttribute("aria-pressed"), "true");
    await click("104");
    await click("Synth stand");
    assert.equal(button("Synth stand").getAttribute("aria-pressed"), "true");
    assert.ok(document.querySelector('[aria-label="Synth stand controls"]'));
    assert.equal(button("Cable holes in braces").getAttribute("aria-checked"), "false");
    await click("Cable holes in braces");
    assert.equal(button("Cable holes in braces").getAttribute("aria-checked"), "true");
    assert.ok(document.querySelector('input[aria-label="Cable hole diameter in mm"]'));
    await click("35°");
    await click("Material library"); await click("Cobalt");
    await click("Export JSON");
    const stand = JSON.parse(await downloads.at(-1).blob.text());
    assert.equal(stand.mode, "synth-stand"); assert.equal(stand.configuration.angle, 35); assert.equal(stand.configuration.tint.id, "blue");
    assert.equal(stand.configuration.cableHoles, true);
    assert.equal(stand.cableManagement.totalCount, (stand.construction.ribCount - 1) * 3);
    await click("Cutting layout");
    assert.equal(document.querySelector('svg[aria-label^="Cutting layout:"]').querySelectorAll("path").length, stand.construction.totalParts);
    const bracePath = [...document.querySelectorAll('svg[aria-label^="Cutting layout:"] g')].find(group => group.textContent.includes("Front cross brace")).querySelector("path");
    assert.equal((bracePath.getAttribute("d").match(/\bM/g) ?? []).length, stand.cableManagement.countPerBrace + 1);
    await click("Export stand sheets as SVG");
    assert.match(downloads.at(-1).name, /stand.*sheets\.svg$/);
    assert.match(await downloads.at(-1).blob.text(), /35 degrees/);
    await click("Case designer");
    assert.equal(button("104").getAttribute("aria-pressed"), "true");
    await click("Export JSON");
    const caseData = JSON.parse(await downloads.at(-1).blob.text());
    assert.equal(caseData.configuration.hp, 104); assert.equal(caseData.configuration.tint.id, "orange");
    await click("Synth stand");
    assert.equal(button("35°").getAttribute("aria-pressed"), "true");
    assert.equal(button("Cable holes in braces").getAttribute("aria-checked"), "true");
    await click("Cable holes in braces");
    assert.equal(document.querySelector('input[aria-label="Cable hole diameter in mm"]'), null);
    await click("Build notes");
    assert.match(document.querySelector("dialog").textContent, /Slot together\. Play at your angle/);
    assert.match(document.querySelector("dialog").textContent, /no load capacity or stability rating/);
  } finally {
    await React.act(async () => root.unmount());
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    dom.window.close();
  }
});
