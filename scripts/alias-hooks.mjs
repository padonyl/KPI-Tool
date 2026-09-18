// Resolver pro alias "@/..." → "src/...", aby šlo logiku appky testovat
// přímo v Node (node --experimental-strip-types --import ./scripts/alias.mjs).
// Bez toho se dá importovat jen modul bez závislostí (parse-values.ts).
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const korenProjektu = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const zaklad = path.join(korenProjektu, "src", specifier.slice(2));
    let cesta = zaklad;
    if (!fs.existsSync(cesta)) {
      for (const pripona of [".ts", ".tsx", ".mjs", ".js", "/index.ts"]) {
        if (fs.existsSync(zaklad + pripona)) {
          cesta = zaklad + pripona;
          break;
        }
      }
    }
    return next(pathToFileURL(cesta).href, context);
  }
  return next(specifier, context);
}
