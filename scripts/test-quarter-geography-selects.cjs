/* Regression: independent district/functional-zone lists in quarter and card. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const user={POS:213,LESN:2},shet={POS:723,LESN:4},another={POS:723,LESN:5};
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
assert(a.items.some(x=>x.value==='156000000'));
assert(b.items.some(x=>x.value==='356400000'&&x.label.includes('Шетский')));
assert.equal(api.candidates('Raion',{},another).items.length>=2,true);
const one=Array.from(api.candidates('Fzona',{},another).items,x=>x.value);
const two=Array.from(api.candidates('Fzona',{KGLF:27},shet).items,x=>x.value);
assert.deepEqual(one,two,'Functional zone list must never depend on KGLF');
assert.deepEqual(one,['0','2','3','7']);
const input=new Element('input'),district=api.mount(input,'Raion',()=>({}),{org:()=>user});
assert.equal(district.select.tagName,'SELECT');
assert.equal(district.value(),'','Never force default district for a new quarter');
district.select.value='__solin_manual__';district.select.handlers.change();
district.manual.value='158888888';assert.equal(api.value(district.select),'158888888');
const fz=api.mount(new Element('input'),'Fzona',()=>({KGLF:null}),{org:()=>user});
assert.equal(fz.select.disabled,false,'Function must be selectable before GLF');
assert.equal(fz.value(),'');
fz.select.value='0';assert.equal(fz.value(),'0','Zero means an explicit selectable value');
fz.sync({value:'3'});assert.equal(fz.value(),'3');
const editor=fs.readFileSync('solin-card-editor.js','utf8');
assert(editor.includes("mount(fzonaControl,'Fzona'"));
assert(editor.includes("mount(raionControl,'Raion'"));
console.log('QUARTER_UNRESTRICTED_LISTS_OK: all SFZ, all known districts, zero, manual codes, quarter and card');
