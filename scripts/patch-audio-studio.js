/**
 * Adapta o codigo Android da @siteed/audio-studio 4.0 beta ao Expo SDK 54.
 *
 * A 4.0 foi compilada contra o Expo SDK 57, onde Promise.reject recebe
 * `code: String?`. No SDK 54 (expo-modules-core 3.x) a assinatura e
 * `code: String`, entao os `override fun reject(code: String?, ...)` da lib
 * nao compilam ("overrides nothing"). Trocar para `String` resolve: o codigo
 * dentro continua aceitando o valor.
 *
 * Roda automaticamente apos "npm install" (ver package.json -> postinstall).
 * Quando o app for para o SDK 57, este patch deixa de ser necessario.
 */
const fs = require("fs");
const path = require("path");

const libDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "@siteed",
  "audio-studio",
);
const srcDir = path.join(libDir, "android", "src");
const TAG = "[patch-audio-studio]";

if (!fs.existsSync(srcDir)) {
  console.warn(TAG, "pasta nao encontrada, pulando:", srcDir);
  process.exit(0);
}

const version = require(path.join(libDir, "package.json")).version;
if (!version.startsWith("4.")) {
  console.log(TAG, "versao", version, "nao precisa do patch");
  process.exit(0);
}

const FROM =
  "override fun reject(code: String?, message: String?, cause: Throwable?)";
const TO =
  "override fun reject(code: String, message: String?, cause: Throwable?)";

function kotlinFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return kotlinFiles(p);
    return e.name.endsWith(".kt") ? [p] : [];
  });
}

let total = 0;
for (const file of kotlinFiles(srcDir)) {
  const content = fs.readFileSync(file, "utf8");
  const count = content.split(FROM).length - 1;
  if (count === 0) continue;
  fs.writeFileSync(file, content.split(FROM).join(TO));
  total += count;
}

console.log(TAG, `patch aplicado (${total} assinaturas) na versao ${version}`);
