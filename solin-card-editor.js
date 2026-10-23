/* Taxation card editor. Makets 1–5, 31 and 32 belong to the stand row.
 * Address fields stay fixed; quarter metadata is scoped by the full address.
 * All editing uses a draft until the single Save action succeeds. */
(()=>{'use strict';
const keys=['POS','LESN','KV','KGLF','VD'];
const sections=[
 ['1','Условия участка',['OZU','CkEk','CkKr','VNUM','ErV','ErCt']],
 ['2','Хозяйственные мероприятия',['M2PM1','M2Pr','M22','M23','M2Cp']],
 ['3','Лесорастительная характеристика',['M3Pr','M3B','M3TLU','M3G','M3KP','M3KPC']],
 ['4','Захламлённость и сухостой',['M4ZO','M4ZL','M4SS']],
 ['5','Возраст и запас',['AKL','AGR','AGR1','STUR','STUR1']],
 ['31','Подрост',['PRkol','PRH','PRA','PRK1','PRP1','PRK2','PRP2','PRK3','PRP3']],
 ['32','Подлесок',['PLG','PLP1','PLP2','PLP3']]
];
const extras=[11,12,13,14,15,16,17,19,20,21,23,25,27,28];
const numeric=new Set(['PLV','GodT','CkKr','VNUM','M2Pr','M3G','M3KP','M3KPC','M4ZO','M4ZL','M4SS','AKL','AGR','AGR1','STUR','STUR1','PRkol','PRH','PRA','PRK1','PRK2','PRK3','KOEF','LET','PH','PD2','KT','POL','SPS','ZAP','RAS','Koef16','Voz16','H16','Ur16','Sbor','VZ','SHR','PRT','SHT','KLD','PR','PL','PL15','PTR1','PTR2','PTR3','PTR4','ZPR','STUR1','KOL','AV','ZO','LIK','DEL','PLP','MTC','G15','GZ']);
const aliases={PRkol:'Количество, тыс. шт.',PRH:'Средняя высота, м',PRA:'Средний возраст, лет',PRK1:'Коэффициент 1',PRK2:'Коэффициент 2',PRK3:'Коэффициент 3',PRP1:'Порода 1',PRP2:'Порода 2',PRP3:'Порода 3',PLP1:'Порода 1',PLP2:'Порода 2',PLP3:'Порода 3',PLG:'Густота',AGR1:'Группа возраста ТО',M2Pr:'Процент выборки, %'};
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
const same=(a,b)=>String(a??'')===String(b??'');
let session=null,previousFocus=null,previousOverflow='';
const title=(form,f)=>aliases[f]||SolinHuman.label(form,f);
function input(form,field,value,scope,index){
 const id='ce_'+scope+'_'+(index??'base')+'_'+field;
 const fragment=document.createElement('div');
 const shown=numeric.has(field)&&typeof value==='number'?value.toLocaleString('ru-RU',{useGrouping:false,maximumFractionDigits:6}):value;
 fragment.innerHTML=SolinHuman.input(field,shown??'',id,form);
 const label=fragment.firstElementChild,el=label.querySelector('input,select');
 const caption=SolinHuman.isTechnical(form,field)?D.fieldLabels?.[field]||field:title(form,field);
 label.className='ce-field';label.querySelector('span').textContent=caption;
 el.id=id;el.dataset.ceField=field;el.dataset.ceScope=scope;
 el.setAttribute('aria-label',caption);el.removeAttribute('data-wffield');
 if(index!=null)el.dataset.ceRow=index;
 if(numeric.has(field)&&el.tagName==='INPUT')el.inputMode='decimal';
 return label.outerHTML;
}
function fields(form,names,values,scope){return names.map(f=>input(form,f,values[f],scope)).join('');}
function context(label,value,code,wide=false){return '<div class="ce-context-field'+(wide?' ce-wide':'')+'"><span>'+h(label)+'</span><div>'+(code!=null?'<small>'+h(code)+'</small>':'')+'<b>'+h(value??'Не указано')+'</b></div></div>';}
function block(number,name,body,note=''){return '<section class="ce-section" id="ce-section-'+number+'" aria-labelledby="ce-title-'+number+'"><div class="ce-section-head"><h3 id="ce-title-'+number+'"><span>Макет '+number+'</span>'+h(name)+'</h3></div>'+body+(note?'<p class="ce-note">'+h(note)+'</p>':'')+'</section>';}
function table(form){const rs=session.draft._children[form]||[],schema=(D.transfSchema[form]||[]).filter(f=>!keys.includes(f));
 const number=form.replace('Макет','');
 return '<div class="ce-section-head ce-table-actions"><p><b data-ce-count="'+h(form)+'">'+rs.length+'</b> записей</p><div>'+(form==='Макет10'?'<button type="button" class="ce-table-toggle" aria-pressed="false">Таблица</button>':'')+'<button type="button" class="ce-add" data-ce-add="'+h(form)+'">＋ Строка</button></div></div>'+
 (rs.length?'<div class="ce-table-wrap" tabindex="0" aria-label="Строки макета '+number+'"><table class="ce-table"><caption class="ce-sr-only">Макет '+number+' — '+h(SolinHuman.formName(form))+'</caption><thead><tr><th scope="col">№</th>'+schema.map(f=>'<th scope="col">'+h(SolinHuman.label(form,f))+'</th>').join('')+'<th scope="col">Действия</th></tr></thead><tbody>'+rs.map((row,i)=>'<tr><th scope="row"><span>Запись </span>'+(i+1)+'</th>'+schema.map(f=>'<td>'+input(form,f,row[f],form,i)+'</td>').join('')+'<td class="ce-delete-cell"><button type="button" data-ce-delete="'+h(form)+'" data-ce-index="'+i+'" aria-label="Удалить запись '+(i+1)+' макета '+number+'">Удалить</button></td></tr>').join('')+'</tbody></table></div>':'<div class="ce-empty">Записей пока нет. Нажмите «＋ Строка», чтобы добавить.</div>');
}
function markup(){const s=session,r=s.draft,o=D.lesnichestvo?.find(x=>same(x.POS,r.POS)&&same(x.LESN,r.LESN))||D.lesnichestvo?.[0]||{};
 const known=new Set([...keys,'Fzona','PLV','KU','CR','KlxrVD',...sections.flatMap(x=>x[2])]);
 const rest=(D.transfSchema['Выдел']||[]).filter(f=>!known.has(f));
 return '<form id="ce-form" novalidate><div class="ce-summary"><div><span>КАРТОЧКА ТАКСАЦИИ</span><b>Квартал '+h(r.KV)+' · Выдел '+h(r.VD)+'</b></div><span id="ce-status" role="status">Изменений нет</span></div>'+
 '<nav class="ce-section-nav" aria-label="Основные макеты">'+['1','2','3','4','5','10','31','32'].map(n=>'<button type="button" data-ce-jump="'+n+'">'+n+'</button>').join('')+'</nav>'+
 '<div id="ce-main"><section class="ce-address" aria-label="Адрес карточки"><div class="ce-context">'+context('Лесовладелец',o.NLX,r.POS,true)+context('Лесничество',o.NOS,r.LESN)+context('Категория ГЛФ',SolinHuman.value('ВыделВ','KGLF',r.KGLF,r),r.KGLF,true)+context('Квартал',r.KV)+context('Выдел',r.VD)+'</div><div class="ce-grid ce-quarter-grid">'+fields('Квартал',['GodT','Rel','Dost'],s.quarter,'quarter')+'</div><p class="ce-note">Год, рельеф и доступность относятся к кварталу в этой категории ГЛФ.</p></section>'+
 '<section class="ce-section ce-base" aria-label="Основные сведения"><div class="ce-grid">'+fields('ВыделВ',['PLV','KU','CR','Fzona','KlxrVD'],r,'base')+'</div></section>'+
 sections.slice(0,5).map(([n,name,ff])=>block(n,name,'<div class="ce-grid">'+fields('ВыделВ',ff,r,'base')+'</div>',n==='5'?'Показатели сохранены из базы. Автоматический пересчёт выполняется в настольной SOLI-N.':'')).join('')+
 block('10','Древостой','<div id="ce-table-Макет10">'+table('Макет10')+'</div>')+
 sections.slice(5).map(([n,name,ff])=>block(n,name,'<div class="ce-grid">'+fields('ВыделВ',ff,r,'base')+'</div>')).join('')+
 '<details class="ce-other"><summary>Дополнительные поля карточки</summary><div class="ce-grid">'+fields('ВыделВ',rest,r,'base')+'</div></details></div>'+
 '<div id="ce-extra" hidden></div><div id="ce-error" role="alert" tabindex="-1"></div>'+
 '<footer class="ce-footer"><nav class="ce-maket-nav" aria-label="Дополнительные макеты"><span>Макеты</span><button type="button" data-ce-main>КТ</button>'+extras.map(n=>'<button type="button" data-ce-extra="Макет'+n+'" title="'+h(SolinHuman.formName('Макет'+n))+'" aria-label="Макет '+n+' — '+h(SolinHuman.formName('Макет'+n))+'">'+n+'<small data-ce-badge="Макет'+n+'">'+(r._children['Макет'+n]?.length||'')+'</small></button>').join('')+'</nav><div class="ce-save-actions"><button type="button" id="ce-cancel">Отмена</button><button type="submit" class="primary" id="ce-save">Сохранить карточку</button></div></footer></form>';
}
function readValue(el,old){const raw=el.value.trim(),field=el.dataset.ceField;
 if(raw==='')return null;
 if(numeric.has(field)){const n=Number(raw.replace(',','.'));if(!Number.isFinite(n))throw Error('Проверьте число: '+el.getAttribute('aria-label'));return n;}
 if(old!=null&&same(raw,old))return old;
 return el.tagName==='SELECT'&&typeof old==='number'&&Number.isFinite(Number(raw))?Number(raw):raw;
}
function capture(el){if(!el.matches('[data-ce-field]'))return;
 const {ceScope:scope,ceField:field,ceRow:index}=el.dataset;
 const target=scope==='base'?session.draft:scope==='quarter'?session.quarter:session.draft._children[scope][Number(index)];
 try{target[field]=readValue(el,target[field]);el.removeAttribute('aria-invalid');el.setCustomValidity('');}
 catch(e){el.setAttribute('aria-invalid','true');el.setCustomValidity(e.message);}
 session.dirty=true;document.querySelector('#ce-status').textContent='Есть несохранённые изменения';
}
function error(message,el,location){const box=document.querySelector('#ce-error');box.textContent=message;
 if(location?.form){if(location.form.startsWith('Макет')&&location.form!=='Макет10')showExtra(location.form);else showMain();el=document.querySelector('[data-ce-scope="'+location.scope+'"][data-ce-field="'+location.field+'"]'+(location.index==null?'':'[data-ce-row="'+location.index+'"]'));}
 const main=document.querySelector('#ce-main'),extra=document.querySelector('#ce-extra');
 if(el){const form=el.dataset.ceScope;if(form.startsWith('Макет')&&form!=='Макет10')showExtra(form);else{main.hidden=false;extra.hidden=true;}}
 const target=el?.isConnected?el:box;target.closest('details')?.setAttribute('open','');target.focus();target.scrollIntoView({block:'center'});
}
function rerenderTable(form){document.getElementById('ce-table-'+form).innerHTML=table(form);}
function showMain(jump){document.querySelector('#ce-main').hidden=false;document.querySelector('#ce-extra').hidden=true;
 document.querySelectorAll('[data-ce-extra]').forEach(b=>b.removeAttribute('aria-current'));
 if(jump)document.getElementById('ce-section-'+jump)?.scrollIntoView({block:'start',behavior:'smooth'});
 else document.querySelector('.ce-summary').scrollIntoView({block:'start'});
}
function showExtra(form){const root=document.querySelector('#ce-extra');
 document.querySelector('#ce-main').hidden=true;root.hidden=false;
 if(root.dataset.form!==form){root.dataset.form=form;root.innerHTML='<section class="ce-section"><button type="button" data-ce-main class="ce-back">‹ Карточка таксации</button><h3>Макет '+h(form.replace('Макет',''))+' · '+h(SolinHuman.formName(form))+'</h3><div id="ce-table-'+h(form)+'">'+table(form)+'</div></section>';}
 document.querySelectorAll('[data-ce-extra]').forEach(b=>{if(b.dataset.ceExtra===form)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
 root.scrollIntoView({block:'start'});
}
function updateBadges(form){const n=session.draft._children[form]?.length||0;document.querySelectorAll('[data-ce-badge="'+form+'"]').forEach(b=>b.textContent=n||'');}
function validate(){
 const invalid=document.querySelector('#ce-form [aria-invalid="true"]');if(invalid)throw {message:invalid.validationMessage,el:invalid};
 if(!(Number(session.draft.PLV)>0))throw {message:'Площадь выдела должна быть больше нуля.',el:document.querySelector('[data-ce-field="PLV"]')};
 const year=session.quarter.GodT;if(year!=null&&(!Number.isInteger(Number(year))||Number(year)<1900||Number(year)>2200))throw {message:'Укажите год таксации от 1900 до 2200.',el:document.querySelector('[data-ce-field="GodT"]')};
 const check=(form,row,before)=>{const failed=(solinCore.validateRow(form,row,session.draft)||[]).filter(m=>{const f=m.split(':')[0];return !before||!same(row[f],before[f]);});if(failed.length){const field=failed[0].split(':')[0],scope=form==='ВыделВ'?'base':form==='Квартал'?'quarter':form,index=form.startsWith('Макет')?session.draft._children[form].indexOf(row):null;throw {message:'Проверьте поле «'+title(form,field)+'»'+(form.startsWith('Макет')?' в макете '+form.replace('Макет',''):'')+'.',form,scope,field,index};}};
 check('ВыделВ',session.draft,session.original);check('Квартал',session.quarter,session.originalQuarter);
 for(const form of session.changedMakets)for(const row of session.draft._children[form]||[])check(form,row,session.baselines.get(row));
}
function cleanup(){if(!session)return;const s=session;session=null;const modal=document.querySelector('#modal');modal.classList.remove('ce-modal');modal.removeAttribute('role');modal.removeAttribute('aria-modal');modal.removeAttribute('aria-labelledby');
 document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKey);window.removeEventListener('beforeunload',onUnload);
 modal.querySelector('.close').onclick=s.closeButton;
 document.querySelector('#ce-form')?.remove();previousFocus?.focus();
}
function close(){cleanup();closeModal();}
function cancel(){if(session?.dirty&&!confirm('Закрыть карточку без сохранения изменений?'))return;close();}
function onUnload(e){if(session?.dirty){e.preventDefault();e.returnValue='';}}
function onKey(e){if(!session)return;if(e.key==='Escape'){e.preventDefault();cancel();return;}
 if(e.key==='Tab'){const visible=[...document.querySelectorAll('.ce-modal button,.ce-modal input,.ce-modal select,.ce-modal summary,[role="dialog"] [tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled),first=visible[0],last=visible.at(-1);if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}}
}
function save(e){e.preventDefault();if(!session)return;const s=session;
 try{validate()}catch(err){error(err.message,err.el,err);return;}
 const before=clone(s.record),beforeQuarter=clone(s.quarterTarget),oldWork=localStorage.getItem('solin_field_audited_work_v1'),oldCheckpoint=localStorage.getItem('solin_field_checkpoint_v2');
 try{Object.assign(s.record,clone(s.draft));for(const rows of Object.values(s.record._children||{}))for(const row of rows)for(const k of keys)row[k]=s.record[k]??null;
 Object.assign(s.quarterTarget,clone(s.quarter));
 // The existing writer keeps legacy patches and the canonical checkpoint consistent.
 solinWorkflow.saveAll(s.record);
 }catch(err){for(const k of Object.keys(s.record))delete s.record[k];Object.assign(s.record,before);for(const k of Object.keys(s.quarterTarget))delete s.quarterTarget[k];Object.assign(s.quarterTarget,beforeQuarter);
 try{for(const [key,value]of[['solin_field_audited_work_v1',oldWork],['solin_field_checkpoint_v2',oldCheckpoint]])if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch(_){}
 error('Не удалось сохранить карточку: '+err.message);return;}
 close();renderComp();refresh();toast('Карточка сохранена');
}
function click(e){const b=e.target.closest('button');if(!b)return;
 if(b.dataset.ceJump||b.hasAttribute('data-ce-main')||b.dataset.ceExtra||b.dataset.ceAdd||b.dataset.ceDelete){const invalid=document.querySelector('#ce-form [aria-invalid="true"]');if(invalid){error(invalid.validationMessage,invalid);return;}}
 if(b.dataset.ceJump){showMain(b.dataset.ceJump);return;}
 if(b.hasAttribute('data-ce-main')){showMain();return;}
 if(b.dataset.ceExtra){showExtra(b.dataset.ceExtra);return;}
 if(b.classList.contains('ce-table-toggle')){const table=b.closest('.ce-section').querySelector('.ce-table-wrap');table.classList.toggle('ce-table-mode');b.setAttribute('aria-pressed',table.classList.contains('ce-table-mode'));b.textContent=table.classList.contains('ce-table-mode')?'Строками':'Таблица';return;}
 const form=b.dataset.ceAdd||b.dataset.ceDelete;if(!form)return;
 if(b.dataset.ceAdd){const row=Object.fromEntries((D.transfSchema[form]||[]).map(f=>[f,keys.includes(f)?session.draft[f]??null:null]));(session.draft._children[form]??=[]).push(row);}
 else{if(!confirm('Удалить запись '+(Number(b.dataset.ceIndex)+1)+' макета '+form.replace('Макет','')+'? Изменения применятся после сохранения карточки.'))return;session.draft._children[form].splice(Number(b.dataset.ceIndex),1);}
 session.changedMakets.add(form);session.dirty=true;document.querySelector('#ce-status').textContent='Есть несохранённые изменения';rerenderTable(form);updateBadges(form);
 if(b.dataset.ceAdd)document.getElementById('ce-table-'+form).querySelector('tbody tr:last-child input,tbody tr:last-child select')?.focus();
}
function open(record){if(!record)return;previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;
 const q=D.quarters[String(record.KV)],rows=q.quarterRows?.length?q.quarterRows:[q.meta||{}];
 const quarter=rows.find(x=>['POS','LESN','KV','KGLF'].every(k=>same(x[k]??D.lesnichestvo?.[0]?.[k],record[k]??D.lesnichestvo?.[0]?.[k])));
 if(!quarter)return toast('Не найден квартал с этой категорией ГЛФ. Проверьте адрес карточки.');
 session={record,original:clone(record),draft:clone(record),quarterTarget:quarter,originalQuarter:clone(quarter),quarter:clone(quarter),dirty:false,changedMakets:new Set(),closeButton:document.querySelector('#modal .close').onclick};
 session.draft._children??={};
 session.baselines=new WeakMap();for(const [form,children]of Object.entries(session.draft._children))children.forEach((row,i)=>session.baselines.set(row,session.original._children[form][i]));
 if(session.quarter.GodT==null)session.quarter.GodT=D.lesnichestvo?.[0]?.GodT??null;
 openModal('Изменить карточку',markup());const modal=document.querySelector('#modal');modal.classList.add('ce-modal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','modalTitle');document.body.style.overflow='hidden';
 modal.querySelector('.close').onclick=cancel;
 const form=document.querySelector('#ce-form');form.addEventListener('input',e=>{capture(e.target);if(e.target.dataset.ceScope?.startsWith('Макет'))session.changedMakets.add(e.target.dataset.ceScope)});
 form.addEventListener('change',e=>{capture(e.target);if(e.target.dataset.ceScope?.startsWith('Макет'))session.changedMakets.add(e.target.dataset.ceScope)});
 form.addEventListener('click',click);form.addEventListener('submit',save);document.querySelector('#ce-cancel').onclick=cancel;
 document.addEventListener('keydown',onKey);window.addEventListener('beforeunload',onUnload);modal.querySelector('.modalCard').scrollTop=0;modal.querySelector('.close').focus();
}
window.SolinCardEditor={open};
})();
