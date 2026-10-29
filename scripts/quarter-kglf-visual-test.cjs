/* Desktop SOLI-N 2026-10-29 visual survey: quarter 1 consists of
 * KGLF 24 (5 stands / 2 ha) and KGLF 27 (7 stands / 164 ha).
 * UI groups by category; underlying stand data remains unchanged. */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const nodes={};
const makeNode=(key='')=>{
  let html='';
  const node={children:[],onclick:null,className:'',type:'',textContent:'',
    appendChild(child){this.children.push(child);}};
  Object.defineProperty(node,'innerHTML',{get(){return html;},set(value){
    html=value;node.children=[];
    // Replacing the parent DOM replaces all nested elements as in a browser.
    if(key==='#quarters')for(const child of ['#qReturn','#qCategoryList','#qActions','#qComps'])delete nodes[child];
  }});
  return node;
};
const document={
  addEventListener(){}, // App delegates modal backdrop/Escape to document; no DOM events in this VM fixture.
  querySelector(q){return nodes[q]||(nodes[q]=makeNode(q));},
  createElement:()=>makeNode()
};
const fixture={
  quarters:{'1':{
    quarterRows:[{POS:213,LESN:2,KV:1,KGLF:24},{POS:213,LESN:2,KV:1,KGLF:27}],
    compartments:Array.from({length:12},(_,i)=>({
      POS:213,LESN:2,KV:1,KGLF:i<5?24:27,VD:String(i+1),PLV:i<5?0.4:164/7
    }))
  }}
};
const context={document,window:{addEventListener(){}},navigator:{}};
vm.createContext(context);
vm.runInContext(source,context,{filename:'app.js'});
vm.runInContext('D=fixture',Object.assign(context,{fixture}));
const cats=vm.runInContext('quarterCategories(D.quarters["1"])',context);
assert.equal([...cats].join(','),'24,27');
vm.runInContext('openQuarter("1")',context);
assert.equal(nodes['#qCategoryList'].children.length,2);
assert.match(nodes['#quarters'].innerHTML,/12 выделов/);
const first=nodes['#qCategoryList'].children[0];
assert.match(first.innerHTML,/5/);
first.onclick();
assert.match(nodes['#quarters'].innerHTML,/5 выделов · 2 га · КГЛФ 24/);
assert.equal(nodes['#qComps'].children.length,5);
nodes['#qReturn'].onclick();
assert.equal(nodes['#qCategoryList'].children.length,2);
nodes['#qCategoryList'].children[1].onclick();
assert.match(nodes['#quarters'].innerHTML,/7 выделов · 164 га · КГЛФ 27/);
assert.equal(nodes['#qComps'].children.length,7);
assert.equal(fixture.quarters['1'].compartments.length,12);
assert.ok(Math.abs(fixture.quarters['1'].compartments.reduce((a,x)=>a+x.PLV,0)-166)<1e-9);
console.log('VISUAL_QUARTER_KGLF_OK: 5 / 7 stands, 2 / 164 ha, no data edits');
