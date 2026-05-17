#!/usr/bin/env python3
"""
Disambiguate i-589 page 4 table cells.

Page 4 (Part A.III. Information About Your Background) has 5 tables sharing
the same PDF field key (TextField13×58, TextField35×6, plus 28 DateTimeFields).
The collapsed-by-normalizer state means one questionnaire answer fills every
cell in the column. Here we assign each cell a unique semantic key based on
its table, row, and column (derived from x/y coordinates).

Column labels are verbatim from the PDF (Part A.III headers).
Row labels for Item 5 (parents/siblings) follow the form's pre-printed
left-margin labels: Mother, Father, Sibling, Sibling, Sibling, Sibling.

For Items 2–4 the form says only "List present first" — no row labels are
printed — so rows are numbered 1..N with row 1 implicitly "present".
For Item 1 the two rows have a conditional meaning per the form text; row 1
is "address before coming to US", row 2 is "last address in country of fear".

Updates raw + normalized maps, questionnaire, and schema.
"""
import json
import os
import re
import sys
from collections import defaultdict
from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Verbatim PDF text for Part A.III headers (page 4)
HEADER_T1 = "1. List your last address where you lived before coming to the United States. If this is not the country where you fear persecution, also list the last address in the country where you fear persecution."
HEADER_T2 = "2. Provide the following information about your residences during the past 5 years. List your present address first."
HEADER_T3 = "3. Provide the following information about your education, beginning with the most recent school that you attended."
HEADER_T4 = "4. Provide the following information about your employment during the past 5 years. List your present employment first."
HEADER_T5 = "5. Provide the following information about your parents and siblings (brothers and sisters). Check the box if the person is deceased."

# Column labels — verbatim from page 4 column headers
COLS_ADDR = {  # T1, T2 — same columns
    "NumberAndStreet": ("Number and Street", 38, 80),  # x range
    "CityTown":        ("City/Town", 168, 200),
    "DeptProvState":   ("Department, Province, or State", 260, 290),
    "Country":         ("Country", 380, 410),
}
COLS_EDU = {  # T3
    "NameOfSchool":    ("Name of School", 38, 80),
    "TypeOfSchool":    ("Type of School", 195, 220),
    "Location":        ("Location (Address)", 320, 350),
}
COLS_EMP = {  # T4
    "EmployerNameAddress": ("Name and Address of Employer", 38, 80),
    "Occupation":          ("Your Occupation", 310, 340),
}
COLS_PARENTS = {  # T5 — TextField13 cols
    "FullName":            ("Full Name", 60, 80),
    "CityCountryOfBirth":  ("City/Town and Country of Birth", 195, 220),
}
# TextField35 is the third column of T5: Current Location
T5_CURRENT_LOC_COL = ("CurrentLocation", "Current Location")

# Row labels for Item 5 (from form's printed left-margin labels)
T5_ROWS = ["Mother", "Father", "Sibling1", "Sibling2", "Sibling3", "Sibling4"]

# Y-coordinates (top to bottom) per table
T1_ROWS_Y = [646.0, 628.0]
T2_ROWS_Y = [550.0, 532.0, 514.0, 496.0, 478.0]
T3_ROWS_Y = [400.0, 382.0, 364.0, 346.0]
T4_ROWS_Y = [268.0, 250.0, 232.0]
T5_ROWS_Y = [160.0, 142.0, 124.0, 106.0, 88.0, 70.0]

DATE_FROM_X = 470.0
DATE_TO_X   = 530.0

Y_TOL = 2.0  # y-coord tolerance for row clustering
X_TOL = 5.0


def classify_table(tu: str) -> "str | None":
    if "last address where you lived" in tu: return "T1"
    if "residences during the past 5 years" in tu: return "T2"
    if "about your education" in tu: return "T3"
    if "about your employment" in tu: return "T4"
    if "parents and siblings" in tu: return "T5"
    return None


def col_from_x(x, cols):
    """Find which column an x-coord falls into."""
    for key, (label, x_lo, x_hi) in cols.items():
        if x_lo - X_TOL <= x <= x_hi + X_TOL:
            return key, label
    return None


