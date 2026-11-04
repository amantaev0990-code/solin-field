# SOLI-N Cloud Lab

Read-only source inventory, private rule/dependency registry, and repeatable checks for the existing Field kernel. JavaScript is retained; the saved Access SQL runs in the isolated SQLite/WASM runtime as a differential reference. No VBA, source MDB or recovered enterprise rows belong in this directory or public commits.

Run the public regression suite:

```sh
npm run test:logic
```

Read original files without modifying them and keep detailed outputs outside this repository:

```sh
node cloud-lab/mdb-inventory.cjs /private/Solim.mdb /private/lab/solim-inventory.json PIAP СОАТО
node cloud-lab/audit.cjs /private/lab /private/lab/reports
python3 cloud-lab/audit-vba.py /private/recovered.zip /private/active-crosscheck.json /private/lab/vba-inventory.json
java -cp /private/verified-exporter.jar cloud-lab/ReadOnlyMdb.java /private/Solim.mdb /private/lab/solim-jackcess.json
node cloud-lab/build-private-references.cjs /private/lab/solim-inventory.json /private/lab/refs.bin
SOLIN_PRIVATE_REFERENCE_PACK=/private/lab/refs.bin npm run build
```

The private reference supplement restores `PIAP` and materializes `Кл_Рай` from the original `СОАТО` predicate. The additional file is optional: a public build without it reports partial reference coverage. Its historical codes do not assert current KATO equivalence.

`audit.cjs` registers every discovered saved query and available form validation/expression/route, produces a field/query dependency graph, and distinguishes a parsed implementation from verified runtime behavior. It deliberately does not produce an overall completion percentage. Lexical references are not proven event dependencies.

Place optional `*-jackcess.json` and `vba-inventory.json` companions beside the source inventories. The registry then includes original field defaults, required/empty-string constraints, indexes, regenerated join contracts and current VBA procedure identities. To independently re-extract the active directory, add `--source-mdb`, `--parser-archive` and `--event-inventory` to `audit-vba.py`; these reuse the existing private recovery tools and compare every module hash. Legacy-only procedures remain separate. Neither static comparison executes Access events.

Confirmed kernel changes:

- Companion stock conflicts are reported; entered numbers and NULLs are preserved.
- Incomplete composition never silently clears STUR/STUR1.
- Living-layer subtotal is separate from the scalar source UPDATE; automatic stand-stock changes require agreement with one unambiguous original group.
- K59 respects source NDR/SzapCK branch selection, address context and quarter-derived GodT1.
- Rounding uses the saved strict midpoint comparison, without widening its boundary.

The resumed stage restores four Fzona profiles (Solim/Database, create/edit) and verifies them against saved predicates. `query-contract.cjs` compares Jet query types, ordered columns, action targets, assignments, grouping and sorting; it keeps native Access execution separate. `package-private-apk.py` packages the private references locally, verifies signatures and preserves the tested assets. It refuses an in-place V14 update without the original certificate and key. Cloud Lab uses the separate `kz.solin.field.cloudlab` identity and a durable private key.

Unverified: full form-event equivalence, all macros and special layers, current national classifiers, full source DB decoding with the browser MDB reader, physical Android field behavior, and reopening in desktop SOLI-N. Test success is not a production certification. Keep signing backups private and outside this repository.
