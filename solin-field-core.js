/* Audited field operations. No Access SQL/VBA is executed by this module. */
(()=>{'use strict';
const KEY='solin_field_checkpoint_v2', KEYS=['POS','LESN','KV','KGLF','VD'];
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=x=>JSON.parse(JSON.stringify(x));
const all=()=>Object.values(D?.quarters||{}).flatMap(q=>q.compartments||[]);
function download(name,obj){const u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
function checkpoint(reason){const before=JSON.parse(localStorage.getItem(KEY)||'null');const history=(before?.history||[]).slice(-49);history.push({at:new Date().toISOString(),reason,records:all().length});const next={format:'SOLIN-Field-Backup-v2',at:new Date().toISOString(),quarters:clone(D.quarters),lesnichestvo:clone(D.lesnichestvo),source:clone(D.source),extraTables:clone(D._transferExtras||{}),history};localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new CustomEvent('solin-saved',{detail:next}));return next;}
function validateBackup(x){
 if(x?.format!=='SOLIN-Field-Backup-v2'||!x.quarters||Array.isArray(x.quarters)||typeof x.quarters!=='object')throw Error('Неверный формат резервной копии v2');
 let count=0;for(const [k,q] of Object.entries(x.quarters)){if(!/^\d+$/.test(k)||!Array.isArray(q.compartments))throw Error('Некорректный квартал '+k);const seen=new Set();for(const r of q.compartments){if(!r||String(r.KV)!==String(k)||(r.VD==null||typeof r.VD==='object'||String(r.VD).trim()==='')||!Number.isFinite(Number(r.PLV))||Number(r.PLV)<=0)throw Error('Некорректный адрес или площадь в квартале '+k);const id=KEYS.map(f=>r[f]??'').join(':');if(seen.has(id))throw Error('Дублирующийся адрес '+id);seen.add(id);for(const [m,rows] of Object.entries(r._children||{})){if(!D.transfSchema[m]||!Array.isArray(rows)||rows.some(v=>!v||typeof v!=='object'||Array.isArray(v)))throw Error('Некорректный макет '+m);}count++;}}
 if(!count&&!x.lesnichestvo?.[0]?.NOS)throw Error('В пустой копии не указано лесничество');return count;
}
function commitImport(x){if(x.lesnichestvo?.[0]&&window.SolinWorkspace?.activeId&&[x.lesnichestvo[0].POS,x.lesnichestvo[0].LESN].join('::')!==SolinWorkspace.activeId)throw Error('Эта копия относится к другому лесничеству. Загрузите её через главное окно');const n=validateBackup(x);localStorage.setItem(KEY,JSON.stringify({...x,history:[...(x.history||[]).slice(-49),{at:new Date().toISOString(),reason:'Импорт',records:n}]}));D.quarters=clone(x.quarters);D._transferExtras=clone(x.extraTables||{});for(const k of ['solin_field_audited_work_v1','solin_user_data_v1','solin_field_overrides_v3'])localStorage.removeItem(k);current=null;refresh();show('quartersScreen');closeModal();window.dispatchEvent(new Event('solin-saved'));toast('Восстановлено выделов: '+n);}
window.solinExportEdits=()=>{try{download('solin-field-backup-v2.json',checkpoint('Резервная копия'))}catch(e){toast('Не удалось создать копию: '+e.message)}};
window.solinSaveGPS=async()=>{
 const record=current;if(!record)return;
 const saved=()=>D.quarters?.[String(record.KV)]?.compartments?.includes(record);
 if(!saved())return toast('Сначала сохраните выдел.');
 try{
  toast('Ищу спутники GPS…');
  const position=await window.SolinLocation.current();
  if(current!==record||!saved())return;
  const {latitude,longitude,accuracy}=position.coords;
  const before=record._gps;
  record._gps={latitude,longitude,accuracy,at:new Date().toISOString()};
  try{checkpoint('GPS '+record.KV+'-'+record.VD);}
  catch(error){record._gps=before;throw error;}
  openModal('GPS выдела','<p>'+h(latitude)+', '+h(longitude)+
   (Number.isFinite(accuracy)?' · точность ±'+Math.round(accuracy)+' м':'')+'</p>');
 }catch(error){if(current===record&&saved())toast('GPS не сохранён: '+error.message);}
};
window.solinImportEdits=()=>{const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>30*1024*1024)throw Error('Файл больше 30 МБ');const x=JSON.parse(await file.text()),n=validateBackup(x);openModal('Предпросмотр восстановления','<p>Кварталов: '+Object.keys(x.quarters).length+'; выделов: '+n+'.</p><p>Текущие карточки будут заменены. Скачайте копию текущего состояния перед подтверждением.</p><button id="backupBefore">Скачать текущую копию</button><button id="commitImport" class="primary">Восстановить</button>');document.querySelector('#backupBefore').onclick=solinExportEdits;document.querySelector('#commitImport').onclick=()=>{try{commitImport(x)}catch(e){toast(e.message)}};}catch(e){toast(e.message)}};input.click()};
window.exportTransfer=()=>{if(!D)return toast('Данные загружаются');const tables={...clone(D._transferExtras||{}),...Object.fromEntries(Object.keys(D.transfSchema).map(k=>[k,[]]))};tables['Лесничество']=clone(D.lesnichestvo||[]);for(const [kv,q]of Object.entries(D.quarters)){for(const qr of q.quarterRows?.length?q.quarterRows:[q.meta||{}]){const merged={...D.lesnichestvo?.[0],...qr,KV:Number(kv)};tables['Квартал'].push(Object.fromEntries(D.transfSchema['Квартал'].map(k=>[k,merged[k]??null])));}for(const r of q.compartments){const address={};for(const k of KEYS)address[k]=r[k]??q.meta?.[k]??D.lesnichestvo?.[0]?.[k]??null;tables['Выдел'].push({...Object.fromEntries(Object.entries(r).filter(([k])=>!k.startsWith('_'))),...Object.fromEntries(D.transfSchema['Выдел'].map(k=>[k,address[k]??r[k]??null]))});for(const [m,rows]of Object.entries(r._children||{}))if(tables[m])for(const row of rows)tables[m].push({...row,...address});}}download('SOLIN-Transfer-review.json',{format:'SOLI-N Transfer',schemaVersion:2,scope:'all-current-records',createdAt:new Date().toISOString(),desktopImportVerified:false,tables});};
// Unsupported expressions and absent form context stay explicitly unverified.
function rule(expression,value,ctx){return SolinAccessExpression.rule(expression,value,ctx,ctx.__parent||ctx);}
function controls(r){const results=[];for(const v of SOLIN_AUDIT.validations){let rows;if(v.form==='ВыделВ')rows=[r];else if(D.transfSchema[v.form])rows=r._children?.[v.form]||[];else continue;rows.forEach((row,i)=>{let status,detail='';try{const ok=rule(v.rule,row[v.source],{...r,...row,__parent:r});status=ok===false?'Ошибка':ok===null?'NULL · не отклоняет запись Access':'Пройден';}catch(e){status='Не проверено';detail=e.message;}results.push({...v,row:i+1,status,detail});});}return results;}
function showControls(records=all()){const result=records.flatMap(r=>controls(r).map(x=>({...x,kv:r.KV,vd:r.VD})));const bad=result.filter(x=>x.status==='Ошибка'),skipped=result.filter(x=>x.status==='Не проверено');openModal('Контроль по оригинальным ValidationRule','<p>Ошибок: '+bad.length+'; не проверено: '+skipped.length+'; всего применений: '+result.length+'.</p><p>Это правила полей Access, не набор К01–К142. NULL учитывается отдельно. Условия с неизвестным контекстом не объявляются пройденными.</p><button id="controlExport">Скачать протокол JSON</button>'+result.filter(x=>x.status!=='Пройден').map(x=>'<div class="wf-check '+(x.status==='Ошибка'?'bad':'warn')+'"><b>'+h(x.kv+'-'+x.vd+' · '+x.form+' · '+x.source+' #'+x.row)+'</b><br>'+h(x.rule)+'<br>'+h(x.status+' '+x.detail)+'</div>').join(''));document.querySelector('#controlExport').onclick=()=>download('solin-controls.json',{kind:'Access-ValidationRule-subset',results:result});return result;}
function auditSearch(q=''){const target=document.querySelector('#auditResults');q=q.toLowerCase();target.innerHTML=Object.entries(SOLIN_AUDIT.routes).filter(([f,buttons])=>(f+' '+buttons.map(x=>x.caption).join(' ')).toLowerCase().includes(q)).map(([f,buttons])=>'<details class="refCard"><summary>'+h(f)+' · '+buttons.length+' кнопок</summary>'+buttons.map(b=>'<div class="wf-check"><b>'+h(b.caption||b.name)+'</b><br>'+h(b.onClick)+' · '+h(b.status)+'<pre style="white-space:pre-wrap">'+h(JSON.stringify(b.actions||b.actionStatements||b.code||[],null,2))+'</pre></div>').join('')+'</details>').join('');}
function audit(){openModal('554 формы · исходные маршруты и выражения','<p>Каталог исходных определений. Просмотр не исполняет VBA, SQL или макросы. 30 ссылок на макросы остаются неразрешёнными. Формулы: 611; правила: 203.</p><input id="auditQuery" placeholder="Форма или подпись кнопки"><div id="auditResults"></div>');document.querySelector('#auditQuery').oninput=e=>auditSearch(e.target.value);auditSearch('ГОЛОВНОЕ МЕНЮ');}
function filter(){
 const skip = new Set(['POS','LESN','KV','KGLF','VD']);
 const schema = D.transfSchema || {};
 const source = all();
 const columns = [];
 const add = (form, fields) => {
  const labelForm = form==='Выдел'?'ВыделВ':form;
  for(const field of new Set(fields)){
   const type=window.SolinFieldTypes?.type(labelForm,field)||window.SolinFieldTypes?.type(form,field);
   const label=window.SolinHuman?.label(labelForm,field)||D.fieldLabels?.[field]||field;
   columns.push({form,field,label,labelForm,numeric:['integer','long','float','double','numeric','currency','byte'].includes(type)});
  }
 };
 add('Выдел',['KV','VD','KU','KGLF','M3Pr','PLV','STUR1','STUR','Vsost',
  ...(schema.Выдел||[]),...source.flatMap(row=>Object.keys(row).filter(key=>!key.startsWith('_')))]);
 const children=new Map();
 for(const [form,fields] of Object.entries(schema)){
  if(/^Макет\d+$/.test(form))children.set(form,new Set(fields.filter(field=>!skip.has(field))));
 }
 for(const stand of source)for(const [form,rows] of Object.entries(stand._children||{})){
  if(!/^Макет\d+$/.test(form))continue;
  if(!children.has(form))children.set(form,new Set());
  for(const row of rows)for(const field of Object.keys(row)){
   if(!skip.has(field)&&!field.startsWith('_'))children.get(form).add(field);
  }
 }
 for(const [form,fields] of [...children].sort(([a],[b])=>a.localeCompare(b,'ru',{numeric:true})))add(form,fields);
 openModal('Фильтрация данных','<div class="field-filter-v50"><div id="filterRules"></div><div class="formActions"><button type="button" id="filterAdd">＋ Условие</button><button type="button" id="filterRun" class="primary">Найти выделы</button></div><p id="filterSummary" role="status"></p><div id="filterResult"></div></div>');
 const root=document.getElementById('filterRules');
 const summary=document.getElementById('filterSummary');
 const results=document.getElementById('filterResult');
 const text=value=>String(value??'').trim().toLocaleLowerCase('ru');
 const number=value=>text(value)===''?NaN:Number(text(value).replace(',','.'));
 const lookup=column=>window.SolinHuman?.lookup(column.labelForm,column.field)||D.fieldLookups?.[column.field]||{};
 let ruleId=0;
 function addRule(){
  const row=document.createElement('div');
  row.className='field-filter-rule';
  const field=document.createElement('select');
  field.setAttribute('aria-label','Поле для фильтрации');
  field.add(new Option('Выберите поле',''));
  const groups=new Map();
  for(const [index,column] of columns.entries()){
   if(!groups.has(column.form)){
    const group=document.createElement('optgroup');
    group.label=column.form==='Выдел'?'Поля выдела':column.form.replace('Макет','Макет ');
    groups.set(column.form,group);
    field.append(group);
   }
   groups.get(column.form).append(new Option(column.label+(column.label===column.field?'':' · '+column.field),String(index)));
  }
  const operator=document.createElement('select');
  operator.setAttribute('aria-label','Условие сравнения');
  const input=document.createElement('input');
  input.setAttribute('aria-label','Значение фильтра');
  input.placeholder='Код, название или число';
  const choices=document.createElement('datalist');
  choices.id='filter-options-'+(++ruleId);
  input.setAttribute('list',choices.id);
  const remove=document.createElement('button');
  remove.type='button';remove.textContent='Убрать';remove.onclick=()=>row.remove();
  field.onchange=()=>{
   const column=field.value===''?null:columns[Number(field.value)];
   operator.replaceChildren(new Option('Равно','eq'),...(column?.numeric
    ? [new Option('Не меньше','min'),new Option('Не больше','max')]
    : [new Option('Содержит','contains')]));
   const entries=column?Object.entries(lookup(column)):[];
   choices.replaceChildren(...entries.map(([code,name])=>new Option(String(name),code)));
   input.inputMode=column?.numeric&&!entries.length?'decimal':'text';
  };
  field.onchange();
  row.append(field,operator,input,remove,choices);
  root.append(row);
 }
 function matches(rule,row){
  const {column,op,value}=rule;
  const actual=row[column.field];
  if(actual==null||actual==='')return false;
  const named=lookup(column)[String(actual)];
  if(column.numeric){
   const a=number(actual),b=number(value);
   if(!Number.isFinite(b))return op==='eq'&&text(named)===value;
   if(!Number.isFinite(a))return false;
   return op==='min'?a>=b:op==='max'?a<=b:Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b));
  }
  const values=[text(actual),text(named)].filter(Boolean);
  return values.some(candidate=>op==='contains'?candidate.includes(value):candidate===value);
 }
 function run(){
  const groups=new Map();
  for(const row of root.children){
   const [field,op]=row.querySelectorAll('select');
   const input=row.querySelector('input'),value=text(input.value);
   if(field.value===''&&!value)continue;
   const column=field.value===''?null:columns[Number(field.value)];
   const namedValue=column&&op.value==='eq'&&Object.values(lookup(column)).some(name=>text(name)===value);
   if(!column||!value||(column.numeric&&!namedValue&&!Number.isFinite(number(value)))){
    summary.textContent='Укажите поле и корректное значение для каждого условия.';
    results.replaceChildren();
    return;
   }
   if(!groups.has(column.form))groups.set(column.form,[]);
   groups.get(column.form).push({column,op:op.value,value});
  }
  const found=source.filter(stand=>[...groups].every(([form,rules])=>{
   const rows=form==='Выдел'?[stand]:stand._children?.[form]||[];
   return rows.some(row=>rules.every(rule=>matches(rule,row)));
  }));
  summary.textContent='Найдено выделов: '+found.length;
  renderCompList(results,found);
  for(const button of results.querySelectorAll('.compCard'))button.addEventListener('click',closeModal,{capture:true});
 }
 document.getElementById('filterAdd').onclick=addRule;
 document.getElementById('filterRun').onclick=run;
 root.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT'){event.preventDefault();run();}});
 addRule();
}

