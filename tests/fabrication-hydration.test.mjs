import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToString } = require("react-dom/server");
const project = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(readFileSync(file, "utf8").replaceAll("import.meta.url", JSON.stringify(pathToFileURL(file).href)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const localRequire = specifier => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return require(specifier);
    const base = specifier.startsWith("@/") ? path.join(project, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
    const resolved = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
    return /\.tsx?$/.test(resolved) ? load(resolved) : require(resolved);
  };
  new vm.Script(`(function(require, module, exports) {${code}\n})`, { filename: file }).runInThisContext()(localRequire, mod, mod.exports);
  return mod.exports;
}

test("fabrication SVG titles survive server rendering and hydrate without replacing the preview", async () => {
  const { FabricationWorkspace } = load(path.join(project, "components/fabrication-workspace.tsx"));
  const { caseFabrication } = load(path.join(project, "lib/fabrication.ts"));
  const { createCasePanels } = load(path.join(project, "lib/case-panels.ts"));
  const { defaultConfiguration } = load(path.join(project, "lib/configurator.ts"));
  const standard = caseFabrication(defaultConfiguration, createCasePanels(defaultConfiguration));
  // A 500 × 800 part fits the default 1000 × 600 sheet only when rotated.
  const rotated = { ...standard, parts: [{ id: "tall", label: "Tall & narrow", material: "Orange", polygons: [[[[0, 0], [500, 0], [500, 800], [0, 800], [0, 0]]]] }] };
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
  const previous = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { hydrateRoot } = require("react-dom/client");
  // Flush dependency-loader deprecations before capturing renderer diagnostics.
  await new Promise(resolve => setImmediate(resolve));
  const container = document.getElementById("root"), diagnostics = [], originalError = console.error;
  console.error = (...args) => diagnostics.push(args.map(String).join(" "));
  let root;
  try {
    for (const [fabrication, title] of [[standard, "Bottom"], [rotated, "Tall & narrow · rotated 90°"]]) {
      const element = React.createElement(FabricationWorkspace, { fabrication, mode: "case", dialogRef: React.createRef() });
      container.innerHTML = renderToString(element);
      const serverSvg = container.querySelector(".stock-sheet svg");
      const serverTitle = serverSvg.querySelector("title").textContent;
      const recoverableErrors = [];
      await React.act(async () => { root = hydrateRoot(container, element, { onRecoverableError: error => recoverableErrors.push(error.message) }); });
      assert.deepEqual(recoverableErrors, [], "Server markup must hydrate without recovery");
      assert.deepEqual(diagnostics, [], "Server rendering and hydration must not warn");
      assert.equal(serverTitle, title);
      assert.equal(container.querySelector(".stock-sheet svg"), serverSvg, "Hydration must reuse the server SVG");
      assert.equal(serverSvg.querySelector("title").textContent, title);
      await React.act(async () => root.unmount()); root = undefined;
    }
  } finally {
    if (root) await React.act(async () => root.unmount());
    console.error = originalError;
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    dom.window.close();
  }
});
