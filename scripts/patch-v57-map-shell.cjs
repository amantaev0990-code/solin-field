'use strict';
const fs=require('node:fs');
const filename=process.argv[2]||'www/index.html';
let html=fs.readFileSync(filename,'utf8');
function replaceOne(regex,replacement,label){
 const matches=[...html.matchAll(new RegExp(regex.source,regex.flags.includes('g')?regex.flags:regex.flags+'g'))];
 if(matches.length!==1)throw Error('V57 map shell: '+label+' expected once, got '+matches.length);
 html=html.replace(regex,replacement);
}
replaceOne(/<button\b(?=[^>]*\bid="offlineImportBtn")[^>]*>[\s\S]*?<\/button>/,'','remove redundant MBTiles');
replaceOne(/(<button\b[^>]*\bid="satBtn"[^>]*>)[^<]*(<\/button>)/,'$1Спутник Sentinel-2$2','satellite title');
replaceOne(/(<button\b[^>]*\bid="offlineDownloadBtn"[^>]*>)[^<]*(<\/button>)/,'$1Мои карты / Скачать$2','offline catalog title');
html=html.replace('Перед выездом нажмите «Скачать карту» при подключении к интернету. Спутниковая карта сохранится для этого лесничества и откроется в режиме полёта. Свой снимок можно загрузить из MBTiles. Google доступен онлайн.',
 'Для работы без сети заранее сохраните карту для лесничества или откройте собственный MBTiles через «Открыть файл карты». GPS и контуры не зависят от связи. Снимки Sentinel-2 (2016–2017) имеют детализацию 10 м.');
html=html.replace('Для работы без сети скачайте карту или добавьте MBTiles.','Офлайн-карты хранятся на планшете. Откройте «Мои карты / Скачать» для управления.');
for(const asset of ['map.css','map.js','solin-offline-imagery.js']){
 const re=new RegExp('('+asset.replaceAll('.','\\.')+')(\\?v=[^"\\s]*)?','g');
 if(!re.test(html))throw Error('V57 map shell: missing asset '+asset);
 html=html.replace(re,'$1?v=20261112-v57');
}
fs.writeFileSync(filename,html);
console.log('V57_MAP_SHELL_OK: preserved original shell, updated map controls and asset versions');
