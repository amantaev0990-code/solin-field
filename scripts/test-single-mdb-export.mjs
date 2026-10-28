import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('solin-mdb-wasm-entry.js','utf8');
const handlers = new Map();
const state = {active:'213::2', saved:false, download:[], navigation:0, error:null};
class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.disabled=false;this.style={};this.listeners={};}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  remove(){this.removed=true;}
  setAttribute(key,value){this[key]=value;}
  addEventListener(type,fn){this.listeners[type]=fn;}
  click(){if(this.tagName==='A')state.download.push({href:this.href,name:this.download});}
}
const button=new Element('button');
const body=new Element('body');
const TestURL=class extends URL {};
TestURL.createObjectURL=()=> 'blob:solin-export-test';
TestURL.revokeObjectURL=()=>{};
const browser={
 location:{origin:'https://example.com',assign(){state.navigation++;}},
 SolinWorkspace:{
  ready:Promise.resolve(),
  get activeId(){return state.active;},
  async persist(){state.saved=true;}
 },
 SolinMDBBridge:{snapshot(){return {
  format:'SOLIN-MDB-Bridge-v1',
  identity:{POS:213,LESN:2,GodT:2026},
  tables:Object.fromEntries(Array.from({length:18},(_,i)=>['Table'+i,[]]))
 };}},
 crypto:{randomUUID:()=> 'token123'},
 addEventListener(type,fn){
  if(!handlers.has(type))handlers.set(type,new Set());
  handlers.get(type).add(fn);
 },
 removeEventListener(type,fn){handlers.get(type)?.delete(fn);}
};
const document={
 readyState:'complete',
 baseURI:'https://example.com/solin-field/',
 body,
 getElementById(id){return id==='solin-mdb-export'?button:null;},
 createElement(tag){return new Element(tag);}
};
vm.runInNewContext(source,{
 window:browser,document,URL:TestURL,Blob,Uint8Array,ArrayBuffer,
 setTimeout,clearTimeout,Date,Math,console,toast(x){state.error=x;},alert(x){state.error=x;}
}, {filename:'solin-mdb-wasm-entry.js',timeout:10000});
assert.equal(typeof button.onclick,'function');
await button.onclick();
assert.equal(state.saved,true);
assert.equal(state.navigation,0,'Export must never navigate away from Field');
const frame=body.children.find(e=>e.tagName==='IFRAME'&&!e.removed);
assert.ok(frame,'WASM exporter must run in off-screen iframe');
assert.match(frame.style.cssText,/opacity:0/);
const target=new TestURL(frame.src);
assert.equal(target.searchParams.get('forest'),'213::2');
assert.equal(target.searchParams.get('embed'),'1');
const payload=new Uint8Array(4096);
payload.set(Buffer.from('Standard Jet DB'),4);
function send(type,name,bytes,token='token123'){
 for(const fn of handlers.get('message')||[]){
  fn({origin:'https://example.com',source:frame.contentWindow,
    data:{type,token,name,bytes}});
 }
}
// Untrusted/mismatched export messages must not cause downloads.
send('solin-mdb-ready','Transf_999_2_2026.mdb',payload.buffer,'wrongtoken');
assert.equal(state.download.length,0);
send('solin-mdb-ready','Transf_213_2_2026.mdb',payload.buffer);
assert.equal(state.navigation,0);
assert.equal(state.download.length,1);
assert.equal(state.download[0].name,'Transf_213_2_2026.mdb');
assert.equal(button.disabled,false);
assert.equal(frame.removed,true,'WASM frame should disappear after export');
button.onclick();
assert.equal(state.download.length,2,'Repeated tap saves same finished MDB');
browser.SolinWorkspace.activeId='213::3';
for(const fn of handlers.get('solin-forest-changed')||[])fn();
assert.equal(state.error,null);
console.log('SINGLE_MDB_EXPORT_OK: no page, hidden WASM, correct filename, same Export button for Safari retry');
