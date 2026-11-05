'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const window={};for(const f of ['solin-maket16.js','solin-dependent-rules.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),{window});const M=window.SolinMaket16,D=window.SolinDependentRules;
const card={POS:213,LESN:2,KV:1,KGLF:27,VD:'001',KU:1,KlxrVD:17,M3TLU:'КЕР  ',_children:{Макет10:[{IAR:1,POR:'К',KOEF:1,LET:202,POL:.3,ZAP:40}]}};
const refs={STL:[{Lxz:17,KTL:'КЕР',UR:80}],S16KOEF:[{KKoef:1,KKUR:80}],S16VOZ:[{NVoz:201,UrYOZ:260}],S16POL:[{KPOL:.3,UrPOL:230}],SDP:[{KPC:'К',NDP:'Кедр'},{KPC:'Б',NDP:'Берёза'}]};
const snapshot=JSON.stringify(card),result=M.creationPreview(card,refs);assert.equal(result.status,'complete');assert.equal(result.rows[0].Ur16,162,'Access Round uses even midpoint, not Math.round');assert.equal(result.rows[0].Ediz,Math.fround(.3));assert.equal(result.rows[0].H16,'КЕР  ');assert.equal(result.rows[0].VD,'001');assert.equal(JSON.stringify(card),snapshot);
assert.equal(M.creationPreview({...card,LESN:3},refs,{POS:213,LESN:2}).status,'ambiguous');assert.equal(M.creationPreview({...card,KU:10},refs).status,'not-applicable');
assert.equal(M.creationPreview(card,{...refs,S16VOZ:undefined}).status,'unavailable');
assert.equal(M.creationPreview(card,{...refs,STL:[{Lxz:17,KTL:'КЕР',UR:null}]}).status,'unverified','NULL norm must not be advertised as a completed yield');
const existing={...card,_children:{...card._children,Макет16:[{Por16:'К',Koef16:8,Voz16:180,Ediz:.7,H16:'old',Neds:5,Sbor:3,Ur16:999,_extra:'keep'}]}};
assert.equal(M.creationPreview(existing,refs).status,'conflict');const before=JSON.stringify(existing),p=M.parameterPreview(existing,refs);assert.equal(p.status,'complete');assert.equal(p.ur16Recalculated,false);assert(!Object.hasOwn(p.updates[0].values,'Ur16'));assert(!Object.hasOwn(p.updates[0].values,'Neds'));assert.equal(JSON.stringify(existing),before);
const dupe=JSON.parse(JSON.stringify(card));dupe._children.Макет10.push({...dupe._children.Макет10[0],POL:.3});assert.equal(M.creationPreview(dupe,refs).status,'ambiguous');
const overlap={...refs,S16VOZ:[...refs.S16VOZ,{NVoz:162,UrYOZ:1}]};assert.equal(M.creationPreview(card,overlap).status,'ambiguous','Inclusive source age window may create two rows');
assert.equal(D.options('Макет16','Por16',{},card,null,refs).items[0].value,'К');
for(const [field,value]of [['LET',80],['LET',80.000001],['POL',1e-50],['KOEF',0],['IAR',2],['POL',0],['POR','Б']]){const bad=JSON.parse(JSON.stringify(card));bad._children.Макет10[0][field]=value;assert.equal(D.options('Макет16','Por16',{},bad,null,refs).items.length,0,field+' must restrict selector');}
const foreign=JSON.parse(JSON.stringify(card));foreign._children.Макет10[0].KGLF=24;assert.equal(D.options('Макет16','Por16',{},foreign,null,refs).items.length,0);assert.equal(M.sourceRows(foreign,refs).rows.length,0);
console.log('MAKET16_OK: cedar selector, original append, even rounding, duplicate JOIN guards, immutable five-field refresh and preserved yield');