def row_index(y, rows_y):
    """Return 0-based row index from y-coord."""
    for i, ry in enumerate(rows_y):
        if abs(y - ry) <= Y_TOL:
            return i
    return None


def main():
    pdf_path = os.path.join(ROOT, "USCIS forms decrypted", "i-589.pdf")
    raw_path = os.path.join(ROOT, "overlay-maps", "raw", "i-589.raw.json")
    norm_path = os.path.join(ROOT, "overlay-maps", "normalized", "i-589.json")
    q_path = os.path.join(ROOT, "questionnaires", "i-589.questionnaire.json")
    s_path = os.path.join(ROOT, "payload-schemas", "i-589.schema.json")

    print("Loading PDF /TU labels...")
    r = PdfReader(pdf_path)
    tus = {n: f.get("/TU", "") or "" for n, f in (r.get_fields() or {}).items()}

    print("Loading raw map...")
    with open(raw_path) as fh:
        raw = json.load(fh)

    # Page 4 field collection
    p4 = [f for f in raw["fields"] if f.get("page") == 4]

    renames = []   # list of {oldKey, newKey, page, originalKey, label}
    seen_new = set(f["key"] for f in raw["fields"])

    def emit(field, new_key, label):
        if new_key in seen_new and field["key"] != new_key:
            # Safety: ensure uniqueness if generated key collides
            base = new_key
            n = 2
            while new_key in seen_new:
                new_key = f"{base}_{n}"
                n += 1
        seen_new.add(new_key)
        renames.append({
            "originalKey": field["originalKey"],
            "newKey": new_key,
            "label": label,
            "page": 4,
        })

    # Process each table
    for f in p4:
        tu = tus.get(f["originalKey"], "")
        t = classify_table(tu)
        if not t:
            continue
        kind = f.get("kind", "text")
        # Skip already-named fields (Deceased checkboxes m/f/s1..s4 are clean)
        if t == "T5" and kind == "checkbox":
            continue

        if t == "T1":
            row = row_index(f["y"], T1_ROWS_Y)
            if row is None: continue
            row_label = ["Address Before US (most recent before coming)", "Last Address in Country of Fear"][row]
            if "TextField13" == f["key"]:
                col = col_from_x(f["x"], COLS_ADDR)
                if not col: continue
                col_key, col_label = col
                new_key = f"PtAIII_Item1_Row{row+1}_{col_key}"
                label = f"{HEADER_T1} — Row {row+1} ({row_label}) — {col_label}"
                emit(f, new_key, label)
            elif "DateTime" in f["key"]:
                from_to = "From" if abs(f["x"] - DATE_FROM_X) < X_TOL else ("To" if abs(f["x"] - DATE_TO_X) < X_TOL else None)
                if not from_to: continue
                col_label = "From (Mo/Yr)" if from_to == "From" else "To (Mo/Yr)"
                new_key = f"PtAIII_Item1_Row{row+1}_Date{from_to}"
                label = f"{HEADER_T1} — Row {row+1} ({row_label}) — {col_label}"
                emit(f, new_key, label)

        elif t in ("T2", "T3", "T4"):
            rows_y, cols, item_num, header = {
                "T2": (T2_ROWS_Y, COLS_ADDR,    2, HEADER_T2),
                "T3": (T3_ROWS_Y, COLS_EDU,     3, HEADER_T3),
                "T4": (T4_ROWS_Y, COLS_EMP,     4, HEADER_T4),
            }[t]
            row = row_index(f["y"], rows_y)
            if row is None: continue
            row_note = " (present)" if row == 0 else ""

            if "TextField13" == f["key"]:
                col = col_from_x(f["x"], cols)
                if not col: continue
                col_key, col_label = col
                new_key = f"PtAIII_Item{item_num}_Row{row+1}_{col_key}"
                label = f"{header} — Row {row+1}{row_note} — {col_label}"
                emit(f, new_key, label)
            elif "DateTime" in f["key"]:
                from_to = "From" if abs(f["x"] - DATE_FROM_X) < X_TOL else ("To" if abs(f["x"] - DATE_TO_X) < X_TOL else None)
                if not from_to: continue
                col_label = "From (Mo/Yr)" if from_to == "From" else "To (Mo/Yr)"
                new_key = f"PtAIII_Item{item_num}_Row{row+1}_Date{from_to}"
                label = f"{header} — Row {row+1}{row_note} — {col_label}"
                emit(f, new_key, label)

        elif t == "T5":
            row = row_index(f["y"], T5_ROWS_Y)
            if row is None: continue
            row_label = T5_ROWS[row]
            if "TextField13" == f["key"]:
                col = col_from_x(f["x"], COLS_PARENTS)
                if not col: continue
                col_key, col_label = col
                new_key = f"PtAIII_Item5_{row_label}_{col_key}"
                label = f"{HEADER_T5} — {row_label} — {col_label}"
                emit(f, new_key, label)
            elif f["key"] == "TextField35":
                col_key, col_label = T5_CURRENT_LOC_COL
                new_key = f"PtAIII_Item5_{row_label}_{col_key}"
                label = f"{HEADER_T5} — {row_label} — {col_label}"
                emit(f, new_key, label)

    print(f"Generated {len(renames)} renames")

    # Build lookup: originalKey → newKey
    by_oid = {r["originalKey"]: r for r in renames}
    old_keys_to_remove = set()

    # Apply to raw and normalized maps
    def apply_to(path):
        with open(path) as fh:
            data = json.load(fh)
        n = 0
        for fld in data.get("fields", []):
            oid = fld.get("originalKey", "")
            if oid in by_oid:
                old_keys_to_remove.add(fld["key"])
                fld["key"] = by_oid[oid]["newKey"]
                n += 1
        with open(path, "w") as fh:
            json.dump(data, fh, indent=2)
        return n

    n_raw = apply_to(raw_path)
    n_norm = apply_to(norm_path)

    # Update questionnaire
    with open(q_path) as fh:
        q = json.load(fh)
    existing = set()
    for p in q.get("pages", []):
        for fld in p.get("fields", []) or []:
            existing.add(fld.get("key"))
    p4_page = next((p for p in q["pages"] if p.get("page") == 4), None)
    q_removed = 0
    q_added = 0
    if p4_page is not None:
        before = len(p4_page.get("fields", []) or [])
        p4_page["fields"] = [
            fld for fld in (p4_page.get("fields") or [])
            if fld.get("key") not in old_keys_to_remove
        ]
        q_removed = before - len(p4_page["fields"])
        for r_ in renames:
            if r_["newKey"] in existing:
                continue
            p4_page["fields"].append({
                "key": r_["newKey"],
                "label": r_["label"],
                "mode": "text",
                "type": "text",
                "defaultValue": "",
            })
            existing.add(r_["newKey"])
            q_added += 1
    with open(q_path, "w") as fh:
        json.dump(q, fh, indent=2)

    # Update schema
    with open(s_path) as fh:
        s = json.load(fh)
    pages = s.get("pages", {})
    s_removed = 0
    s_added = 0
    p4_key = "4"
    if p4_key in pages:
        before = len(pages[p4_key])
        pages[p4_key] = [fld for fld in pages[p4_key] if fld.get("key") not in old_keys_to_remove]
        s_removed = before - len(pages[p4_key])
        for r_ in renames:
            if not any(fld.get("key") == r_["newKey"] for fld in pages[p4_key]):
                pages[p4_key].append({
                    "key": r_["newKey"],
                    "mode": "text",
                    "kind": "text",
                    "defaultValue": "",
                })
                s_added += 1
    s["pages"] = pages
    with open(s_path, "w") as fh:
        json.dump(s, fh, indent=2)

    print()
    print("Renames applied:")
    print(f"  raw map:        {n_raw}")
    print(f"  normalized map: {n_norm}")
    print(f"  questionnaire:  removed {q_removed}, added {q_added}")
    print(f"  schema:         removed {s_removed}, added {s_added}")


if __name__ == "__main__":
    main()
