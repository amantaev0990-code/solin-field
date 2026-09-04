let D=null,current=null,gps=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
async function boot(){
 D=await fetch('./data.json').then(r=>r.json());
 $('#qcount').textContent=D.stats.quartersDistinct;
 $('#vcount').textContent=D.stats.compartments;
 $('#area').textContent=D.stats.area.toLocaleString('ru-RU')+' га';
 $('#rcount').textContent=D.stats.referenceTables;
 $('#rrows').textContent=D.stats.referenceRows.toLocaleString('ru-RU');
 renderQuarters();renderRefs();renderQuick();renderAllTables();
}
function esc(v){if(v===null||v===undefined||v==='')return '—';return String(v).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function fmtNum(v,d=1){if(v===null||v===undefined||v==='')return '—';let n=Number(v);if(Number.isNaN(n))return esc(v);return n.toLocaleString('ru-RU',{maximumFractionDigits:d})}
function show(id){$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active');$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.s===id));scrollTo({top:0,behavior:'smooth'})}
function toast(t){let e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1600)}
function label(k){return D.fieldLabels?.[k]||k}
function decodeField(k,v){
 if(v===null||v===undefined||v==='')return '—';
 const m=D.fieldLookups?.[k];
 if(m && m[String(v)]!=null) return `${m[String(v)]}  ·  шифр ${v}`;
 return v;
}
function landName(code){return D.fieldLookups?.KU?.[String(code)]||''}
function speciesName(code){return D.fieldLookups?.POR?.[String(code)]||''}

function renderQuarters(filter=''){
 const box=$('#quarters');box.innerHTML='';
 Object.keys(D.quarters).sort((a,b)=>+a-+b).forEach(k=>{
  if(filter && !k.includes(filter.trim()))return;
  const q=D.quarters[k], a=q.compartments.reduce((s,r)=>s+(+r.PLV||0),0);
  const el=document.createElement('div');el.className='panel';
  el.innerHTML=`<div class="qhead"><span class="code">КВ ${k}</span><div class="grow"><h3>Квартал ${k}</h3><div class="qmeta">${q.compartments.length} выделов · ${fmtNum(a)} га</div></div><button class="btn2">Показать выделы</button></div><div class="comp hidden"></div>`;
  const c=el.querySelector('.comp'), b=el.querySelector('button');
  b.onclick=()=>{c.classList.toggle('hidden');b.textContent=c.classList.contains('hidden')?'Показать выделы':'Скрыть';if(!c.dataset.done){c.dataset.done=1;renderCompList(c,q.compartments)}};
  box.appendChild(el);
 });
}
function renderCompList(box,rs){
 if(!rs.length){box.innerHTML='<div class="empty">Нет выделов</div>';return}
 box.innerHTML='';
 rs.forEach((r,i)=>{
   const card=document.createElement('button');
   card.type='button';card.className='compCard';
   const cat=landName(r.KU)||`Категория угодий ${r.KU??'—'}`;
   const comp=(r.Vsost||'').trim();
   const mainSpecies=comp || (r.M3Pr?speciesName(r.M3Pr)||r.M3Pr:'');
   card.innerHTML=`<span class="compNo">№ ${esc(r.VD)}</span><span class="compText"><b>${esc(cat)}</b><small>${fmtNum(r.PLV)} га${mainSpecies?' · '+esc(mainSpecies):''}</small></span><span class="openArrow">›</span>`;
   card.addEventListener('click',()=>{current=r;renderComp();show('card')});
   box.appendChild(card);
 });
}

function section(title,keys,obj){
 const items=keys.filter(k=>obj[k]!==null&&obj[k]!==undefined&&obj[k]!=='');
 if(!items.length)return '';
 return `<div class="humanSection"><h3>${esc(title)}</h3><div class="humanGrid">${items.map(k=>`<div class="humanField"><span>${esc(label(k))}</span><b>${esc(decodeField(k,obj[k]))}</b></div>`).join('')}</div></div>`;
}
function renderComp(){
 if(!current)return;
 $('#cardTitle').textContent=`Квартал ${current.KV} · выдел ${current.VD}`;
 $('#cardSub').textContent=`${landName(current.KU)||'Категория угодий '+(current.KU??'—')} · ${fmtNum(current.PLV)} га`;
 const baseKeys=['PLV','KU','OZU','CkEk','CkKr','VNUM','ErV','ErCt'];
 const m2=['M2PM1','M2Pr','M22','M23','M2Cp'];
 const m3=['M3Pr','M3B','M3TL','M3TLU','M3G','M3KP','M3KPC'];
 const m4=['M4ZO','M4ZL','M4SS'];
 const m31=['PRkol','PRH','PRA','PRK1','PRP1','PRK2','PRP2','PRK3','PRP3'];
 const m32=['PLG','PLP1','PLP2','PLP3'];
 $('#humanContent').innerHTML =
   section('Основные сведения',baseKeys,current)+
   section('Проектируемые мероприятия · Макет 2',m2,current)+
   section('Лесорастительные условия · Макет 3',m3,current)+
   section('Захламлённость · Макет 4',m4,current)+
   section('Подрост · Макет 31',m31,current)+
   section('Подлесок · Макет 32',m32,current);

 const children=current._children||{};
 const names=Object.keys(children).sort((a,b)=>String(a).localeCompare(String(b),'ru'));
 $('#childTabs').innerHTML=`<button class="tab active" data-name="_main">Карточка</button>`+names.map(n=>`<button class="tab" data-name="${esc(n)}">${esc(n)}</button>`).join('')+`<button class="tab" data-name="_tech">Технические поля</button>`;
 $$('#childTabs .tab').forEach(btn=>btn.onclick=()=>childTab(btn.dataset.name,btn));
 $('#childContent').innerHTML='';
}
function childTab(name,btn){
 $$('#childTabs .tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
 if(name==='_main'){$('#childContent').innerHTML='';return}
 if(name==='_tech'){$('#childContent').innerHTML=`<div class="sectionTitle">Технические поля MDB</div>${renderTech(current)}`;return}
 const rs=(current._children||{})[name]||[];
 $('#childContent').innerHTML=`<div class="sectionTitle">${esc(name)}</div>`+rs.map(r=>renderChildReadable(name,r)).join('');
}
function renderChildReadable(name,r){
 if(name==='Макет10'){
   return `<div class="childBlock">${section('Таксационная характеристика древостоя',['IAR','KOEF','POR','LET','PH','PD2','KT','PROI','POL','SPS','ZAP'],r)}</div>`;
 }
 if(name==='Макет19'){
   return `<div class="childBlock">${section('Болото',['TB','TR','MTC','ZP','ZPR'],r)}</div>`;
 }
 return `<div class="childBlock">${renderReadableGeneric(r)}</div>`;
}
function renderReadableGeneric(r){
 const entries=Object.entries(r).filter(([k,v])=>!['POS','LESN','KV','KGLF','VD'].includes(k)&&v!==null&&v!==undefined&&v!=='');
 if(!entries.length)return '<div class="empty">Нет заполненных показателей</div>';
 return `<div class="humanGrid">${entries.map(([k,v])=>`<div class="humanField"><span>${esc(label(k))}</span><b>${esc(decodeField(k,v))}</b></div>`).join('')}</div>`;
}
function renderTech(obj){
 return `<div class="techGrid">${Object.entries(obj).filter(([k])=>k!=='_children').map(([k,v])=>`<div class="techField"><span>${esc(k)}</span><b>${esc(typeof v==='object'?JSON.stringify(v):v)}</b></div>`).join('')}</div>`;
}

function renderQuick(){
 const groups=[['Категории угодий · SKU','landUse'],['Древесные и кустарниковые породы · SDP','species'],['Ярусы · SIAR','tiers'],['Бонитет · SBon','bonitet'],['Тип болота · STB','bogType'],['Покрытие дороги','roadSurface']];
 $('#quickRefs').innerHTML=groups.map(([t,k])=>`<details class="refTable"><summary><b>${t}</b> · ${(D.quick[k]||[]).length}</summary><div class="refBody">${(D.quick[k]||[]).map(x=>`<div class="row"><span class="code">${esc(x.code)}</span><div class="grow">${esc(x.name)}</div></div>`).join('')}</div></details>`).join('');
}
function renderRefs(query=''){
 query=query.trim().toLowerCase();let meta=D.referenceMeta;
 if(query)meta=meta.filter(m=>m.name.toLowerCase().includes(query)||m.columns.some(c=>String(c).toLowerCase().includes(query)));
 $('#refTables').innerHTML=meta.map(m=>`<details class="refTable"><summary data-n="${encodeURIComponent(m.name)}"><b>${esc(m.name)}</b> · ${m.rows} строк</summary><div class="refBody"><div class="empty">Открой справочник</div></div></details>`).join('');
 $$('#refTables summary').forEach(s=>s.onclick=()=>loadRef(decodeURIComponent(s.dataset.n),s));
}
function loadRef(n,s){
 const b=s.parentElement.querySelector('.refBody');if(b.dataset.done)return;b.dataset.done=1;
 const rs=D.references[n]||[], cs=D.referenceSchema[n]||[];
 b.innerHTML=rs.length?rs.map(r=>`<div class="refrow"><div class="refkey">${esc(bestCode(r,cs))}</div><div class="refval">${esc(bestText(r,cs))}</div></div>`).join(''):'<div class="empty">Пустой справочник</div>';
}
function bestCode(r,cs){let c=cs.find(c=>/^(K|KU|KOD|KTB|KM|KIAR|KPC|M3B)/i.test(c)&&r[c]!=null);return c?`${r[c]}`:(cs[0]?r[cs[0]]:'')}
function bestText(r,cs){let c=cs.find(c=>/^(N|NKU|NTB|NDP|NM|NIAR|T)/i.test(c)&&typeof r[c]==='string'&&r[c].trim());if(c)return r[c];c=cs.find(c=>typeof r[c]==='string'&&r[c].trim());return c?r[c]:Object.values(r).filter(v=>v!=null).join(' · ')}
function searchEveryRef(q){
 q=q.trim().toLowerCase();if(q.length<2){$('#refSearchResults').innerHTML='';return}
 let hits=[];for(const [t,rs] of Object.entries(D.references)){for(const r of rs){let s=Object.values(r).filter(v=>v!=null&&typeof v!=='object').join(' ').toLowerCase();if(s.includes(q)){hits.push([t,r]);if(hits.length>=100)break}}if(hits.length>=100)break}
 $('#refSearchResults').innerHTML=hits.length?`<div class="sectionTitle">Найдено: ${hits.length}</div>`+hits.map(([t,r])=>`<div class="row"><span class="code">${esc(t)}</span><div class="grow"><b>${esc(bestText(r,D.referenceSchema[t]||[]))}</b><br><small>${esc(bestCode(r,D.referenceSchema[t]||[]))}</small></div></div>`).join(''):'<div class="empty">Совпадений нет</div>';
}
function renderAllTables(){$('#dbTables').innerHTML=Object.entries(D.transfTables||{}).sort().map(([n,rs])=>`<div class="row"><span class="code">${esc(n)}</span><div class="grow"><b>${rs.length} строк</b><br><small>${(D.transfSchema?.[n]||[]).join(', ')}</small></div></div>`).join('')}
function locate(){if(!navigator.geolocation){toast('GPS недоступен');return}$('#gpsText').textContent='Определяю координаты…';navigator.geolocation.getCurrentPosition(p=>{gps={lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy};$('#gpsText').textContent=`${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} · ±${Math.round(gps.acc)} м`;$('#gpsDot').style.background='#78e68b';toast('GPS-точка обновлена')},()=>{toast('Разреши геолокацию')},{enableHighAccuracy:true,timeout:10000})}
window.addEventListener('DOMContentLoaded',boot);
if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
