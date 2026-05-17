#!/usr/bin/env python3
"""
Generic semantic-collision fixer for USCIS forms.

Reads each colliding field's /TU (tooltip/UserName) from the source PDF and
generates a unique semantic key. Updates:
  - overlay-maps/raw/<form>.raw.json
  - overlay-maps/normalized/<form>.json
  - questionnaires/<form>.questionnaire.json
  - payload-schemas/<form>.schema.json

Skips table/list fields (count >= 10 with sequential indices) where each
instance is a row+col coordinate, not a distinct question — those need
separate row-aware handling.

Usage: python3 scripts/fix-semantic-collisions-from-tu.py <form-name>
"""
import json
import os
import re
import sys
from collections import defaultdict
from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Tables we deliberately defer; row/col coords matter, /TU is often empty
# or generic for these (Pt7Line1B* on i-693 medical history etc.).
DEFER_TABLES = {
    # form: {(page, key)}
    # i-589 page 4 tables handled by scripts/fix-i589-page4-tables.py
    # i-589 page 10/11 small groups handled by /TU directly (no defer needed)
    "i-589": set(),
    "i-687": set(),
}

TABLE_COUNT_THRESHOLD = 10  # >= this many of the same key on one page = treat as table

KEY_SAFE = re.compile(r"[^A-Za-z0-9]+")


ROMAN = {"1": "I", "2": "II", "3": "III", "4": "IV", "5": "V"}


def slugify_short(text: str, max_len: int = 28) -> str:
    """Short, key-safe slug. Strips noise phrases."""
    if not text:
        return ""
    s = text.strip()
    s = re.sub(r"Enter as 2[- ]digit Month.*", "", s, flags=re.I)
    s = re.sub(r"\(if any\)", "", s, flags=re.I)
    s = re.sub(r"\(most recent\)", "", s, flags=re.I)
    s = re.sub(r"\(Citizenship\)", "", s, flags=re.I)
    s = re.sub(r"if applicable\.?", "", s, flags=re.I)
    s = re.sub(r",?\s*if any\b", "", s, flags=re.I)
    # Drop leading verbs that are noise in the descriptor
    s = re.sub(r"^(Enter|Complete|Select|List|Check|Are)\s+", "", s, flags=re.I)
    s = re.sub(r"\s+", " ", s).strip(" .,")
    s = KEY_SAFE.sub("_", s).strip("_")
    s = re.sub(r"_+", "_", s)
    if len(s) > max_len:
        s = s[:max_len].rstrip("_")
    return s


def make_key(tu: str, page: int, key: str, oidx: int) -> str:
    """
    Build a unique semantic key from /TU.

    Strategy:
      1. Identify Part (letter + roman) + Item number.
      2. Extract descriptor — prefer last 'Enter X' / 'Select X' clause; otherwise
         use the last sentence.
      3. Combine: <Part><Item>_<descriptor>.
    """
    s = (tu or "").strip()
    if not s:
        return f"P{page}_{key}_{oidx}"

    # Normalize abbreviations BEFORE running any sentence-boundary regex,
    # otherwise patterns like "U. S. Social Security" get sliced at the first period.
    s = s.replace("U. S.", "US").replace("U.S.", "US")
    s = s.replace("U S C I S", "USCIS").replace("I D", "ID")
    s = re.sub(r"\bI\. ?D\.", "ID", s)

    # Part letter + sub-roman.  /TU writes "Part. A. 1." for Part A.I.
    part_id = ""
    pm = re.match(r"Part\.\s*([A-Z])(?:\.\s*(\d+))?", s)
    if pm:
        letter = pm.group(1)
        sub = pm.group(2)
        part_id = f"Pt{letter}" + ROMAN.get(sub or "", "")

    # Item number — first number after the part header, before Enter/Select/etc.
    item_num = ""
    rest = s[pm.end():] if pm else s
    im = re.search(r"\b(\d+)\.\s+(?:Enter|Complete|What|List|Check|Are|Select|Is|Marital|Sex|Date|Race|Religion|Other)", rest)
    if im:
        item_num = im.group(1)

    # Sub-context: Entry N / Child N / Spouse (helps disambiguate repeated table rows)
    sub_ctx = ""
    em = re.search(r"\b(Entry|Child|Spouse)\s*(\d+)?", s, re.I)
    if em:
        word = em.group(1).capitalize()
        num = em.group(2) or ""
        sub_ctx = f"{word}{num}"

    # Descriptor — last actionable clause.
    desc = ""
    sel = re.search(r"Select\s+([^.]+?)\.?\s*$", s)
    if sel:
        desc = sel.group(1).strip()
    else:
        ent = list(re.finditer(r"Enter\s+([^.]+?)(?=\.\s|$)", s))
        if ent:
            desc = ent[-1].group(1).strip()
        else:
            # Fallback: last sentence
            sentences = [p.strip() for p in s.split(".") if p.strip() and not re.match(r"^\d+$", p.strip())]
            desc = sentences[-1] if sentences else s

    # Strip the part prefix that sometimes leaks into desc
    desc = re.sub(r"^Information About (You|Your Spouse and Children|Your Background)\.?\s*", "", desc, flags=re.I)
    desc_slug = slugify_short(desc, max_len=28)

    bits = [b for b in [part_id, f"Item{item_num}" if item_num else "", sub_ctx, desc_slug] if b]
    if bits:
        return "_".join(bits)
    return f"P{page}_{key}_{oidx}"


