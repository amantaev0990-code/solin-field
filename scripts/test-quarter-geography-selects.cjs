/* SOLI-N Field: quarter-cover district/functional combobox regression.
 * Offline and no browser dependencies: node scripts/test-quarter-geography-selects.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const user={POS:213,LESN:2,KTO:150000000};
const shet={POS:723,LESN:4,KTO:350000000};
const another={POS:723,LESN:5,KTO:350000000};
const D={lesnichestvo:[user],quarters:{1:{quarterRows:[
 {POS:213,LESN:2,KV:1,KGLF:27,Fzona:0,Raion:156000000}
]}}};
const window={SolinDependentRules:{options:(_form,field,row)=>
 field==='Fzona'?{status:'partial',reason:'SFZ.KLF',items:row?.KGLF==27?
  [{value:'3',label:'Предварительная зона 3'}]:[]}:
 {status:'unavailable',reason:'Кл_Рай отсутствует',items:[]}}};
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
const c=window.SolinQuarterPickers;
assert.equal(c.candidates('Raion',{},user).auto,'156000000');
assert.equal(c.candidates('Raion',{},shet).auto,'356400000');
assert(c.candidates('Raion',{},shet).items[0].label.includes('Шетский'));
assert.equal(c.candidates('Raion',{},another).items.length,0,
 'Never leak a district from another forest');
assert.equal(c.candidates('Fzona',{KGLF:27},shet).auto,'0',
 'Preserve explicit zero functional-zone code from the original example');
const input=new Element('input');input.setAttribute('id','newRaion');
const district=c.mount(input,'Raion',()=>({}),{org:()=>user});
assert.equal(district.select.tagName,'SELECT');
assert.equal(district.value(),'156000000');
district.select.value='__solin_manual__';district.select.handlers.change();
district.manual.value='158888888';
assert.equal(c.value(district.select),'158888888');
const fz=c.mount(new Element('input'),'Fzona',()=>({KGLF:27}),{org:()=>user});
assert.equal(fz.value(),'0');
fz.sync({clear:true});assert.equal(fz.value(),'0');
let category=null;
const dependent=c.mount(new Element('input'),'Fzona',()=>({KGLF:category}),{org:()=>another});
assert.equal(dependent.select.disabled,true);
category=27;dependent.sync({clear:true});
assert.equal(dependent.select.disabled,false);
assert(dependent.items.some(x=>x.value==='3'));
const app=fs.readFileSync('app.js','utf8'),core=fs.readFileSync('solin-field-core.js','utf8');
assert(app.includes('SolinQuarterPickers?.value'));
assert(core.includes('SolinQuarterPickers?.value'));
for(const id of ['newRel','newDost','newUdal','newGodT','newTax','newPrin','newKorr'])
 assert(app.includes('id="'+id+'"'),id+' must be present in new quarter cover');
console.log('QUARTER_GEOGRAPHY_SELECTS_OK: source values, exact forest, manual, 0, native select, dependency, correction');