function refs(q=''){if(!D)return;const box=document.querySelector('#friendlyRefs');box.innerHTML=Object.entries(D.fieldLookups).filter(([k,v])=>!q||(k+' '+Object.values(v).join(' ')).toLowerCase().includes(q.toLowerCase())).map(([k,v])=>'<details class="refCard"><summary>'+h(D.fieldLabels[k]||k)+' · '+Object.keys(v).length+'</summary>'+Object.entries(v).filter(([c,n])=>!q||(k+' '+c+' '+n).toLowerCase().includes(q.toLowerCase())).map(([c,n])=>'<div class="refRow"><b>'+h(c)+'</b> '+h(n)+'</div>').join('')+'</details>').join('');}
async function loadRefs(){try{let res=await fetch(window.Capacitor?.isNativePlatform?.()?'./refs-audit.packed.bin':'./refs-audit.json.gz');if(!res.ok&&window.Capacitor?.isNativePlatform?.())res=await fetch('./refs-audit.json.gz');if(!res.ok)throw Error('HTTP '+res.status);window.SOLIN_REFS=JSON.parse(await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text());await window.SolinReferenceSupplement?.load?.(window.SOLIN_REFS);const byCode=new Map(SOLIN_REFS.tables.SDP.map(r=>[r.KPC,r]));SOLIN_REFS.tables.SDP_Tip=SOLIN_REFS.tables.SDP_Tip.map(r=>({...byCode.get(r.KPC),...r}));D.stats.referenceTables=Object.keys(SOLIN_REFS.tables).length;document.querySelector('#rcount').textContent=D.stats.referenceTables;D.scopedLookups={};for(const x of window.SOLIN_LOOKUP_SOURCES||[]){const rows=SOLIN_REFS.tables[x.table];if(!rows)continue;(D.scopedLookups[x.form]??={})[x.field]=Object.fromEntries(rows.filter(r=>r[x.code]!=null&&r[x.label]!=null).map(r=>[r[x.code],r[x.label]]));}window.performance?.mark?.('solin-refs-load-done');window.dispatchEvent(new Event('solin-refs-ready'));}catch(e){toast('Полные справочники недоступны: '+e.message)}}
function auditedRefs(q=''){if(!window.SOLIN_REFS)return refs(q);const box=document.querySelector('#friendlyRefs');box.innerHTML='<p>153 исходные таблицы S* и вычисленный SDP_Tip · 24 946 строк. Динамические ограничения списков Access здесь не исполняются.</p>';for(const [name,table]of Object.entries(SOLIN_REFS.tables).sort(([a],[b])=>a.localeCompare(b))){const rows=q?table.filter(r=>(name+' '+Object.values(r).join(' ')).toLowerCase().includes(q.toLowerCase())):table;if(!rows.length)continue;const details=document.createElement('details');details.className='refCard';details.innerHTML='<summary>'+h(refNames[name]||name)+' · '+rows.length+'</summary>';let count=0,host;function more(){const slice=rows.slice(count,count+100);count+=slice.length;host.insertAdjacentHTML('beforeend',slice.map(r=>'<div class="wf-check">'+Object.entries(r).filter(([,v])=>v!=null&&v!=='').map(([k,v])=>'<span>'+h(k)+': <b>'+h(v)+'</b></span>').join(' · ')+'</div>').join(''));details.querySelector('.refMore')?.remove();if(count<rows.length){const b=document.createElement('button');b.className='refMore';b.textContent='Ещё 100';b.onclick=more;details.append(b);}}details.ontoggle=()=>{if(details.open&&!host){host=document.createElement('div');details.append(host);more();}};box.append(details);}}
function formulas(){openModal('611 исходных выражений Access','<p>Сохранённые определения из аудита. Выполнение в контексте Access ещё не воспроизведено.</p><input id="formulaQuery" placeholder="Форма или выражение"><div id="formulaRows"></div>');const draw=q=>{document.querySelector('#formulaRows').innerHTML=SOLIN_AUDIT.formulas.filter(x=>(x.form+' '+x.name+' '+x.expression).toLowerCase().includes(q.toLowerCase())).map(x=>'<div class="wf-check"><b>'+h(x.form+' / '+x.name)+'</b><pre style="white-space:pre-wrap">'+h(x.expression)+'</pre></div>').join('')};document.querySelector('#formulaQuery').oninput=e=>draw(e.target.value);draw('ВыделВ');}
function editQuarter(k,index=0){
 const q=D.quarters?.[k];if(!q)return toast('Квартал не найден.');
 const rows=q.quarterRows?.length?q.quarterRows:[q.meta||{}];
 const sourceRows=clone(rows);let selected=rows[index];
 if(!selected)return toast('Строка обложки не найдена.');
 const fields=D.transfSchema['Квартал'].filter(f=>!['POS','LESN','KV','KGLF'].includes(f));
 openModal('Корректировка квартала '+k,'<div id="quarterEditor"><label class="wf-field">Обложка квартала<select id="quarterCategory">'+
  rows.map((r,i)=>'<option value="'+i+'" '+(i===index?'selected':'')+'>КГЛФ '+h(r.KGLF)+
    ' · Функ. зона '+h(r.Fzona??'—')+' · ЛХЗ '+h(r.Klxr??'—')+'</option>').join('')+
  '</select></label>'+fields.map(f=>'<label class="wf-field">'+h(D.fieldLabels[f]||f)+
    '<input data-qfield="'+f+'" value="'+h(selected[f]??'')+'"></label>').join('')+
  '<button type="button" id="saveQuarter" class="primary">Сохранить</button></div>');// Never recreate the modal from an iOS native select change event.
// Shared Access RowSource picker: Kpz + original KTO/Szap region.
 // Unlike a datalist, it cannot show the unrestricted Slxr table.
 let zoneInput=document.querySelector('#modalBody [data-qfield="Klxr"]');
 let kpzInput=document.querySelector('#modalBody [data-qfield="Kpz"]');
 const natural=window.SolinDependentRules?.options('Квартал','Kpz',selected,null,D.lesnichestvo?.[0]);
 if(natural?.status==='complete')
  kpzInput=window.SolinDependentRules.applySelect(kpzInput,natural,{current:kpzInput?.value})||kpzInput;
 const zoneHint=document.createElement('p');
 zoneHint.className='wf-form-note';zoneHint.setAttribute('aria-live','polite');
 zoneInput?.parentElement?.insertAdjacentElement('afterend',zoneHint);
 const updateZoneHint=()=>{
  if(!zoneInput)return;
  const rules=window.SolinDependentRules;
  if(!rules){zoneHint.textContent='Нет исходных зависимых справочников SOLI-N';return;}
  const current=zoneInput.value,org=D.lesnichestvo?.[0]||{};
  const result=rules.options('Квартал','Klxr',{...selected,Kpz:kpzInput?.value},null,org);
  if(!result){zoneHint.textContent='Не удалось прочитать исходные правила выбора зоны';return;}
  zoneInput=rules.applySelect(zoneInput,result,{current})||zoneInput;
  zoneHint.textContent=result.reason+(current&&rules.currentIsAllowed(current,result)===false?
   '. Сохранённый код '+current+' отсутствует среди допустимых для этой области; уточните зону по исходным данным.':'');
 };
 document.querySelector('#quarterEditor').addEventListener('input',e=>{
  if(e.target===kpzInput||e.target===zoneInput)updateZoneHint();
 });
 document.querySelector('#quarterEditor').addEventListener('change',e=>{
  if(e.target===kpzInput||e.target===zoneInput)updateZoneHint();
 });
 updateZoneHint();
 // SFZ.KLF is visible in the archived Access source, but the original
 // WHERE tail is incomplete. Offer only linked SFZ candidates in a
 // datalist while retaining manual edit; never claim normative validation.
 const functionInput=document.querySelector('#modalBody [data-qfield="Fzona"]');
 const districtInput=document.querySelector('#modalBody [data-qfield="Raion"]');
 const functionHint=document.createElement('p'),districtHint=document.createElement('p');
 functionHint.className='wf-form-note';districtHint.className='wf-form-note';
 functionHint.setAttribute('aria-live','polite');districtHint.setAttribute('aria-live','polite');
 functionInput?.parentElement?.append(functionHint);districtInput?.parentElement?.append(districtHint);
 const picker=window.SolinQuarterPickers;
 const functionalPicker=picker?.mount(functionInput,'Fzona',()=>selected,
  {current:selected.Fzona,org:()=>D.lesnichestvo?.[0],hint:functionHint});
 const districtPicker=picker?.mount(districtInput,'Raion',()=>selected,
  {current:selected.Raion,org:()=>D.lesnichestvo?.[0],hint:districtHint});
 const refreshIncompleteRows=()=>{
  functionalPicker?.sync({value:selected.Fzona??''});
  districtPicker?.sync({value:selected.Raion??''});
 };
 document.querySelector('#quarterCategory').onchange=e=>{
  const nextIndex=Number(e.target.value);
  if(!rows[nextIndex])return;
  index=nextIndex;selected=rows[index];
  for(const input of document.querySelectorAll('#modalBody [data-qfield]')){
   if(input.__solinQuarterPicker)continue;
   input.value=selected[input.dataset.qfield]??'';
  }
  updateZoneHint();
  refreshIncompleteRows();
 };document.querySelector('#saveQuarter').onclick=()=>{
 if(D.quarters?.[k]!==q)return toast('Квартал изменился. Откройте его заново.');
 const before=clone(q),next={...selected};for(const el of document.querySelectorAll('#modalBody [data-qfield]')){
  const value=String(window.SolinQuarterPickers?.value(el)??el.value).trim();
  if(['Raion','Fzona'].includes(el.dataset.qfield)&&value&&!/^\d+$/.test(value)){
   toast('Укажите числовой код: '+(D.fieldLabels[el.dataset.qfield]||el.dataset.qfield));return;
  }
  const field=el.dataset.qfield;
  if(value===String(selected[field]??''))continue;
  next[field]=['Fzona','Raion'].includes(field)?(value===''?null:Number(value)):(value||null);
 }const regionCheck=window.SolinQuarterPickers?.validateDistrict?.(next.Raion,D.lesnichestvo?.[0]);
 if(String(next.Raion??'')!==String(selected.Raion??'')&&
    ['invalid','mismatch'].includes(regionCheck?.status)){
  toast(regionCheck.reason);return;
 }
 const fzonaChanged=String(next.Fzona??'')!==String(selected.Fzona??'');
 if(fzonaChanged&&next.Fzona!=null){
  const list=window.SolinDependentRules?.functionalZones(next);
  if(!list||window.SolinDependentRules.currentIsAllowed(next.Fzona,list)!==true){toast('Выберите функциональную зону из исходного списка этой категории ГЛФ.');return;}
 }
 const zoning=window.SolinDependentRules?.options('Квартал','Klxr',next,null,D.lesnichestvo?.[0]);
 const zoningChanged=String(next.Kpz??'')!==String(selected.Kpz??'')||
  String(next.Klxr??'')!==String(selected.Klxr??'');
 if(zoningChanged&&next.Klxr!=null&&window.SolinDependentRules?.currentIsAllowed(next.Klxr,zoning)!==true){
  toast('Лесохозяйственная зона не соответствует природной зоне и нормативам области. Выберите доступный код из исходного списка.');return;
 }
 if(q.quarterRows?.length)q.quarterRows[index]=next;else q.meta=next;
 // Match against an immutable BEFORE snapshot of the selected quarter row.
 // Other explicit stand zones and all other quarter categories remain unchanged.
 const oldRow=sourceRows[index]; // Preserve original Klxr BEFORE iOS select change/blur mutates bound row.
 const inheritedCount=window.SolinAddressContext?.cascadeQuarterZone(q,oldRow,next)||0;
 try{checkpoint('Корректировка квартала '+k+' KGLF '+selected.KGLF);
  closeModal();openQuarter(k,next.KGLF);
  if(inheritedCount)toast('Зона Klxr обновлена у '+inheritedCount+' выделов; пересохраните макет 10 для расчёта запаса');
 }catch(e){D.quarters[k]=before;toast('Не сохранено: '+e.message)}};}
