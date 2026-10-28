# SOLI-N Field — web-to-APK compatibility and true MDB export

**Decision, 2026-10-28.** Work from the current HTML/CSS/JavaScript SOLI-N Field codebase; package it as Android APK via Capacitor when ready. Do not rewrite the app in Flutter merely to create an APK. Do not place private Transfer databases in public GitHub. No subscription, paid server, or live conversion endpoint is a requirement.

## Hard requirements

1. The same **UI, taxonomic card fields, dictionaries, validation/control logic, quarter/stand/maket data structures, photos, GPS, CMF2 map reader and offline workspaces** must be reused in web and Android builds. Keep the authoritative web project instead of implementing separate screens in Flutter.
2. All exported documents must represent a **real Jet Access MDB binary** derived from a verified original template, never renamed JSON or ZIP. Preserve original schema, original field types, indexes and non-edited operational tables. Abort on unrepresentable values or broken stand/quarter references.
3. One user-visible menu action: **Ещё → Экспорт**. On iPhone web and in Android APK the export uses the same validated snapshot with a replaceable local writer implementation. No paid backend requirement.
4. Offline after initial installation. Do not require internet to write a standalone MDB once the writer has passed device-level tests.
5. Data continuity requires an explicit **import/export of workspaces and templates**. IndexedDB/localStorage from the iPhone Safari origin will NOT magically appear in Android WebView storage; packaging code does not migrate personal data.
6. Downloads must use the device's file/save flow (Android Storage Access Framework / MediaStore via native plugin; browser download or Files share dialog on iPhone); do not assume arbitrary filesystem access.
7. Before calling the feature complete, test an output MDB in MS Access and the original SOLI-N import workflow **on copies**, including stand identity, number of tables and rows, nulls/empty strings, memo/date/currency fields, child makets, original macros/other table preservation, and offline export after app restart.

## Architecture contract (not yet implemented as a working Jet writer)

```
current HTML/CSS/JS SOLI-N Field
  ├─ UI and menus («Экспорт»)
  ├─ workspace / transfer snapshots (SOLIN-MDB-Bridge-v1, immutable export payload)
  ├─ MDB export service interface (async createMdb({originalTemplateBytes, snapshot}) -> Uint8Array)
  │    ├─ Browser/iPhone writer: local implementation to be proven experimentally
  │    │    (CheerpJ+Jackcess is a research option, NOT a production/offline guarantee)
  │    └─ Android APK: native Capacitor plugin, using tested local Jet MDB writer
  │         (Jackcess is a candidate; Android-specific configuration is required)
  └─ platform-specific save-to-Files/Downloads adapter
```

Do **not** assume that CheerpJ's community license permits bundling/self-hosting its runtime in a distributed work APK. Avoid any architectural requirement for that technology.

### Current repository reality

- The installed web app currently includes `solin-online-mdb.js` using a remote converter and a ZIP bridge `solin-mdb-bridge.js`. These are **prototypes**, not the required offline writer, and must be replaced only after the offline writer is tested. Do not represent a ZIP as an MDB.
- The `flutter_app/` folder is a separate earlier prototype; it is **not** the source of truth for the much richer web UI.
- Use Capacitor to bundle the existing web code, assets and the original offline map reader; before release audit service-worker routing, relative asset paths, IndexedDB and native file access.
- Jackcess 5.x is Java 11+. Its documented Android accommodations include setting `com.healthmarketscience.jackcess.brokenNio=true`, `com.healthmarketscience.jackcess.resourcePath=/res/raw/`, packaging relevant resources in Android `res/raw`, and setting the thread context class loader. Test the actual version and Android API levels before committing to this writer.

### Acceptance sequence

- [ ] Browser/iPhone: import original `Transf_213_2_2026.mdb`; edit a sample stand; generate **real** `.mdb` locally; re-read all 29 source operational tables.
- [ ] Android: same original MDB + same validated snapshot produces matching tables/records via native plugin, fully offline.
- [ ] Existing functionality works in APK: maps/CMF2, GPS, photos, workspaces, original-style taxonomic cards and control.
- [ ] Workspace backup can be imported from Safari into Android app explicitly.
- [ ] Desktop SOLI-N accepts the exported MDB in a **test** database. No changes to production Access files.
- [ ] Release APK only after device tests.

**References:**
- https://capacitorjs.com/docs/
- https://capacitorjs.com/docs/getting-started
- https://jackcess.sourceforge.io/
- https://jackcess.sourceforge.io/faq.html
- https://cheerpj.com/new-cheerpj-licensing/


## Реализовано в ветке main (первый рабочий каркас APK)

- `package.json`, `capacitor.config.json`: Capacitor Android из **того же HTML/CSS/JS**, что и GitHub Pages, без переписывания на Flutter.
- `scripts/build-mobile.mjs`: собирает статические файлы, справочники, данные кварталов, библиотеки CMF2 и карты в `www/`. Не включает личные MDB или ключи. Отключает регистрацию service worker внутри APK.
- `scripts/install-android-mdb.mjs`: регистрирует локальный плагин `SolinMdb` и добавляет Jackcess 4.0.12 в Android Gradle.
- `native/android/SolinMdbPlugin.java`: создаёт **копию** Jet MDB, проверяет лесничество и схему таблиц, заменяет данные, проверяет сохранённые количества строк и вызывает системное окно Android «Создать документ» для `.mdb`. Временные копии удаляются.
- `solin-apk-mdb.js`: общий клиентский слой для снимка Transfer и Android-плагина; первый раз просит оригинальный `.mdb`, сохраняет его в IndexedDB приложения; дальнейшие экспорты одной кнопкой. На iPhone Safari показывает честное сообщение, что локальный writer пока недоступен, а не поддельный MDB.
- `.github/workflows/solin-android-apk.yml`: CI пытается собрать debug APK и выдать артефакт сборки. **Создание файла APK в CI не является тестом содержимого MDB.**

### Как собрать отладочную сборку (Android SDK + Java 21 + Node 22)

```sh
npm install
npm run android:init
cd android
./gradlew assembleDebug
```

Результат при успешной сборке: `android/app/build/outputs/apk/debug/app-debug.apk`.
Публичный GitHub Actions workflow также может собрать APK, если у репозитория включены Actions. Не выдавайте сборку как полноценный SOLI-N до испытания настоящей MDB.

### Что обязательно проверить

- Компиляция и запуск APK на устройстве: в текущем окружении нет Android SDK и нельзя подтвердить запуск. Jackcess для Android может требовать дополнительные ресурсы JAR в `res/raw` (см. FAQ Jackcess); это нужно проверить на устройстве, прежде чем считать экспорт готовым.
- Реальный round-trip `Transf_213_2_2026.mdb`: особенно неизвестные поля оригинала, дочерние макеты, индексные связи, русские сортировки, сохранение пустых значений. Если несовместимо — остановить экспорт, а не портить существующий Transfer.
- Отдельный бесплатный **iPhone Safari writer** ещё не реализован. Android-плагин не может работать в iPhone Safari. Не привязывать архитектуру к платному CheerpJ или серверу.
- Safari IndexedDB и Android WebView IndexedDB независимы — для переноса с iPhone на Android потребуется экспорт/импорт рабочей базы (отдельный этап).

Старые `solin-online-mdb.js`, `render.yaml` и `mdb-service/` не используются новой кнопкой экспорта. Никакие платные сервисы не создаются.
