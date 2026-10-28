# SOLI-N Field — private MDB conversion service

This backend is **source code only** until deployed on a private HTTPS host. It receives a SOLIN-MDB-Bridge-v1 JSON payload from the mobile application, applies the represented SOLI-N tables to a **copy of a genuine Jet MDB template**, verifies row counts and the MDB signature, then returns a binary `.mdb` download. It does not rewrite the original template.

Built with Jackcess 5.0.4 + Jackson 2.22.4, Java 21, Maven and Docker.

## Deployment and secrets

1. Prepare an HTTPS Docker hosting service with **private persistent storage**, for example a private container VM with reverse proxy + TLS. The public GitHub Pages site alone cannot run a Java MDB converter.
2. On the server's private filesystem, place the original matching Jet MDB at `/data/templates/Transf_213_2_2026.mdb`. Never upload this file to the public repository or Docker image. Templates for other forests must be separately named with their own POS/LESN/year.
3. Mount the template directory **read-only** into the container. Docker build from `mdb-service/Dockerfile` with context `mdb-service`.
4. Set `SOLIN_EXPORT_TOKEN` to a cryptographically random secret of at least 32 characters; set `SOLIN_ALLOWED_ORIGIN=https://amantaev0990-code.github.io`, `SOLIN_TEMPLATE_DIR=/data/templates`, `PORT=8080`.
5. Route HTTPS traffic to container port 8080. Restrict network exposure, enable host-side rate limiting and access logs without request bodies or Authorization headers. The API itself permits only one conversion at a time.
6. In SOLI-N Field choose **Ещё → Экспорт**, enter the HTTPS host and secret. The token is kept **only in tab memory**; the HTTPS endpoint is stored in browser local storage. Subsequent exports during the same session use a single tap.
7. Save the returned `Transf_POS_LESN_YEAR_Field.mdb` on the iPhone, open it in Microsoft Access on Windows and test SOLI-N's real **Приём данных** using backups. Compatibility with Access form logic has not yet been proven.

### Example host command (illustrative)

```sh
docker build -t solin-mdb ./mdb-service
docker run --rm -p 127.0.0.1:8080:8080 \
  -e SOLIN_EXPORT_TOKEN="$SOLIN_EXPORT_TOKEN" \
  -e SOLIN_ALLOWED_ORIGIN="https://amantaev0990-code.github.io" \
  -v /private/solin-templates:/data/templates:ro solin-mdb
```

Use a TLS reverse proxy or trusted HTTPS ingress; do not expose the raw HTTP port publicly.

### API

`GET /health` returns `{"status":"ok"}` (no sensitive template inventory).
`POST /api/export` accepts JSON body + `Authorization: Bearer <token>` and allowed `Origin`. The answer is `application/vnd.ms-access` on success and a JSON error on failure. No DB records are stored after the request; the working copy is deleted.

### Safety and limitations

- Fail closed on incorrect forest identity, missing original fields/tables, invalid types and **non-represented district-specific tables**. Never silently replace those missing data structures. JSON sent to the converter is not published or committed.
- A binary MDB is different from an Access `ACCDB`; this converter supports Jet templates identified by `Standard Jet DB`.
- Jackcess cannot guarantee that original Access forms, macros, VBA, proprietary SOLI-N receiving rules, locks, and Access validation expressions are reproduced. Desktop round-trip testing with the user's original template is required before field deployment.
- **No live server, private template or secret has been provisioned by this repository alone.** Until those are connected, the app honestly reports that MDB generation isn't configured.
