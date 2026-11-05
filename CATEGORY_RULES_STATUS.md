# SOLI-N Field — source-backed land-category rules

**Status: staged, not released to the production Android APK.**
Based on the 2026-11-05 original SOLI-N research, not on assumptions from
unrelated forestry systems.

## Verified coverage versus gaps

- **123 SKU category codes and names:** original compact `refs/SKU.json`.
  Every code is recognized by `SolinCategoryRules.profile()`; category
  recognition **is not** proof that all 123 individual forms have been decoded.
  A read-only extraction of the original 124-row SKU includes one service
  record KU=0 and **123 active categories**. Of these, **99 have P10=0**
  and **24 have a nonzero group**. The original 38-field SKU remains private:
  do not publish the original database or entire proprietary catalogue in
  this public GitHub repository.
- **Category-dependent stratum group:** the original `SKU.P10` column,
  when included in the full runtime `SOLIN_REFS.tables.SKU`. Valid `IAR`
  choices are independently filtered through `SIAR.Ia` and, where
  available, `PIAP.KIAR` in `SolinDependentRules.allowedLayers()`.
  If `P10=0`, an **empty** Макет 10 input is replaced with an explanation.
  Existing Макет 10 records are never deleted or overwritten.
- **Group of forms and hidden original form flags:** the original
  `SKU.GrMak`, `SKU.PN`, `SKU.P31`, `SKU.PM`, `SKU.PF1` and
  `SKU.KLF` are exposed as factual metadata if present. Their exact
  correspondence to required individual макеты has NOT yet been fully
  verified. Do not treat `GrMak` as a list of макеты or assume
  `P31` means Макет 31. The original KU RowSource has physical column
  order `KU,NKU,KLF,PN,P31,P10,PM,GrMak,PF1`.
- **KU 19 / no stock:** the original manual states that stock is not
  entered for unclosed forest cultures. All six KU19 rows in the preserved
  Transfer sample have `ZAP=0`. New rows default to numeric zero without
  showing a stock entry. Legacy imported nonzero ZAP remains visible for
  correction instead of being silently overwritten. The obsolete `SPS`
  field is hidden only from the editor and stays in the MDB schema.
- **Original zone attributes:** the source SKU contains `PjN` values and
  the original expression uses `PjN` for forestry zone `Klxr=N`.
  In the recovered sample 14 categories have zone-specific differences.
  `zoneAttribute()` exposes the raw source code, but never asserts its
  unverified forestry meaning or auto-writes other fields.
- **KU 19 (несомкнувшиеся лесные культуры):** Макет 10 `POL`
  represents survival percentage in the field editor, integer `1..100`,
  not fractional density `0.1..1.0`. The audited original Access rule
  for `Макет10.POL` is `>=0 And <=1 Or >25 And <101`: survival values
  below `26` therefore receive an explicit control warning even though
  they can be recorded in the draft. No unit conversions are performed.
- **Ordinary stand categories KU 1–10:** the current verified relative
  fullness field retains `0..1`, with the regular `0.1..1.0` picker
  where already available. Do not copy this picker blindly to all 123 KU.
- **Other KU:** where specific `POL` semantics are not confirmed, the
  input says `POL — значение уточняется`. It allows preserving the
  original raw numeric MDB value, without invented ranges or silent changes.
  The generic Access validation remains a separate check.
- **Preserving data and reclassification:** changing `KU` rebuilds
  only controls in the active draft. Legacy records, existing children
  and source MDB fields retain their original values. The original
  desktop manual explicitly requires re-entering an allotment when
  changing an already populated KU/GLF classification because prior
  category-specific макеты can persist. The field editor therefore
  blocks saving a reclassified existing allotment with child-макеты
  and explains how to create a fresh record; it never deletes rows
  automatically.

## What still requires the original Access SOLI-N

1. Extract all `ВыделВ` / `Макет*` form expressions and event procedures
   that depend on `KU`, `GrMak`, `P10`, `KLF`.
2. Verify each category's mandatory/optional fields, admissible macro
   forms and numeric ranges against original control results.
3. Add each rule with source provenance and positive/negative examples.
4. Run the full field loop: enter data on Android → MDB → import into
   **SOLI-N 10.31** on a test database → run the original controls.

The original Windows host is presently offline. The existing Android
checks cannot claim to reproduce that last Access control step.

## Development verification

Run `node scripts/test-category-rule-engine.cjs` for all 123 catalog
codes and known / unknown interpretations; run
`node scripts/test-category-layer-dependencies.cjs` for the Access
`SKU.P10 → SIAR.Ia → PIAP.KIAR` links; run the regular card-editor suite
for regressions. All category tests are read-only and do not manipulate
the packaged MDB or any user forest.
