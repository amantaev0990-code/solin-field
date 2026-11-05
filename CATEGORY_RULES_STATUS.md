# SOLI-N Field — source-backed land-category rules

**Status: staged, not released to the production Android APK.**
Based on the 2026-11-05 original SOLI-N research, not on assumptions from
unrelated forestry systems.

## Verified coverage versus gaps

- **123 SKU category codes and names:** original compact `refs/SKU.json`.
  Every code is recognized by `SolinCategoryRules.profile()`; category
  recognition **is not** proof that all 123 individual forms have been decoded.
- **Category-dependent stratum group:** the original `SKU.P10` column,
  when included in the full runtime `SOLIN_REFS.tables.SKU`. Valid `IAR`
  choices are independently filtered through `SIAR.Ia` and, where
  available, `PIAP.KIAR` in `SolinDependentRules.allowedLayers()`.
  If `P10=0`, an **empty** Макет 10 input is replaced with an explanation.
  Existing Макет 10 records are never deleted or overwritten.
- **Group of forms:** the original `SKU.GrMak` is exposed as factual
  metadata; its correspondence to required individual макеты has NOT yet
  been fully verified. Do not treat `GrMak` as a list of macros.
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
- **Preserving data:** changing `KU` rebuilds only controls in the
  active draft. Legacy records, existing children and source MDB fields
  retain their original values.

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
