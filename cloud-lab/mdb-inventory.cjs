#!/usr/bin/env node
'use strict';
// Read-only: the MDB is opened exclusively with readFileSync, never written.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function inventory(source,selected=[]){
 const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(root,'vendor/mdb-reader.bundle.js'),'utf8'),sandbox);
 const bytes=fs.readFileSync(source),M=sandbox.SolinMDB,reader=new M.Reader(M.Buffer.from(bytes));
 const out={format:'SOLIN-CLOUD-LAB-source-v1',source:{name:path.basename(source),size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),reader:M.version},tables:[],linkedTables:reader.getTableNames({normalTables:false,linkedTables:true}),queries:[],rows:{},errors:[]};
 for(const name of reader.getTableNames())try{const t=reader.getTable(name);out.tables.push({name,rowCount:t.rowCount,columns:t.getColumns()});if(selected.includes(name))out.rows[name]=t.getData();}catch(e){out.errors.push({table:name,error:e.message});}
 try{
  const objects=reader.getTable('MSysObjects').getData().filter(o=>o.Type===5),byId=new Map(objects.map(o=>[o.Id,{name:o.Name,id:o.Id,attributes:[]}]));
  for(const row of reader.getTable('MSysQueries').getData()){const q=byId.get(row.ObjectId);if(q)q.attributes.push(row);}
  out.queries=[...byId.values()];
 }catch(e){out.errors.push({table:'saved-query-definitions',error:e.message});}
 return out;
}
if(require.main===module){
 const [source,dest,...tables]=process.argv.slice(2);if(!source||!dest)throw Error('Usage: node cloud-lab/mdb-inventory.cjs SOURCE.mdb PRIVATE_OUTPUT.json [TABLE ...]');
 const target=path.resolve(dest);if(target===root||target.startsWith(root+path.sep))throw Error('Source inventories must be stored outside the public repository');
 const data=inventory(path.resolve(source),tables);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(data,null,2));
 console.log(JSON.stringify({source:data.source,tables:data.tables.length,linkedTables:data.linkedTables.length,queries:data.queries.length,selectedTables:Object.keys(data.rows),errors:data.errors,output:target}));
}
module.exports={inventory};
