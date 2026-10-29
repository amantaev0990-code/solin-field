/* SOLI-N Field modal regression: no native-select DOM replacement,
 * working X/backdrop/Escape and full-screen overlay stacking. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const core=fs.readFileSync('solin-field-core.js','utf8');
const css=fs.readFileSync('solin-modal-stability.css','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.match(app,/onchange="updateNewCompQuarter\(this.value\)"/);
assert.doesNotMatch(app,/onchange="openCompForm\(this.value\)"/);
assert.doesNotMatch(core,/onchange=e=>editQuarter\(k,Number\(e.target.value\)\)/);
assert.match(core,/index=nextIndex;selected=rows\[index\]/);
assert.match(css,/z-index:1000000!important/);
assert.match(css,/#modal\.modal:not\(\.hidden\)>.modalCard/);
assert.match(html,/solin-modal-stability\.css/);
const first=app.indexOf('function updateNewCompQuarter(');
const last=app.indexOf('function createComp(){',first);
assert.ok(first>=0&&last>first);
const category={value:'24',options:[],replaceChildren(...values){
 this.options=values;this.value=values[0]?.value??'';
}};
const fixture={D:{quarters:{
 '1':{quarterRows:[{KGLF:24},{KGLF:27}]},
 '102':{quarterRows:[{KGLF:4},{KGLF:4}]}
}},document:{getElementById:id=>id==='newCompKGLF'?category:null},
Option:class{constructor(label,value){this.label=label;this.value=value;}}};
vm.createContext(fixture);
vm.runInContext(app.slice(first,last),fixture);
vm.runInContext('updateNewCompQuarter("102")',fixture);
assert.deepEqual(category.options.map(x=>x.value),['4']);
assert.equal(category.value,'4');
assert.equal(category.options[0].label,'КГЛФ 4');
vm.runInContext('updateNewCompQuarter("1")',fixture);
assert.deepEqual(category.options.map(x=>x.value),['24','27']);
category.value='27';
vm.runInContext('updateNewCompQuarter("1")',fixture);
assert.equal(category.value,'27','Keep a still-valid KGLF on quarter refresh');
const modalStart=app.indexOf('function openModal(t,html){');
const modalEnd=app.indexOf('function toggleQuarterSearch()',modalStart);
assert.ok(modalStart>=0&&modalEnd>modalStart);
const classes=new Set(['modal','hidden']);
const attrs={};
const active={blurred:false,blur(){this.blurred=true;}};
const mod={classList:{contains:k=>classes.has(k),remove:k=>classes.delete(k),add:k=>classes.add(k)},
 setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],
 contains:()=>true,querySelector:k=>k==='.modalHead .close'?close:null};
const close={type:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},click(){helpers.closeModal();}};
const title={textContent:''},body={innerHTML:''};
const registry={'#modal':mod,'#modalTitle':title,'#modalBody':body};
const handlers={};const doc={activeElement:active,addEventListener:(n,fn)=>handlers[n]=fn};
const context={$:k=>registry[k],document:doc};vm.createContext(context);
vm.runInContext(app.slice(modalStart,modalEnd),context);
const helpers={openModal:(title,html)=>vm.runInContext('openModal',context)(title,html),
 closeModal:()=>vm.runInContext('closeModal',context)()};
helpers.openModal('Новый выдел','<input>');
assert.equal(title.textContent,'Новый выдел');
assert.equal(body.innerHTML,'<input>');
assert.ok(!classes.has('hidden'));
assert.equal(attrs['aria-modal'],'true');
assert.equal(close.attrs['aria-label'],'Закрыть окно');
helpers.closeModal();assert.ok(classes.has('hidden'));assert.ok(active.blurred);
helpers.openModal('Click','...');
handlers.click({target:mod});assert.ok(classes.has('hidden'));
helpers.openModal('Escape','...');
let prevented=false,stopped=false;
handlers.keydown({key:'Escape',defaultPrevented:false,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
assert.ok(classes.has('hidden')&&prevented&&stopped);
assert.equal(attrs['aria-modal'],undefined);
console.log('MODAL_SOURCE_OK: safe quarter picker, stable editQuarter, top layer, accessible X/backdrop/Escape');
