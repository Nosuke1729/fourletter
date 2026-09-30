#!/usr/bin/env python3
"""Write import batches for Supabase SQL Editor from public/catalog.json.

Usage: python3 scripts/export_catalog_sql.py [output-directory]
Apply database/schema.sql first, then every numbered SQL file in order.
This script does not connect to Supabase or store credentials.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html"
BATCH_SIZE = 500


def literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    output_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/private/tmp/fourletter-catalog-sql")
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = json.loads((ROOT / "public" / "catalog.json").read_text())
    for batch_index, start in enumerate(range(0, len(rows), BATCH_SIZE), 1):
        batch = rows[start:start + BATCH_SIZE]
        values = []
        for word, label, category, description, _entry_id in batch:
            values.append("  (" + ", ".join(map(literal, (word, label, category, description, SOURCE_URL))) + ")")
        statement = (
            "-- JMdict-derived data; see DICTIONARY-LICENSE.md.\n"
            "begin;\n"
            "insert into public.words (word, label, category, description, source_url) values\n"
            + ",\n".join(values)
            + "\non conflict (word) do update set\n"
            "  label = excluded.label,\n"
            "  category = excluded.category,\n"
            "  description = excluded.description\n"
            "where public.words.source_url = " + literal(SOURCE_URL) + ";\n"
            "commit;\n"
        )
        (output_dir / f"catalog-{batch_index:03d}.sql").write_text(statement)
    print(f"Wrote {len(rows):,} entries in {batch_index} SQL files to {output_dir}")


if __name__ == "__main__":
    main()
