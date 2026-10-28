/* Restore only omitted properties from the audited source of the bundled forest.
 * Imported forests, existing values, added cards and unmatched rows are untouched. */
(()=>{'use strict';
const VERSION='audited-source-20261028-v1',HASH='edab84fb6dd2b22f49b7a8b800fa834823722f574f6bb985ad33f548904c94db',KEYS=['POS','LESN','KV','KGLF','VD'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k),copy=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>a===b||a!=null&&b!=null&&String(a)===String(b),key=r=>JSON.stringify(KEYS.map(k=>String(r[k]??'')));
let pending;
function eligible(forest){const s=forest?.source,o=forest?.org;return !s?.controlSourceRecovery&&s?.operational==='Transf_213_2_2026.mdb'&&s.notes==='Данные извлечены напрямую из MDB.'&&Number(s.year)===2026&&Number(o?.POS)===213&&Number(o?.LESN)===2;}
async function load(){return pending??=(async()=>{const response=await fetch('./solin-control-source-recovery.json.gz');if(!response.ok)throw Error('Не удалось загрузить исходные поля для контроля');const bytes=await response.arrayBuffer();if(!window.crypto?.subtle)throw Error('Не удалось проверить исходные поля');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==HASH)throw Error('Версия исходных полей не совпадает');return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());})().catch(e=>{pending=null;throw e;});}
async function repair(forest,provided){
 if(!eligible(forest))return {forest,changed:false};const patch=provided||await load();if(patch.format!=='SOLIN-Verified-Source-Recovery-v1')throw Error('Неверный формат исходных полей');
 const next=copy(forest),records=Object.values(next.quarters).flatMap(q=>q.compartments||[]),byAddress=new Map(),counts={stands:0,quarters:0,children:0,skippedRows:0};
 for(const r of records){const id=key(r);if(byAddress.has(id))byAddress.set(id,null);else byAddress.set(id,r);}
 function fill(target,values,kind){for(const [f,v]of Object.entries(values))if(!own(target,f)){target[f]=copy(v);counts[kind]++;}}
 for(const p of patch.stands){const r=byAddress.get(key(p.address));if(r&&!r._local)fill(r,p.values,'stands');}
 for(const q of Object.values(next.quarters))for(const row of q.quarterRows||[q.meta||{}]){const matches=patch.quarters.filter(p=>Object.entries(p.identity).every(([f,v])=>own(row,f)&&same(row[f],v)));if(matches.length===1)fill(row,matches[0].values,'quarters');else counts.skippedRows++;}
 const groups=new Map();for(const p of patch.children){const id=key(p.address)+'|'+p.form;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(p);}
 for(const r of records){if(r._local)continue;for(const [form,rows]of Object.entries(r._children||{}))for(const row of rows){const matches=(groups.get(key(r)+'|'+form)||[]).filter(p=>Object.entries(p.signature).every(([f,v])=>own(row,f)&&same(row[f],v)));if(!matches.length){counts.skippedRows++;continue;}const values=Object.fromEntries(Object.entries(matches[0].values).filter(([f,v])=>matches.every(p=>own(p.values,f)&&JSON.stringify(p.values[f])===JSON.stringify(v))));fill(row,values,'children');}}
 const changed=counts.stands+counts.quarters+counts.children>0;if(changed){next.source.controlSourceRecovery={version:VERSION,sourceSha256:patch.sourceSha256,at:new Date().toISOString(),counts};next.updatedAt=new Date().toISOString();next.history=[...(next.history||[]).slice(-49),{at:next.updatedAt,reason:'Восстановлены пропущенные поля из исходной базы; существующие значения сохранены',counts}];}
 return {forest:changed?next:forest,changed,counts};
}
window.SolinControlSourceRecovery={eligible,repair,version:VERSION};
})();
