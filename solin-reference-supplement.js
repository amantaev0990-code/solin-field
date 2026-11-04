/* Optional privately packaged source references. No fallback codes are invented. */
(()=>{'use strict';
 function apply(refs,pack){
  if(pack?.format!=='SOLIN-private-reference-supplement-v1'||pack.sourceSha256!=='f49dbcc449294e89632bbc6d6935dc2dcda8fa1732cd9b1f8e9378ca4bc42dcf')
   throw Error('Не подтверждён источник дополнительных справочников');
  for(const name of ['PIAP','Кл_Рай'])if(!Array.isArray(pack.tables?.[name]))throw Error('Неполный дополнительный справочник '+name);
  if(pack.tables.PIAP.some(r=>!Number.isInteger(r.KIAR))||pack.tables.Кл_Рай.some(r=>!Number.isInteger(r.te)||!Number.isInteger(r.ТЕОб)))throw Error('Повреждены ключи исходных справочников');
  refs.tables={...refs.tables,...pack.tables};refs.supplement={sourceSha256:pack.sourceSha256,queryEvidence:pack.queryEvidence,limitations:pack.limitations};return refs;
 }
 async function load(refs){
  try{const r=await fetch('./solin-private-refs.packed.bin');if(r.status===404)return refs;if(!r.ok)throw Error('HTTP '+r.status);
   const pack=JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());return apply(refs,pack);
  }catch(e){refs.supplement={status:'unavailable',reason:e.message};return refs;}
 }
 window.SolinReferenceSupplement={apply,load};
})();
