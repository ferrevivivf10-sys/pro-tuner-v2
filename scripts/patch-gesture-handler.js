/**
 * Forca react-native-gesture-handler a usar o source set "nosvg" (sem a
 * integracao de gestos por forma SVG, que este app nao usa). A "common
 * interface" quebra a compilacao Kotlin contra react-native-svg 15.12.1 em
 * RN 0.81 (Unresolved reference SvgView/VirtualView). Roda automaticamente
 * apos "npm install" (ver package.json -> scripts.postinstall).
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-native-gesture-handler",
  "android",
  "build.gradle"
);

if (!fs.existsSync(target)) {
  console.warn("[patch-gesture-handler] arquivo nao encontrado, pulando:", target);
  process.exit(0);
}

const content = fs.readFileSync(target, "utf8");
const marker = "Pro Tuner: forced off by scripts/patch-gesture-handler.js";

if (content.includes(marker)) {
  process.exit(0); // ja aplicado
}

const needle = "def shouldUseCommonInterfaceFromRNSVG() {";
const idx = content.indexOf(needle);
if (idx === -1) {
  console.warn(
    "[patch-gesture-handler] shouldUseCommonInterfaceFromRNSVG() nao encontrada; a lib pode ter mudado, revisar patch manualmente."
  );
  process.exit(0);
}

const closeIdx = content.indexOf("\n}", idx);
if (closeIdx === -1) {
  console.warn("[patch-gesture-handler] nao achei o fim da funcao, pulando.");
  process.exit(0);
}

const replacement =
  needle +
  `\n    // ${marker}. Este app nao usa gestos por forma SVG do RNGH;\n    // a "common interface" quebra a compilacao Kotlin contra\n    // react-native-svg 15.12.1 em RN 0.81 (Unresolved reference\n    // SvgView/VirtualView).\n    return false`;

const patched = content.slice(0, idx) + replacement + content.slice(closeIdx);

fs.writeFileSync(target, patched, "utf8");
console.log("[patch-gesture-handler] patch aplicado em", target);
