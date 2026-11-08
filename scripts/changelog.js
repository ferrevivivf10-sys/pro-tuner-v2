/**
 * changelog.js - Gera o CHANGELOG.md a partir das mensagens de commit
 * Prefixos reconhecidos na mensagem do commit:
 *   adiciona:  -> Adicionado
 *   corrige:   -> Corrigido
 *   melhora:   -> Melhorado
 *   remove:    -> Removido
 *   altera:    -> Alterado (tambem usado quando nao ha prefixo)
 * Uso: node scripts/changelog.js
 */
const fs = require("fs");
const path = require("path");
const { BASE, getVersionCommits } = require("./version");

const CATEGORIES = [
  { label: "Adicionado", prefixes: ["adiciona", "add", "feat"] },
  { label: "Corrigido", prefixes: ["corrige", "fix"] },
  { label: "Melhorado", prefixes: ["melhora", "perf", "refactor"] },
  { label: "Removido", prefixes: ["remove"] },
  { label: "Alterado", prefixes: ["altera", "chore", "ci", "docs", "style"] },
];

function classify(subject) {
  const match = subject.match(/^([a-zA-Z]+)(\([^)]*\))?:\s*(.+)$/);
  if (match) {
    const prefix = match[1].toLowerCase();
    const cat = CATEGORIES.find((c) => c.prefixes.includes(prefix));
    if (cat) return { label: cat.label, text: match[3] };
  }
  return { label: "Alterado", text: subject };
}

const commits = getVersionCommits();
const lines = ["# Changelog — Pro Tuner", "", "Gerado automaticamente a cada build. Mais recente primeiro.", ""];

for (let i = commits.length - 1; i >= 0; i--) {
  const c = commits[i];
  const { label, text } = classify(c.subject);
  lines.push(`## v${BASE}.${i + 1} — ${c.date}`);
  lines.push(`- **${label}:** ${text} (\`${c.sha}\`)`);
  lines.push("");
}

const out = path.join(__dirname, "..", "CHANGELOG.md");
fs.writeFileSync(out, lines.join("\n"));
console.log(`CHANGELOG.md gerado: ${commits.length} versoes`);
