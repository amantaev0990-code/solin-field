#!/usr/bin/env python3
"""Bundle *unchanged* SOLI-N Field site sources into a local Android WebView."""
from pathlib import Path
import shutil
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "app" / "src" / "main" / "assets" / "www"
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

# Source of truth: same index.html, styles, scripts and JSON as the web app.
allowed = {".html", ".js", ".css", ".json", ".webmanifest"}
for item in ROOT.iterdir():
    if item.is_file() and item.suffix in allowed:
        shutil.copy2(item, OUT / item.name)
for directory in ("quarters", "refs"):
    if (ROOT / directory).exists():
        shutil.copytree(ROOT / directory, OUT / directory)

# Package browser libraries for offline imports instead of relying on a CDN.
# If a particular optional library is unavailable, keep its original URL:
# that function will still work online, but not fully offline.
libraries = {
 "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css": "vendor/leaflet.css",
 "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js": "vendor/leaflet.js",
 "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js": "vendor/jszip.min.js",
 "https://unpkg.com/sql.js@1.10.3/dist/sql-wasm.js": "vendor/sql-wasm.js",
 "https://unpkg.com/@ngageoint/geopackage@4.2.6/dist/geopackage.min.js": "vendor/geopackage.min.js",
}
extra = {
 "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png": "vendor/images/marker-icon.png",
 "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png": "vendor/images/marker-icon-2x.png",
 "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png": "vendor/images/marker-shadow.png",
 "https://unpkg.com/sql.js@1.10.3/dist/sql-wasm.wasm": "vendor/sql-wasm.wasm",
}
success = {}
for url, relative in {**libraries, **extra}.items():
    dest = OUT / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SOLINField-Android-Build/1.0"})
        with urllib.request.urlopen(req, timeout=35) as response:
            data = response.read()
        if len(data) < 20:
            raise ValueError("Suspiciously short response")
        dest.write_bytes(data)
        success[url] = relative
        print(f"Bundled {relative} ({len(data)} bytes)")
    except Exception as e:
        print(f"WARNING: keeping online dependency {url}: {e}")
index = OUT / "index.html"
html = index.read_text(encoding="utf-8")
for url, target in libraries.items():
    if url in success:
        html = html.replace(url, target)
html = html.replace("</body>", '<script src="solin-android-bridge.js"></script></body>')
index.write_text(html, encoding="utf-8")
shutil.copy2(HERE / "solin-android-bridge.js", OUT / "solin-android-bridge.js")

# Existing app's GeoPackage loader dynamically asks for this exact online folder.
# Replace with local location only when vendor library and sql.js WASM exist.
gpkg = OUT / "gpkg-loader.js"
if gpkg.exists() and "https://unpkg.com/@ngageoint/geopackage@4.2.6/dist/geopackage.min.js" in success:
    # geo package may require extra wasm from its own dist; keep the original
    # dynamic wasm resolver until those resources are verified.
    pass

assert (OUT / "index.html").exists()
assert (OUT / "app.js").exists()
assert (OUT / "data-meta.json").exists()
assert len(list((OUT / "quarters").glob("q*.json"))) == 10
print("Bundled original SOLI-N Field site + all ten quarter data files.")
