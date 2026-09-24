import { createSynthStand, type StandConfiguration } from "./synth-stand";

self.onmessage = (event: MessageEvent<StandConfiguration>) => {
  try { self.postMessage({ stand: createSynthStand(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Unable to fit this model." }); }
};
