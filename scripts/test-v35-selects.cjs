/* V35 executable regression suite: no fabricated taxonomic codes. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const refs={
 SDP:[{KPC:'ОС',NDP:'Осина','ОбПор':'7'}, {KPC:'КУСТ',NDP:'Кустарники','ОбПор':'9'}],
 STL:[
  {KTL:'БРТЗ',NTL:'Березняк разнотравный',GPor:'7',Lxz:3,OblStl:15,GrTL:1},
  {KTL:'СВЕТ',NTL:'Светлый тип леса',GPor:'7',Lxz:4,OblStl:15,GrTL:2},
  {KTL:'БРТ2',NTL:'Другой групповой тип',GPor:'7',Lxz:3,OblStl:15,GrTL:2},
  {KTL:'НЕЧУЖ',NTL:'Другой район',GPor:'7',Lxz:3,OblStl:35,GrTL:1},
  {KTL:'КУСТТ',NTL:'Для кустарников',GPor:'9',Lxz:3,OblStl:15,GrTL:1}
 ]};
const window={SOLIN_REFS:{tables:refs}};
class Option {
 constructor(text,value){this.textContent=text;this.value=value;this.disabled=false;}
}
vm.runInNewContext(read('solin-dependent-rules.js'),{window,Option,console});
const engine=window.SolinDependentRules,org={KTO:150000000};
assert.ok(engine,'Source-dependent engine must initialise');
let r=engine.options('ВыделВ','M3Pr',{}, {},org,refs);
assert.equal(r.status,'partial','SDP fallback must be clearly identified as partial');
assert.ok(r.items.some(x=>x.value==='ОС'));
assert.ok(!r.items.some(x=>x.value==='КУСТ'),'Shrubs must not become main-species choice');
let strict={M3Pr:'ОС',KlxrVD:3,NE2A:1};
r=engine.options('ВыделВ','M3TLU',strict,strict,org,refs);
assert.equal(r.status,'complete');
assert.deepEqual(Array.from(r.items.map(x=>x.value)),['БРТЗ']);
const missingZone={M3Pr:'ОС',NE2A:1};
r=engine.options('ВыделВ','M3TLU',missingZone,missingZone,org,refs);
assert.equal(r.status,'unavailable','Unknown zone must never enable unchecked types');
assert.equal(r.items.length,0);
const missingGroup={M3Pr:'ОС',KlxrVD:3};
r=engine.options('ВыделВ','M3TLU',missingGroup,missingGroup,org,refs);
assert.equal(r.status,'ambiguous','Multiple original groups must not be mixed');
assert.equal(r.items.length,0);
assert.deepEqual(Array.from(engine.forestTypes(missingGroup,org,refs).groups).sort(),['1','2'].sort());
const oneGroup={...refs,STL:refs.STL.filter(row=>row.GrTL===1)};
const single=engine.options('ВыделВ','M3TLU',missingGroup,missingGroup,org,oneGroup);
assert.equal(single.status,'partial','One group without explicit NE2A is partial');
assert.deepEqual(Array.from(single.items.map(x=>x.value)),['БРТЗ']);
const noRegion={M3Pr:'ОС',KlxrVD:3,NE2A:1};
r=engine.options('ВыделВ','M3TLU',noRegion,noRegion,{},refs);
assert.equal(r.status,'unavailable','Unknown region must not leak other regions');
assert.equal(r.items.length,0);
const select={
 tagName:'SELECT',dataset:{},value:'',disabled:true,title:'',
 replaceChildren(...children){this.children=children;}
};
engine.applySelect(select,single,{current:''});
assert.equal(select.disabled,false,'Partial but unique group may be selectable');
assert.equal(select.dataset.dependentStatus,'partial');
assert.equal(select.children.length,2);
const tip={...refs,SDP_Tip:[{KPC:'ОС',NDP:'Осина'}, {KPC:'КУСТ',NDP:'Куст'}]};
r=engine.options('ВыделВ','M3Pr',{}, {},org,tip);
assert.equal(r.status,'complete','Original source should be full status');
const js=read('solin-v35-features.js'),css=read('solin-v35-motion.css'),api=read('solin-card-assist.js');
new Function(js);
assert.ok(js.includes("field:'M3Pr'")&&js.includes("field:'M3TLU'"));
assert.ok(js.includes('openFieldByKey')&&api.includes('openFieldByKey(field)'));
assert.ok(js.includes('function chooseGroup(groups)')&&js.includes("data-ce-field=\"NE2A\""));
assert.ok(js.includes('sheet.remove()'),'Sub-dialog requires explicit X close');
assert.ok(js.includes('const nextLabel='));
assert.ok(css.includes('v35-screen-in')&&css.includes('v35-dialog-enter'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(!css.includes('backdrop-filter:blur'),'No heavy blur on 4GB tablet');
if(process.argv.includes('--built')){
 for(const f of ['www/solin-v35-features.js','www/solin-v35-motion.css',
 'www/solin-dependent-rules.js','www/solin-card-assist.js'])
  assert.ok(fs.existsSync(f),'Missing V35 asset: '+f);
 const built=read('www/solin-dependent-rules.js'),helper=read('www/solin-card-assist.js');
 assert.ok(built.includes('const ambiguous=!groupKnown&&groups.length>1'),'Original ambiguous-group guard missing');
 assert.ok(built.includes('const fallback=!original'));
 assert.ok(helper.includes('openFieldByKey(field)'));
 const html=read('www/index.html');
 assert.ok(html.includes('solin-v35-features.js?v=35'));
 assert.ok(html.includes('solin-v35-motion.css?v=35'));
}
console.log('V35 PASS: source-only types, partial prerequisites, original KPC options, Maket3 editable picker, reduced motion.');
