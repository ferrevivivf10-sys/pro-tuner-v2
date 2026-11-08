/**
 * version.js - Versao automatica do app a partir do git
 * Cada commit (fora merges e commits do changelog) = +1 na versao.
 * Ex.: 40 commits -> versao "1.0.40", versionCode 40.
 */
const { execSync } = require("child_process");

const BASE = "1.0";
const CHANGELOG_PREFIX = "docs: changelog";

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// Commits que contam como versao (mais antigo primeiro)
function getVersionCommits() {
  const out = git('log --no-merges --reverse --format=%h%x09%ad%x09%s --date=short');
  if (!out) return [];
  return out
    .split("\n")
    .map((line) => {
      const [sha, date, ...rest] = line.split("\t");
      return { sha, date, subject: rest.join("\t") };
    })
    .filter((c) => !c.subject.startsWith(CHANGELOG_PREFIX));
}

function getVersion() {
  const count = getVersionCommits().length;
  const commit = git("rev-parse --short HEAD") || "dev";
  if (count === 0) return { name: `${BASE}.0`, code: 1, commit };
  return { name: `${BASE}.${count}`, code: count, commit };
}

module.exports = { BASE, CHANGELOG_PREFIX, getVersion, getVersionCommits };

// node scripts/version.js -> imprime a versao (usado no CI)
if (require.main === module) {
  console.log(getVersion().name);
}
