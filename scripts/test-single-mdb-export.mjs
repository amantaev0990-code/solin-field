import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('solin-mdb-wasm-entry.js','utf8');
const originalButton={disabled:false,innerHTML:'',onclick:null};
const state={active:'213::2',saved:false,location:null,error:null};
const fakeWindow={
  addEventListener(){},
  location:{assign(url){state.location=url;}},
  SolinWorkspace:{
    ready:Promise.resolve(),
    get activeId(){return state.active;},
    async persist(){state.saved=true;}
  },
  SolinMDBBridge:{snapshot(){return {
    format:'SOLIN-MDB-Bridge-v1',
    identity:{POS:213,LESN:2,GodT:2026},
    tables:Object.fromEntries(Array.from({length:18},(_,i)=>['Table'+i,[]]))
  };}}
};
const fakeDocument={
  readyState:'complete',
  baseURI:'https://amantaev0990-code.github.io/solin-field/',
  getElementById(id){return id==='solin-mdb-export'?originalButton:null;},
};
vm.runInNewContext(source,{window:fakeWindow,document:fakeDocument,
  URL,console,toast(message){state.error=message;},alert(message){state.error=message;}},
  {filename:'solin-mdb-wasm-entry.js',timeout:10000});
assert.equal(typeof originalButton.onclick,'function','Export button was not installed');
assert.match(originalButton.innerHTML,/>Экспорт</,'Menu must be a single Export action');
await originalButton.onclick();
assert.equal(state.saved,true,'Unsaved forestry changes must be persisted first');
let destination=new URL(state.location);
assert.equal(destination.pathname,'/solin-field/mdb-wasm-poc/');
assert.equal(destination.searchParams.get('export'),'1');
assert.equal(destination.searchParams.get('forest'),'213::2');
assert.equal(state.error,null);

originalButton.disabled=false;
state.saved=false;
state.location=null;
state.active='213::3';
await originalButton.onclick();
assert.equal(state.saved,true);
assert.equal(state.location,null,'Must not export another forestry');
assert.match(state.error||'',/не совпал/i);
console.log('SINGLE_MDB_EXPORT_ENTRY_OK: one button, persisted workspace, auto-export, mismatched forest blocked');
