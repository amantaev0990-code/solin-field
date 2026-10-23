/* Predicates transcribed from original SELECT К04 and SELECT К39.
 * These two checks do not run the original control-enabling queries or the other 140 checks.
 */
(()=>{'use strict';
const known=x=>x!==null&&x!==undefined;
const eq=(a,b)=>known(a)&&known(b)&&String(a)===String(b);
const ne=(a,b)=>known(a)&&known(b)&&String(a)!==String(b);
const lt=(a,b)=>known(a)&&Number(a)<b,gt=(a,b)=>known(a)&&Number(a)>b;
function check04(r){if(!eq(r.KU,60))return [{control:'К04',status:'Не применим',reason:'KU ≠ 60'}];
 const rows=r._children?.Макет19?.length?r._children.Макет19:[{}];
 return rows.map((m,i)=>{const bad=!known(m.TB)||eq(m.TB,0)||eq(m.TR,0)||(ne(m.ZP,'')&&(eq(m.ZPR,0)||!known(m.ZPR)))||(!known(m.ZP)&&ne(m.ZPR,0))||(ne(m.ZP,'')&&(lt(m.ZPR,10)||gt(m.ZPR,40)));return {control:'К04',row:i+1,status:bad?'Ошибка':'Пройден',reason:'Предикат исходного SQL К04: параметры болота и зарастания'};});
}
function check39(r,q,refs){
 if(!known(q?.Kpz)||!known(q?.Klxr)||!known(r.KGLF)||!known(r.KU))return [{control:'К39',status:'Не проверено',reason:'Нет однозначного контекста Квартал.Kpz / Klxr / KGLF / KU'}];
 if(!eq(q.Kpz,5)||!gt(q.Klxr,15)||!lt(q.Klxr,21)||!lt(r.KU,10))return [{control:'К39',status:'Не применим',reason:'Вне Kpz=5, 15<Klxr<21, KU<10'}];
 const species=refs?.find(x=>eq(x.KPC,r.M3Pr));if(!species)return [{control:'К39',status:'Не проверено',reason:'Нет строки SDP_Tip для M3Pr (в оригинале INNER JOIN)'}];
 const rows=r._children?.Макет23?.length?r._children.Макет23:[{}];
 return rows.map((m,i)=>{const codes=Array.from({length:8},(_,k)=>Number(m['K'+(k+1)]??0)),US=codes.includes(96)?'УС':codes.includes(97)?'НУ':'НЗ';const bad=eq(r.KGLF,27)?eq(r.OZU,0)&&US==='НЗ'&&ne(species.ОбПор,'С')&&ne(species.ОбПор,'К')&&eq(species.NDR,1):US==='НУ'||US==='УС';return {control:'К39',row:i+1,US,status:bad?'Ошибка':'Пройден',reason:'Предикат исходного SQL К39; 96 имеет приоритет над 97'};});
}
function context(r){const q=D.quarters[String(r.KV)],rows=q?.quarterRows||[q?.meta||{}];const found=rows.filter(x=>eq(x.KGLF,r.KGLF));return found.length===1?found[0]:rows.length===1?rows[0]:null;}
function run(records){return records.flatMap(r=>[...check04(r),...check39(r,context(r),window.SOLIN_REFS?.tables?.SDP_Tip)].map(x=>({...x,address:Object.fromEntries(['POS','LESN','KV','KGLF','VD'].map(k=>[k,r[k]??null]))})));}
function show(records){const results=run(records),h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));openModal('Предметные контроли К04 и К39','<p>Перенесены предикаты двух исходных SQL. Выполняются вручную, независимо от флагов Контроли.Priz. Остальные 140 контролей здесь не исполняются.</p><p>Ошибок: '+results.filter(x=>x.status==='Ошибка').length+'; не проверено: '+results.filter(x=>x.status==='Не проверено').length+'</p><button id="namedExport">Скачать протокол</button>'+results.filter(x=>x.status!=='Не применим').map(x=>'<div class="wf-check '+(x.status==='Ошибка'?'bad':'warn')+'"><b>'+h(x.control+' · '+x.address.KV+'-'+x.address.VD+' / '+x.address.KGLF)+'</b><br>'+h(x.status+' · '+x.reason)+(x.US?' · '+h(x.US):'')+'</div>').join(''));document.querySelector('#namedExport').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({scope:'К04/К39 predicates only',results,source:window.SOLIN_SQL_SOURCE},null,2)],{type:'application/json'}));a.href=u;a.download='SOLIN-K04-K39.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)};}
window.solinNamedControls={check04,check39,run,show};
})();
