#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
snapshot="$(mktemp "${TMPDIR:-/tmp}/fourletter-jmdict-XXXXXXXX.gz")"
trap 'rm -f "$snapshot"' EXIT

curl --fail --location --retry 2 --silent --show-error \
  'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz' --output "$snapshot"
python3 "$repo_dir/scripts/build_catalog.py" "$snapshot"

echo 'Review public/catalog.json and public/catalog-meta.json, then publish the site.'
