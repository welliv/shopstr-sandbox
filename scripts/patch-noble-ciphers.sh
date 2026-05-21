#!/usr/bin/env bash
# Postinstall: patch @noble/ciphers nested packages that lack bare-extension exports
# Fixes Vite/Rollup commonjs resolver errors like:
#   Missing "./aes" specifier in "@noble/ciphers" package
set -euo pipefail

find node_modules -path "*/@noble/ciphers/package.json" | while read -r f; do
  python3 <<EOF
import json
with open("$f") as fh:
    d = json.load(fh)
exports = d.get("exports", {})
changed = False
for alias in list(exports.keys()):
    if alias.endswith(".js") and alias[:-3] not in exports:
        exports[alias[:-3]] = exports[alias]
        changed = True
if changed:
    d["exports"] = exports
    with open("$f", "w") as fh:
        json.dump(d, fh, indent=2)
EOF
done
