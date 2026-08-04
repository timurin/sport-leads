"""One-shot: adapt product-model export CSV for this local DB."""
from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

SRC = Path(__file__).with_name("product-model-export (2).csv")
DST = Path(__file__).with_name("product-model-import-local.csv")

GRID_ALIASES = {
    "Женский (Mosmade)": "Женская (Mosmade)",
    "Женский (Mosmade) (Mosmade)": "Женская (Mosmade)",
}
TYPE_ALIASES = {
    "Бафф": "Аксессуары",
    "Рюкзак": "Аксессуары",
}


def main() -> None:
    rows = list(
        csv.DictReader(
            SRC.read_text(encoding="utf-8-sig").splitlines(),
            delimiter=";",
        )
    )
    dups = [a for a, c in Counter(r["article"].strip() for r in rows).items() if c > 1]
    print("duplicate articles:", dups)

    fieldnames = list(rows[0].keys())
    out: list[dict[str, str]] = []
    for r in rows:
        nr = dict(r)
        nr["id"] = ""
        nr["assembly_variant_ids"] = ""
        g = (nr.get("size_grid_name") or "").strip()
        nr["size_grid_name"] = GRID_ALIASES.get(g, g)
        t = (nr.get("product_type_name") or "").strip()
        # Export often leaves name empty; prefer original type / description.
        if not (nr.get("name") or "").strip():
            nr["name"] = (
                t
                or (nr.get("description") or "").strip()
                or (nr.get("article") or "").strip()
            )
        nr["product_type_name"] = TYPE_ALIASES.get(t, t)
        # Keep local photo_paths from export; drop API photo_urls (foreign model ids).
        nr["photo_urls"] = ""
        nr["created_at"] = ""
        nr["updated_at"] = ""
        out.append(nr)

    seen: dict[str, int] = {}
    for nr in out:
        a = nr["article"].strip()
        if a not in seen:
            seen[a] = 1
            continue
        seen[a] += 1
        nr["article"] = f"{a}-dup{seen[a]}"
        print("renamed dup", a, "->", nr["article"])

    with DST.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=fieldnames, delimiter=";", lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(out)

    print("wrote", DST, "rows", len(out))
    print("grids", sorted({r["size_grid_name"] for r in out}))
    print("types", sorted({r["product_type_name"] for r in out}))


if __name__ == "__main__":
    main()
