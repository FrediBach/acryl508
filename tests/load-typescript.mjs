import { readFile } from "node:fs/promises";
import ts from "typescript";

const cache = new Map();
async function moduleUrl(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  let compiled = ts.transpileModule(await readFile(url, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const imports = [...compiled.matchAll(/(?:from\s*|import\(\s*)["']([^"']+)["']/g)];
  for (const match of imports) {
    const specifier = match[1];
    const resolved = specifier.startsWith(".") ? await moduleUrl(new URL(`${specifier}.ts`, url)) : import.meta.resolve(specifier);
    compiled = compiled.replace(match[0], match[0].replace(specifier, resolved));
  }
  const result = `data:text/javascript;base64,${Buffer.from(`${compiled}\n//# sourceURL=${url.href}`).toString("base64")}`;
  cache.set(url.href, result);
  return result;
}
export async function loadTypescript(relativePath) {
  return import(await moduleUrl(new URL(relativePath, import.meta.url)));
}
