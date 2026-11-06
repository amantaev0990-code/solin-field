const fs=require('fs'),vm=require('vm'),zlib=require('zlib');
global.window=global;global.D={quarters:{}};
for(const name of ['solin-reference-supplement.js','solin-quarter-pickers.js','solin-dependent-rules.js','solin-card-calculations.js']){vm.runInThisContext(fs.readFileSync(__dirname+'/'+name,'utf8'),{filename:name});}
const refs={tables:JSON.parse(fs.readFileSync(__dirname+'/refs.json','utf8'))};
const pack=JSON.parse(zlib.gunzipSync(fs.readFileSync('/mnt/data/v23audit/solin-private-refs.packed.bin')));
SolinReferenceSupplement.apply(refs,pack);global.SOLIN_REFS=refs;
let candidate=SolinQuarterPickers.candidates('Raion',{}, {POS:330,LESN:5,KTO:190000000});
const expected=pack.tables['Кл_Рай'].filter(r=>+r.ТЕОб===190000000).length;
console.log('Original Кл_Рай',pack.tables['Кл_Рай'].length,'Karaganda districts',expected,'choices',candidate.items.length);
if(candidate.items.length!==expected||candidate.items.length<=1)throw Error('Original districts were not fully surfaced');
const card={POS:330,LESN:5,KV:1,VD:35,KGLF:27,KU:2,PLV:2,KlxrVD:19,M3Pr:'ЕШ',M3B:'5',_children:{'Макет10':[{IAR:1,KOEF:10,POR:'ЕШ',LET:90,PH:18,PD2:24,PROI:4,POL:0.5,ZAP:0}]}};
const org={POS:330,LESN:5,KTO:190000000};
const types=SolinDependentRules.forestTypes(card,org,refs.tables);
console.log('Schrenk forest types',types.status,types.items.map(t=>t.value).join(','));
if(!types.items.some(x=>x.value==='ЕЗРТ'))throw Error('Forest type ЕЗРТ not shown');
const norm=SolinCardCalculations.stockPerHectare(card,refs.tables,org,{POS:330,LESN:5,KV:1,KGLF:27,Klxr:19,GodT:2016});
console.log('K59 corrected normative stock',norm.status,norm.expected);
if(norm.status!=='complete'||norm.expected!==191)throw Error('K59 stock not 191');