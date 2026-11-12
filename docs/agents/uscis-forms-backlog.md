# USCIS forms: where the work stopped

Paused by the owner on 2026-11-12 ("эти формы позже"). When the owner asks
where the work stopped, show this page. Do not start these forms until the
owner says so.

Numbers come from `npm run qa:uscis-answer-routing -- --report`: fields of
the PDF filled from the wizard's sample answers.

## Done: own questions follow the printed items

- Built earlier: I-485 (550 fields), N-400 (290), I-589 (168), I-751 (163),
  I-864 (154), I-131 (112), I-765 (54).
- Repaired in November 2026: I-130 (121), I-134A (112), I-134 (82),
  I-130A (70), I-90 (56), N-600 (44), I-821D (37), I-821 (33), I-539 (31),
  I-912 (30), I-129F (26), I-864A (25), N-565 (25), AR-11 (21).
  The routing QA fails if any of these 14 drops below its floor.

Items still left for the client's review because the wizard asks them
differently from the form:

- I-912: annual income lines 6 to 8.
- I-821: Part 7, each question separately.
- I-539 and I-821D: status drop-down.
- N-600: Parts 3 to 7.
- I-129F: the beneficiary and history.
- N-565: name as printed on the certificate.

Also known: most of the I-90 wizard has no Ukrainian or Spanish labels, and
the I-864 and I-134 wizards ask the interpreter's and preparer's names twice.

## Paused: only the generic questions (name, addresses, A-number)

About 70 forms still use the generic ~52-question set and fill only the
header fields. The PDF is generated correctly and nothing lands in another
person's field, but the form-specific items are not asked.

Next in line, in the order proposed to the owner:

1. I-864EZ (7 fields) and I-865 (7): reuse the I-864 questions.
2. I-601A (11), I-290B (16), I-102 (10), I-824 (10), I-131A (11), N-336 (24),
   N-600K (6).
3. Then I-601 (4), I-212 (11), N-470 (12), I-539A (12), I-765V (14),
   I-730 (9), I-360 (26).

Filled by an attorney, doctor or employer (thin coverage is acceptable):
G-28, G-28I, I-693, N-648, I-129, I-129CWR, I-129S, I-140, I-9.

Rare: the EB-5 forms (I-526, I-526E, I-829, I-956 series), the adoption
forms (I-600, I-600A, I-800, I-800A) and the remaining G- forms.

## How each form was repaired

1. Read the form's fields and tooltips; where tooltips are missing, fill
   every field with a numbered tag and read the label printed next to it
   (`pdftotext -layout`).
2. Give the form its own wizard steps in
   `netlify/functions/lib/immigration-flow-schema.js`, following the printed
   items, with labels in Russian, Ukrainian and Spanish
   (`immigration-flow-gap-localization.js` for the newest ones).
3. Write the map with `netlify/functions/lib/uscis-map-kit.js`. Fields
   that share a short name are addressed by full name.
4. Generate with fictional data only and read every value back next to its
   label; check boxes on rendered pages.
5. Run `qa:uscis-answer-routing`, `qa:uscis-pdf-integrity`,
   `qa:immigration-flow`, `qa:localization` and `qa:account-uscis-wizard`,
   then add the form to `FIELD_FLOOR` in `scripts/qa-uscis-answer-routing.js`.

Push without deploying; deploys run only by hand.
