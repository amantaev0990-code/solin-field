'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const catalogSource=fs.readFileSync(path.join(root,'solin-forest-catalog.js'),'utf8');
const workspaceSource=fs.readFileSync(path.join(root,'solin-workspace.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const sandbox={window:{}};
vm.runInNewContext(catalogSource,sandbox);
const catalog=sandbox.window.SOLIN_FOREST_CATALOG;
assert.equal(catalog.expectedTotal,878);
assert.equal(catalog.excludedSentinel,1);
assert.equal(catalog.rows.length,877);
const owners=catalog.rows.filter(r=>r[1]===0);
const districts=catalog.rows.filter(r=>r[1]>0);
assert.equal(owners.length,233);
assert.equal(districts.length,644);
const ownerMap=new Map(owners.map(r=>[r[0],r]));
assert.equal(ownerMap.size,owners.length);
const addressSet=new Set();
for(const row of catalog.rows){
 const key=row[0]+'::'+row[1];
 assert.equal(addressSet.has(key),false,'duplicate '+key);
 addressSet.add(key);
 if(row[1]>0){
  const owner=ownerMap.get(row[0]);
  assert.ok(owner,'missing owner for '+key);
  assert.equal(row[4],owner[4],'KTO conflict for '+key);
 }
}
const start=workspaceSource.indexOf('const SOLIN_REGIONS=[');
const end=workspaceSource.indexOf('async function create(input){',start);
assert.ok(start>=0&&end>start);
vm.runInNewContext(workspaceSource.slice(start,end)+';globalThis.testApi={regions:SOLIN_REGIONS,owners:catalogOwners,forests:catalogForests,select:selectedFromCatalog};',sandbox);
const api=sandbox.testApi;
assert.equal(api.regions.length,14);
let ownerCount=0,forestCount=0;
for(const region of api.regions){
 const group=api.owners(region.code,[]);
 assert.ok(group.length>0,'no owners in '+region.name);
 ownerCount+=group.length;
 for(const owner of group){
  const family=api.forests(owner.code,[]);
  for(const forest of family){
   forestCount++;
   const choice=api.select({regionCode:region.code,ownerCode:owner.code,districtCode:forest.code},[]);
   assert.equal(choice.owner.code,owner.code);
   assert.equal(choice.district.code,forest.code);
  }
 }
}
assert.equal(ownerCount,233);
assert.equal(forestCount,644);
for(const [pos,lesn,expected] of [[213,2,'Бугетсайское'],[308,1,'Аксайское'],[310,1,'Котырбулакское'],[311,2,'Тургенское'],[360,2,'"Роща Баума"']]){
 const region=api.regions.find(r=>api.owners(r.code,[]).some(o=>o.code===pos));
 assert.ok(region,'missing POS '+pos);
 assert.equal(api.select({regionCode:region.code,ownerCode:pos,districtCode:lesn},[]).district.name,expected);
}
assert.throws(()=>api.select({regionCode:200,ownerCode:308,districtCode:1},[]));
assert.ok(html.indexOf('solin-forest-catalog.js')>=0);
assert.ok(html.indexOf('solin-forest-catalog.js')<html.indexOf('solin-workspace.js'));
assert.match(sw,/\.\/solin-forest-catalog\.js/);
console.log('PASS 14 regions; 233 owners; 644 forests; 0 orphans; 0 duplicate POS::LESN; 0 KTO conflicts');
