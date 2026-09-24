import { builtinFonts, importFont, type CutoutFont } from "./cutout-sources";

export type FontAsset = { id: string; name: string; data: string };
export type FontOption = { id: string; name: string; font?: CutoutFont };
const listeners = new Set<() => void>();
let assets: FontAsset[] = [];
let options: FontOption[] = [...builtinFonts];
const initialOptions: FontOption[] = [...builtinFonts];
export const subscribeFonts = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getFonts = () => options;
export const getServerFonts = () => initialOptions;
export const getFontAssets = () => assets;
function encode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export async function prepareFonts(records: FontAsset[]) {
  return Promise.all(records.map(async record => {
    const binary = atob(record.data), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const font = await importFont(bytes.buffer, record.name);
    return { id: record.id, name: record.name, font };
  }));
}
export function replaceFonts(records: FontAsset[], prepared: FontOption[]) {
  assets = records;
  options = [...builtinFonts, ...prepared];
  listeners.forEach(listener => listener());
}
export async function addProjectFont(file: File) {
  if (file.size > 5_000_000) throw new Error("Choose a font smaller than 5 MB.");
  if (assets.length >= 10) throw new Error("This project already has 10 imported fonts.");
  const buffer = await file.arrayBuffer(), name = file.name.replace(/\.(ttf|otf)$/i, "");
  const font = await importFont(buffer, name), id = crypto.randomUUID();
  assets = [...assets, { id, name, data: encode(buffer) }];
  options = [...options, { id, name, font }];
  listeners.forEach(listener => listener());
  return id;
}
