import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";

test("preview throttling leaves inputs live, samples sustained edits, flushes releases and cancels obsolete work", async t => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = new Map();
  for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  const require=createRequire(import.meta.url),React=require("react"),{createRoot}=require("react-dom/client");
  const code=ts.transpileModule(readFileSync(new URL("../components/use-preview-input.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new vm.Script(`(function(require,module,exports){${code}\n})`).runInThisContext()(require,mod,mod.exports);
  const {usePreviewInput}=mod.exports;
  const renders=[];let edit,flush;
  const Preview=React.memo(function Preview({value}) { renders.push(value);return React.createElement("output",null,value); });
  function Editor() {
    const [input,setInput]=React.useState(0);edit=setInput;
    const preview=usePreviewInput(input);flush=preview.flush;
    return React.createElement(React.Fragment,null,React.createElement("input",{value:input,readOnly:true}),React.createElement(Preview,{value:preview.value}));
  }
  const root=createRoot(document.getElementById("root"));
  const tick=async ms=>React.act(async()=>t.mock.timers.tick(ms));
  const change=async value=>React.act(async()=>edit(value));
  try {
    t.mock.timers.enable({apis:["setTimeout"]});
    await React.act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Editor))));
    const initial=renders.length;
    for(let value=1;value<=20;value++)await change(value);
    assert.equal(document.querySelector("input").value,"20");
    assert.equal(renders.length,initial,"No preview work during immediate input updates");
    await tick(99);assert.equal(document.querySelector("output").textContent,"0");
    await tick(1);assert.equal(document.querySelector("output").textContent,"20");
    await change(21);await tick(60);await change(22);await tick(40);
    assert.equal(document.querySelector("output").textContent,"22","Continuous edits do not postpone the deadline");
    await change(23);await tick(100);
    assert.equal(document.querySelector("output").textContent,"23","Trailing update includes final value");
    await change(24);
    await React.act(async()=>window.dispatchEvent(new dom.window.Event("pointerup")));
    assert.equal(document.querySelector("output").textContent,"24","Release flushes immediately");
    await change(25);await React.act(async()=>flush());
    assert.equal(document.querySelector("output").textContent,"25","Explicit flush supports fabrication");
    await change(26);await change(25);const count=renders.length;await tick(100);
    assert.equal(renders.length,count,"Undo back to published input cancels pending work");
    await change(99);await change(7);await tick(100);
    assert.equal(document.querySelector("output").textContent,"7","A restored design supersedes a queued edit");
    await change(8);await React.act(async()=>root.unmount());await tick(100);
    assert.equal(document.getElementById("root").childNodes.length,0);
  } finally {
    t.mock.timers.reset();dom.window.close();
    for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
});