def original_key_index(original_key: str):
    m = re.search(r"\[(\d+)\]$", original_key or "")
    return int(m.group(1)) if m else None


def load_pdf_tus(pdf_path: str) -> dict:
    """Return {originalKey: /TU label}."""
    reader = PdfReader(pdf_path)
    fields = reader.get_fields() or {}
    return {name: (f.get("/TU") or "") for name, f in fields.items()}


def find_collisions(raw_map, defer, tus):
    """
    Returns {(page, key): [field, ...]} for fields with collisions to fix.

    Skip rules (true table, needs coord-based handling):
      - in DEFER_TABLES set, OR
      - count >= TABLE_COUNT_THRESHOLD AND all /TU strings are identical
        (i.e. PDF provides only a group-level tooltip, no per-cell distinction)
    """
    groups = defaultdict(list)
    for f in raw_map.get("fields", []):
        groups[(f.get("page"), f.get("key"))].append(f)
    collisions = {}
    for (page, key), items in groups.items():
        if len(items) < 2:
            continue
        if (page, key) in defer:
            continue
        if len(items) >= TABLE_COUNT_THRESHOLD:
            unique_tus = {tus.get(f.get("originalKey", ""), "") for f in items}
            if len(unique_tus) <= 1:
                # All cells share the same tooltip — a uniform table, defer.
                continue
        collisions[(page, key)] = items
    return collisions


def apply_renames(map_path: str, renames: dict) -> int:
    """renames: {(page, key, oidx): newKey}. Returns number renamed."""
    if not os.path.exists(map_path):
        return 0
    with open(map_path) as fh:
        data = json.load(fh)
    n = 0
    for f in data.get("fields", []):
        oidx = original_key_index(f.get("originalKey", ""))
        rule = renames.get((f.get("page"), f.get("key"), oidx))
        if rule:
            f["key"] = rule
            n += 1
    with open(map_path, "w") as fh:
        json.dump(data, fh, indent=2)
    return n


def update_questionnaire(q_path: str, old_keys_to_remove: set, additions: list) -> tuple[int, int]:
    """
    additions: [{'page': N, 'key': str, 'label': str}, ...]
    Returns (removed, added).
    """
    if not os.path.exists(q_path):
        return 0, 0
    with open(q_path) as fh:
        q = json.load(fh)

    existing = set()
    for p in q.get("pages", []):
        for f in p.get("fields", []) or []:
            existing.add(f.get("key"))

    removed = 0
    for page in q.get("pages", []):
        before = len(page.get("fields", []) or [])
        page["fields"] = [f for f in (page.get("fields") or []) if f.get("key") not in old_keys_to_remove]
        removed += before - len(page["fields"])

    added = 0
    for a in additions:
        if a["key"] in existing:
            continue
        target = next((p for p in q["pages"] if p.get("page") == a["page"]), None)
        if not target:
            continue
        target.setdefault("fields", []).append({
            "key": a["key"],
            "label": a["label"],
            "mode": "text",
            "type": "text",
            "defaultValue": "",
        })
        existing.add(a["key"])
        added += 1

    with open(q_path, "w") as fh:
        json.dump(q, fh, indent=2)
    return removed, added


