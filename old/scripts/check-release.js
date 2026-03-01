/**
 * Проверка: каждый коммит в main должен иметь повышенную версию в package.json
 * и запись в CHANGELOG.md для этой версии.
 * Выход: 0 — ок, 1 — ошибка (сообщение в stderr).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const pkgPath = path.join(repoRoot, 'package.json');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const v = pkg.version;
  if (!v || typeof v !== 'string') {
    throw new Error('package.json: отсутствует поле version');
  }
  return v;
}

function getPreviousVersion() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', {
      encoding: 'utf8',
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const out = execSync(`git show ${tag}:package.json`, {
      encoding: 'utf8',
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const pkg = JSON.parse(out);
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function semverGreater(a, b) {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}

function changelogHasVersion(changelogText, version) {
  // Строка вида "## [1.2.3]" или "## [1.2.3] — 2026-02-23"
  const pattern = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\](\\s|$|\\s—)`, 'm');
  return pattern.test(changelogText);
}

function main() {
  const current = getCurrentVersion();
  const previous = getPreviousVersion();

  if (!semverGreater(current, previous)) {
    process.stderr.write(
      `check-release: версия в package.json (${current}) должна быть больше предыдущей (${previous}). Обнови version и добавь запись в CHANGELOG.md.\n`
    );
    process.exit(1);
  }

  if (!fs.existsSync(changelogPath)) {
    process.stderr.write('check-release: CHANGELOG.md не найден.\n');
    process.exit(1);
  }

  const changelog = fs.readFileSync(changelogPath, 'utf8');
  if (!changelogHasVersion(changelog, current)) {
    process.stderr.write(
      `check-release: в CHANGELOG.md нет секции для версии ${current}. Добавьте "## [${current}]" (и дату при желании).\n`
    );
    process.exit(1);
  }

  process.exit(0);
}

main();