window.solinEditQuarter=editQuarter;
window.renderFriendlyRefs=auditedRefs;
function setup(){const menu=document.querySelector('#menuScreen .workspace');for(const [label,fn]of [['Каталог 554 форм и 1420 кнопок',audit],['Лесовладелец и лесничество',()=>openModal('Адрес текущей базы','<pre>'+h(JSON.stringify(D.lesnichestvo,null,2))+'</pre>')],['Журнал изменений',()=>openModal('Журнал', '<pre>'+h(JSON.stringify(JSON.parse(localStorage.getItem(KEY)||'{}').history||[],null,2))+'</pre>')]]){const b=document.createElement('button');b.className='menuRow';b.textContent=label+' ›';b.onclick=fn;menu.append(b);}
 const oldRender=window.renderComp;window.renderComp=function(){oldRender();const bar=document.querySelector('#wfCardActions .v25-card-actions-more > div');if(bar){for(const [label,fn]of [['Фото',solinOpenPhoto],['GPS',solinSaveGPS]]){const x=document.createElement('button');x.textContent=label;x.onclick=fn;bar.append(x);}}};
 const oldSave=window.saveLocal;window.saveLocal=function(){try{checkpoint('Создание квартала / выдела')}catch(e){const last=JSON.parse(localStorage.getItem(KEY)||'null');if(last)D.quarters=last.quarters;refresh();throw e;}};
 const oldQuarter=window.openQuarter;
 window.openQuarter=function(k,selectedKGLF,...args){
  oldQuarter(k,selectedKGLF,...args);
  const bar=document.querySelector('#wfQuarterToolbar');
  if(!bar)return;
  const button=document.createElement('button');
  button.type='button';button.textContent='Корректировка квартала';
  button.onclick=()=>{
   const q=D.quarters?.[k];if(!q)return toast('Квартал не найден.');
   const rows=q.quarterRows?.length?q.quarterRows:[q.meta||{}];
   const index=selectedKGLF==null?0:rows.findIndex(row=>String(row.KGLF)===String(selectedKGLF));
   if(index<0)return toast('У КГЛФ '+selectedKGLF+' отсутствует обложка квартала.');
   editQuarter(k,index);
  };
  bar.append(button);
 };
 const formulaButton=document.createElement('button');formulaButton.className='menuRow';formulaButton.textContent='Исходные 611 выражений Access ›';formulaButton.onclick=formulas;menu.append(formulaButton);
 const oldShow=window.showCmfSheet;window.showCmfSheet=function(f,ll,layer){oldShow(f,ll,layer);const button=document.querySelector('.wf-card-from-map');if(!button)return;button.onclick=()=>{const k=cmfStandKeys(f),p=f.properties||{};let matches=all().filter(r=>Number(r.KV)===Number(k.kv)&&standNumber(r.VD)===standNumber(k.vd)&&!!standNumber(k.vd));for(const key of ['POS','LESN','KGLF'])if(p[key]!=null)matches=matches.filter(r=>String(r[key]??D.lesnichestvo?.[0]?.[key])===String(p[key]));if(matches.length!==1)return toast(matches.length?'Неоднозначный адрес: уточните POS / LESN / KGLF':'Выдел отсутствует в текущей базе');closeCmfSheet();current=matches[0];renderComp();show('card');};};
}
function validateRow(form,row,parent){return SOLIN_AUDIT.validations.filter(v=>v.form===form).flatMap(v=>{try{return rule(v.rule,row[v.source],{...parent,...row,__parent:parent})===false?[v.source+': '+v.rule]:[]}catch{return []}});}
window.solinCore={checkpoint,validateBackup,commitImport,controls,rule,showControls,validateRow,filter};
let refsNeedRender=true;
window.solinEnsureRefsRendered=()=>{
 const panel=document.querySelector('#friendlyRefs');
 if(!panel||!D)return;
 if(!refsNeedRender&&panel.childElementCount)return;
 refsNeedRender=false;
 if(window.SOLIN_REFS)auditedRefs();
 else refs();
};
window.addEventListener('solin-refs-ready',()=>{
 refsNeedRender=true;
 if(document.querySelector('#refsScreen.active'))window.solinEnsureRefsRendered();
});
window.addEventListener('solin-ready',()=>{
 try{
  // The forest workspace owns startup reconciliation and backup recovery.
  // Reapplying the same JSON checkpoint here previously cloned/re-rendered
  // hundreds of stands a second time before main menu became responsive.
  if(!window.SolinWorkspace){
   const data=JSON.parse(localStorage.getItem(KEY)||'null');
   if(data){
    validateBackup(data);
    D.quarters=data.quarters;
    if(data.lesnichestvo?.length)D.lesnichestvo=data.lesnichestvo;
    if(data.source)D.source=data.source;
    D._transferExtras=data.extraTables||{};
    refresh();
   }
   refs();
  }
  const launch=()=>{window.performance?.mark?.('solin-refs-load-start');void loadRefs();};
  const afterFirstFrame=()=>{
   if(typeof window.requestIdleCallback==='function')
    window.requestIdleCallback(launch,{timeout:2200});
   else setTimeout(launch,350);
  };
  if(window.SolinWorkspace?.ready)
   window.SolinWorkspace.ready.then(afterFirstFrame,afterFirstFrame);
  else afterFirstFrame();
 }catch(e){toast('Не удалось восстановить копию: '+e.message);}
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
