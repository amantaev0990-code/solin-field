function exportTransfer(){
 if(!window.D)return toast('Данные ещё загружаются');
 const local=JSON.parse(localStorage.getItem('solin_user_data_v1')||'{"quarters":{}}');
 const tables={"Квартал":[],"Выдел":[],"Макет10":[],"Макет11":[],"Макет12":[],"Макет13":[],"Макет14":[],"Макет15":[],"Макет17":[],"Макет19":[],"Макет20":[],"Макет21":[],"Макет23":[],"Макет25":[],"Макет27":[],"Макет28":[]};
 const POS=213,LESN=2,GodT=2026;
 for(const [kv,q] of Object.entries(local.quarters||{})){
   if(q._local){const m=q.meta||{};tables['Квартал'].push({POS,LESN,KV:+kv||kv,KGLF:m.KGLF||null,Fzona:m.Fzona||null,GodT,Kpz:m.Kpz||null,Klxr:m.Klxr||null});}
   for(const r of q.compartments||[]){
     if(!r._local)continue;
     const base={POS,LESN,KV:+kv||kv,KGLF:r.KGLF||q.meta?.KGLF||null,VD:r.VD};
     tables['Выдел'].push({...base,PLV:r.PLV,KU:r.KU||null,M3Pr:r.M3Pr||null,M3B:r.M3B||null});
     for(const [name,rows] of Object.entries(r._children||{}))if(tables[name])for(const row of rows||[])tables[name].push({...base,...row});
   }
 }
 const payload={format:'SOLI-N Transfer',schemaVersion:1,source:'SOLI-N Field',createdAt:new Date().toISOString(),POS,LESN,GodT,tables};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Transf_${POS}_${LESN}_${GodT}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Transfer сформирован');
}