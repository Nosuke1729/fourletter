#!/usr/bin/env python3
"""Export the same four-hiragana membership set used by the app for Firebase.
Import this file at /catalog, never at the database root.
"""
import argparse
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='/private/tmp/fourletter-firebase-catalog.json')
args = parser.parse_args()
words = {row[0] for row in json.loads((root / 'public/catalog.json').read_text())}
examples = re.findall(r"word: '([^']+)'", (root / 'src/data.ts').read_text())
assert len(examples) == 11, 'Check starterWords format before exporting.'
words.update(examples)
assert all(re.fullmatch('[ぁ-ゖ]{4}', word) for word in words)
output = Path(args.output)
output.write_text(json.dumps({word: True for word in sorted(words)}, ensure_ascii=False, separators=(',', ':')))
print(f'{len(words):,} words -> {output}')
