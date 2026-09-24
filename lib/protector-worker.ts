import { createSynthProtector, type ProtectorConfiguration } from "./synth-protector";

self.onmessage = (event: MessageEvent<ProtectorConfiguration>) => {
  try { self.postMessage({ protector: createSynthProtector(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Unable to fit this model." }); }
};
