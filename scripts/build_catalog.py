#!/usr/bin/env python3
"""Extract four-hiragana headwords from the official JMdict_e.gz snapshot.

Usage: python3 scripts/build_catalog.py /path/to/JMdict_e.gz
The generated vocabulary is derived from JMdict and is CC BY-SA 4.0.
"""

import gzip
import json
import re
import sys
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET


SOURCE = "https://www.edrdg.org/pub/Nihongo/JMdict_e.gz"
INFO = "https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html"
READING = re.compile(r"[ぁ-ゖ]{4}\Z")
ROOT = Path(__file__).resolve().parents[1]


def category(pos: str) -> str:
    lower = pos.lower()
    if "noun" in lower:
        return "名詞"
    if "verb" in lower:
        return "動詞"
    if "adjective" in lower:
        return "形容詞"
    if "adverb" in lower:
        return "副詞"
    if "expression" in lower:
        return "表現"
    if "interjection" in lower:
        return "感動詞"
    if "prefix" in lower or "suffix" in lower:
        return "接辞"
    return "語句"


def rank(priorities: list[str]) -> int:
    score = 0
    for priority in priorities:
        if priority in {"news1", "ichi1", "spec1"}:
            score += 100
        elif priority in {"news2", "ichi2", "spec2"}:
            score += 50
        elif priority.startswith("nf"):
            try:
                score += 50 - int(priority[2:])
            except ValueError:
                pass
        else:
            score += 10
    return score


def main(source: Path) -> None:
    selected: dict[str, tuple[int, dict]] = {}
    with gzip.open(source, "rb") as stream:
        context = ET.iterparse(stream, events=("start", "end"))
        _, root = next(context)
        for event, entry in context:
            if event != "end" or entry.tag != "entry":
                continue
            entry_id = entry.findtext("ent_seq") or ""
            spellings = entry.findall("k_ele")
            senses = entry.findall("sense")
            english = next(
                (gloss.text or "" for sense in senses for gloss in sense.findall("gloss")
                 if gloss.get("{http://www.w3.org/XML/1998/namespace}lang") in (None, "eng")),
                "",
            )
            pos = next((item.text or "" for sense in senses for item in sense.findall("pos")), "")
            for reading in entry.findall("r_ele"):
                word = reading.findtext("reb") or ""
                if not READING.fullmatch(word):
                    continue
                restrictions = {node.text for node in reading.findall("re_restr")}
                spelling = next(
                    (item for item in spellings if not restrictions or item.findtext("keb") in restrictions),
                    None,
                )
                label = spelling.findtext("keb") if spelling is not None else word
                priorities = [node.text or "" for node in reading.findall("re_pri")]
                if spelling is not None:
                    priorities += [node.text or "" for node in spelling.findall("ke_pri")]
                score = rank(priorities)
                item = {
                    "word": word,
                    "label": label or word,
                    "category": category(pos),
                    "description": english[:160],
                    "entry_id": entry_id,
                }
                previous = selected.get(word)
                if previous is None or score > previous[0]:
                    selected[word] = (score, item)
            root.clear()
    output = sorted((item for _, item in selected.values()), key=lambda item: item["word"])
    compact = [[item["word"], item["label"], item["category"], item["description"], item["entry_id"]] for item in output]
    (ROOT / "public").mkdir(exist_ok=True)
    (ROOT / "public" / "catalog.json").write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")) + "\n")
    (ROOT / "public" / "catalog-meta.json").write_text(json.dumps({
        "source": SOURCE,
        "documentation": INFO,
        "downloaded": date.today().isoformat(),
        "count": len(output),
        "license": "CC BY-SA 4.0",
        "attribution": "Electronic Dictionary Research and Development Group (EDRDG), JMdict",
    }, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {len(output):,} four-hiragana headwords")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]))
