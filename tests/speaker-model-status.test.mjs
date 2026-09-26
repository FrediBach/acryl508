import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";

test("speaker loading and errors survive StrictMode, suspension and rapid preview teardown", async () => {
  const dom = new JSDOM('<div id="page"></div><div id="scene"></div>');
  const previous = new Map();
  for (const [key,value] of Object.entries({ window:dom.window, document:dom.window.document, IS_REACT_ACT_ENVIRONMENT:true })) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  const require=createRequire(import.meta.url), React=require("react"), {createRoot}=require("react-dom/client");
  const file=new URL("../components/speaker-model-status.tsx",import.meta.url);
  const code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new vm.Script(`(function(require,module,exports){${code}\n})`).runInThisContext()(require,mod,mod.exports);
  const {SpeakerModelBoundary,ModelStatusReporter,SpeakerModelMessage}=mod.exports;
  const h=React.createElement, errors=[], warnings=[], originalError=console.error;
  console.error=(...args)=>warnings.push(args.map(String).join(" "));
  const options={onUncaughtError:error=>errors.push(error),onCaughtError:()=>{}};
  const page=createRoot(document.getElementById("page"),options), scene=createRoot(document.getElementById("scene"),options);
  let changeStatus;
  function Page() {
    const [status,setStatus]=React.useState(null);changeStatus=setStatus;
    return h("section",null,h("div",{"data-canvas":true}),h(SpeakerModelMessage,{status}));
  }
  const strict=child=>h(React.StrictMode,null,child);
  const status=()=>document.querySelector('[role="status"]')?.textContent;
  try {
    await React.act(async()=>page.render(strict(h(Page))));
    for(let i=0;i<8;i++) {
      let resolve,ready=false;
      const promise=new Promise(done=>{resolve=()=>{ready=true;done();};});
      function Asset(){if(!ready)throw promise;return null;}
      const tree=h(SpeakerModelBoundary,{onStatusChange:changeStatus},h(React.Suspense,{fallback:h(ModelStatusReporter,{status:"loading",onStatusChange:changeStatus})},h(ModelStatusReporter,{status:"ready",onStatusChange:changeStatus},h(Asset))));
      await React.act(async()=>scene.render(strict(tree)));
      assert.match(status(),/Loading MYND hardware/);
      assert.equal(document.getElementById("scene").childNodes.length,0,"Scene status creates no DOM roots or nodes");
      if(i%2===0) {
        await React.act(async()=>resolve());
        assert.equal(status(),undefined,"Loading message disappears after asset resolution");
      }
      await React.act(async()=>{scene.render(null);page.render(null);});
      await React.act(async()=>resolve());
      assert.equal(document.getElementById("page").childNodes.length,0,"Late completion does not restore an unmounted preview");
      await React.act(async()=>page.render(strict(h(Page))));
    }
    function Broken(){throw new Error("Model unavailable");}
    await React.act(async()=>scene.render(strict(h(SpeakerModelBoundary,{onStatusChange:changeStatus},h(Broken)))));
    assert.match(status(),/could not load/);
    assert.equal(document.getElementById("scene").childNodes.length,0);
    await React.act(async()=>{scene.unmount();page.unmount();});
    assert.deepEqual(errors,[]);
    assert.deepEqual(warnings,[],"No nested-root cleanup or unmounted-state warnings");
  } finally {
    console.error=originalError;
    dom.window.close();
    for(const [key,descriptor] of previous) if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
});
