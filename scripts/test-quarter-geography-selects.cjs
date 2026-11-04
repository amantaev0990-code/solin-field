/* Regression: independent district/functional-zone lists in quarter and card. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const user={POS:213,LESN:2,KTO:150000000},shet={POS:723,LESN:4,KTO:350000000},another={POS:723,LESN:5,KTO:350000000};
const D={lesnichestvo:[user],quarters:{1:{quarterRows:[
 {POS:213,LESN:2,KV:1,KGLF:27,Fzona:0,Raion:156000000}
]}}};
const window={SOLIN_REFS:{tables:{SFZ:[
 {KLF:24,KFZ:2,NFZK:'Функциональная зона 2'},
 {KLF:27,KFZ:3,NFZK:'Функциональная зона 3'},
 {KLF:54,KFZ:7,NFZK:'Функциональная зона 7'}
]}},SolinWorkspace:{ready:Promise.resolve(),list:async()=>[]},addEventListener(){}};
class Element{
 constructor(tag){this.tagName=tag.toUpperCase();this.attributes=[];this.dataset={};
  this.parentElement={};this.handlers={};this.value='';this.hidden=false;}
 setAttribute(name,value){this.attributes.push({name,value});if(name==='id')this.id=value;}
 append(...nodes){this.children=nodes;for(const node of nodes)node.parentElement=this;}
 replaceWith(element){element.parentElement=this.parentElement;this.replacement=element;}
 insertAdjacentElement(_where,element){element.parentElement=this.parentElement;this.manual=element;}
 replaceChildren(...children){this.children=children;this.value='';}
 addEventListener(type,fn){this.handlers[type]=fn;}
 focus(){this.focused=true;}
}
class Option{constructor(text,value){this.textContent=text;this.value=value;}}
const document={createElement:tag=>new Element(tag)};
vm.runInNewContext(fs.readFileSync('solin-quarter-pickers.js','utf8'),
 {window,D,document,Option});
const api=window.SolinQuarterPickers;
const a=api.candidates('Raion',{},user),b=api.candidates('Raion',{},shet);
assert(a.items.some(x=>x.value==='156000000'&&x.label==='Хромтауский район'));
assert(a.items.some(x=>x.value==='153400000'&&x.label==='Айтекебийский район'));
assert.equal(a.items.length,12,'Aktobe forest must see only its verified 12 districts');
assert(!a.items.some(x=>x.value==='356400000'),'Shet must not leak into Aktobe');
assert.equal(b.items.length,1,'Karaganda forest sees only the Shet verified district');
assert.equal(b.items[0].label,'Шетский район');
assert(!b.items.some(x=>x.value==='156000000'),'Aktobe code must not leak into Karaganda');
assert.equal(api.validateDistrict('356400000',user).status,'mismatch');
assert.equal(api.validateDistrict('156000000',user).status,'matched');
assert.equal(api.validateDistrict('356400000',shet).status,'matched');
assert.equal(api.candidates('Raion',{},another).items.length,1);
const one=Array.from(api.candidates('Fzona',{},another).items,x=>x.value);
const two=Array.from(api.candidates('Fzona',{KGLF:27},shet).items,x=>x.value);
assert.deepEqual(one,['0'],'Without KGLF only zero + manual fallback may be offered');
assert.deepEqual(two,['0','3'],'Functional zones SFZ must be filtered by KGLF 27');
const after=Array.from(api.candidates('Fzona',{KGLF:54},shet).items,x=>x.value);
assert.deepEqual(after,['0','7'],'Changing KGLF must change linked SFZ choices');
const input=new Element('input'),district=api.mount(input,'Raion',()=>({}),{org:()=>user});
assert.equal(district.select.tagName,'SELECT');
assert.equal(district.value(),'','Never force default district for a new quarter');
assert.equal(district.codeOutput.value,'','Empty selected district must leave KATO blank');
assert.equal(district.select.children.find(x=>x.value==='156000000').textContent,'Хромтауский район','District options must not include numeric KATO');
assert(!district.select.children.some(x=>x.value==='356400000'),'Foreign oblast district must not be selectable');
district.select.value='156000000';district.select.handlers.change();
assert.equal(district.codeOutput.value,'156000000','Exact matched KATO displayed');
district.sync({value:'156000000'});
assert.equal(district.select.value,'156000000');
assert.equal(district.codeOutput.value,'156000000');
district.select.value='__solin_manual__';district.select.handlers.change();
district.manual.value='158888888';district.manual.handlers.input();assert.equal(api.value(district.select),'158888888');
assert.equal(district.codeOutput.value,'158888888','Manual code must also update separate KATO field');
const fz=api.mount(new Element('input'),'Fzona',()=>({KGLF:null}),{org:()=>user});
assert.equal(fz.select.disabled,false,'Function must be selectable before GLF');
assert.equal(fz.value(),'');
fz.select.value='0';assert.equal(fz.value(),'0','Zero means an explicit selectable value');
fz.sync({value:'3'});assert.equal(fz.value(),'3');
const editor=fs.readFileSync('solin-card-editor.js','utf8');
assert(editor.includes("mount(fzonaControl,'Fzona'"));
assert(editor.includes("mount(raionControl,'Raion'"));
console.log('QUARTER_REGION_AND_SFZ_FILTERS_OK: verified KATO by KTO, no foreign districts, SFZ dependent on KGLF, manual fallback, quarter/card');