def update_schema(s_path: str, old_keys_to_remove: set, additions: list) -> tuple[int, int]:
    if not os.path.exists(s_path):
        return 0, 0
    with open(s_path) as fh:
        s = json.load(fh)
    pages = s.get("pages", {})
    removed = 0
    for k in list(pages.keys()):
        before = len(pages[k])
        pages[k] = [f for f in pages[k] if f.get("key") not in old_keys_to_remove]
        removed += before - len(pages[k])
    added = 0
    for a in additions:
        ps = str(a["page"])
        if ps not in pages:
            pages[ps] = []
        if not any(f.get("key") == a["key"] for f in pages[ps]):
            pages[ps].append({"key": a["key"], "mode": "text", "kind": "text", "defaultValue": ""})
            added += 1
    s["pages"] = pages
    with open(s_path, "w") as fh:
        json.dump(s, fh, indent=2)
    return removed, added


def main():
    if len(sys.argv) < 2:
        print("Usage: fix-semantic-collisions-from-tu.py <form-name>")
        sys.exit(1)
    form = sys.argv[1]

    pdf_path = os.path.join(ROOT, "USCIS forms decrypted", f"{form}.pdf")
    raw_path = os.path.join(ROOT, "overlay-maps", "raw", f"{form}.raw.json")
    norm_path = os.path.join(ROOT, "overlay-maps", "normalized", f"{form}.json")
    q_path = os.path.join(ROOT, "questionnaires", f"{form}.questionnaire.json")
    s_path = os.path.join(ROOT, "payload-schemas", f"{form}.schema.json")

    if not os.path.exists(pdf_path):
        print(f"PDF not found: {pdf_path}")
        sys.exit(1)
    if not os.path.exists(raw_path):
        print(f"Raw map not found: {raw_path}")
        sys.exit(1)

    print(f"Reading {pdf_path} ...")
    tus = load_pdf_tus(pdf_path)
    print(f"Loaded {len(tus)} field tooltips")

    with open(raw_path) as fh:
        raw = json.load(fh)

    defer = DEFER_TABLES.get(form, set())
    collisions = find_collisions(raw, defer, tus)
    print(f"Found {len(collisions)} collision groups to fix (deferred {len(defer)} tables)")

    # Build (page, key, oidx) → newKey
    renames = {}
    additions = []
    old_keys = set()
    used_keys = set()

    # First, capture every key already in the raw map so we don't collide.
    for f in raw.get("fields", []):
        used_keys.add(f.get("key"))

    for (page, key), items in sorted(collisions.items()):
        old_keys.add(key)
        for f in items:
            oidx = original_key_index(f.get("originalKey", ""))
            tu = tus.get(f.get("originalKey", ""), "")
            new_key = make_key(tu, page, key, oidx if oidx is not None else 0)
            # Ensure uniqueness
            base = new_key
            n = 2
            while new_key in used_keys:
                new_key = f"{base}_{n}"
                n += 1
            used_keys.add(new_key)
            renames[(page, key, oidx)] = new_key
            label = tu.strip() if tu else new_key
            # Trim label
            if len(label) > 150:
                label = label[:147] + "..."
            additions.append({"page": page, "key": new_key, "label": label})
            print(f"  p{page} {key}[{oidx}] -> {new_key}")
            print(f"       TU: {tu[:90]}")

    if not renames:
        print("Nothing to rename.")
        return

    print()
    print("Applying renames...")
    n_raw = apply_renames(raw_path, renames)
    n_norm = apply_renames(norm_path, renames)
    q_rem, q_add = update_questionnaire(q_path, old_keys, additions)
    s_rem, s_add = update_schema(s_path, old_keys, additions)
    print(f"  raw map:        renamed {n_raw}")
    print(f"  normalized map: renamed {n_norm}")
    print(f"  questionnaire:  removed {q_rem}, added {q_add}")
    print(f"  schema:         removed {s_rem}, added {s_add}")


if __name__ == "__main__":
    main()
