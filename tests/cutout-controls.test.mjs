import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { loadTypescript } from "./load-typescript.mjs";

const cutouts = await loadTypescript("../lib/custom-cutouts.ts");
const sources = await loadTypescript("../lib/cutout-sources.ts");
const { createSpeaker, defaultSpeakerConfiguration } = await loadTypescript("../lib/speaker.ts");

test("shared cutout controls add, duplicate, centre and remove artwork on a rear-only panel", async () => {
  const dom = new JSDOM('<div id="root"></div>'), previous = new Map();
  for (const [key,value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, DOMParser: dom.window.DOMParser, XMLSerializer: dom.window.XMLSerializer, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  const require = createRequire(import.meta.url), React = require("react"), { createRoot } = require("react-dom/client");
  const code = ts.transpileModule(readFileSync(new URL("../components/cutout-controls.tsx",import.meta.url),"utf8"), {
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText;
  const mod = {exports:{}};
  new vm.Script(`(function(require,module,exports){${code}\n})`).runInThisContext()(name => {
    if (name === "@/lib/custom-cutouts") return cutouts;
    if (name === "@/lib/cutout-sources") return sources;
    if (name === "./use-project-fonts") return {useProjectFonts:()=>[]};
    if (name === "@/lib/project-fonts") return {addProjectFont:async()=>{throw new Error("Not used");}};
    return require(name);
  },mod,mod.exports);
  const container=document.getElementById("root"), root=createRoot(container);
  let config={...defaultSpeakerConfiguration};
  const render=()=>root.render(React.createElement(mod.exports.CutoutControls, {
    config,panels:createSpeaker(config).cutoutPanels,sides:[{value:"rear",label:"Outer rear panel"}],
    onAction:action=>{
      config={...config,cutouts:action.type==="add"?[...config.cutouts,action.cutout]:action.type==="remove"?config.cutouts.filter(c=>c.id!==action.id):config.cutouts.map(c=>c.id===action.id?{...c,...action.patch}:c)};
      render();
    },
  }));
  try {
    await React.act(async()=>render());
    const input=container.querySelector('input[aria-label="Import SVG cutout"]');
    Object.defineProperty(input,"files",{value:[{name:"mark.svg",size:100,text:async()=>'<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10" /></svg>'}]});
    await React.act(async()=>input.dispatchEvent(new dom.window.Event("change",{bubbles:true})));
    assert.equal(config.cutouts.length,1,container.textContent); assert.equal(config.cutouts[0].side,"rear");
    assert.match(container.textContent,/OUTSIDE VIEW · REAR/);
    assert.equal(container.querySelector("select"),null,"Single-panel editor offers no invalid panel choices");
    assert.ok(container.querySelector(".cutout-material").getAttribute("d"));
    await React.act(async()=>container.querySelector('[aria-label="Duplicate mark"]').click());
    assert.equal(config.cutouts.length,2); assert.equal(config.cutouts[1].side,"rear");
    assert.notEqual(config.cutouts[0].id,config.cutouts[1].id);
    config={...config,cutouts:config.cutouts.map(c=>({...c,x:20,y:10}))};
    await React.act(async()=>render());
    await React.act(async()=>[...container.querySelectorAll("button")].find(b=>b.textContent==="Centre").click());
    assert.equal(config.cutouts[1].x,0); assert.equal(config.cutouts[1].y,0);
    await React.act(async()=>container.querySelector('[aria-label="Remove mark copy"]').click());
    assert.equal(config.cutouts.length,1);
    assert.match(container.textContent,/OUTSIDE VIEW · REAR/);
    await React.act(async()=>container.querySelector('[aria-label="Remove mark"]').click());
    assert.equal(config.cutouts.length,0); assert.equal(container.querySelector(".cutout-editor"),null);
  } finally {
    await React.act(async()=>root.unmount()); dom.window.close();
    for (const [key,descriptor] of previous) if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
});
