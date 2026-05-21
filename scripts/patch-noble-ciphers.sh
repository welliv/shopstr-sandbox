#!/usr/bin/env bash
# postinstall: add bare-extension exports to nested @noble/ciphers packages
# Vite's commonjs resolver needs 'exports["."]' compat aliases.
set -euo pipefail

find node_modules -path "*/@noble/ciphers/package.json" ! -path "*/node_modules/@noble/ciphers/package.json" | while read -r f; do
  node -e "
const pkg = require('./$f');
const ex = pkg.exports || {};
let changed = false;
for (const k of Object.keys(ex)) {
  if (k.endsWith('.js') && !ex[k.slice(0, -3)]) {
    ex[k.slice(0, -3)] = ex[k];
    changed = true;
  }
}
if (changed) { pkg.exports = ex; require('fs').writeFileSync('$f', JSON.stringify(pkg, null, 2)); }
"
done
