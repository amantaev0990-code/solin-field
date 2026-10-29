/* Primary field workflow: human labels and compact secondary actions. */
(()=>{'use strict';
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function selectFor(el,form,field){
 if(!el||!window.SolinHuman)return;
 const list=SolinHuman.lookup(form,field);if(!list)return;
 const old=el.value,select=document.createElement('select');
 for(const attr of el.attributes)if(!['type','value','inputmode','placeholder'].includes(attr.name))select.setAttribute(attr.name,attr.value);
 select.innerHTML='<option value="">Не указано</option>'+
  Object.entries(list).filter(([k])=>k!=='').map(([k,v])=>'<option value="'+h(k)+'">'+h(SolinHuman.codeLabel(k,v))+'</option>').join('');
 if(old&&!Array.from(select.options).some(o=>o.value===old))
  select.add(new Option(SolinHuman.codeLabel(old,'Неизвестное значение'),old));
 select.value=old;
 el.replaceWith(select);
}
function polish(){for(const [id,form,field]of [['newKGLF','Квартал','KGLF'],['newKpz','Квартал','Kpz'],['newKlxr','Квартал','Klxr'],['newPOR','ВыделВ','M3Pr'],['newBon','ВыделВ','M3B']])selectFor(document.getElementById(id),form,field);
 for(const el of document.querySelectorAll('#newCompKGLF option'))
  el.textContent=el.value?SolinHuman.codeLabel(el.value,SolinHuman.value('Квартал','KGLF',el.value,{})):'Не указано';
 for(const el of document.querySelectorAll('#newKU option,#filterKU option'))
  if(el.value)el.textContent=SolinHuman.codeLabel(el.value,SolinHuman.value('ВыделВ','KU',el.value,{}));
 for(const el of document.querySelectorAll('[data-qfield]')){const field=el.dataset.qfield,label=el.closest('label');if(label&&label.firstChild?.nodeType===3)label.firstChild.textContent=SolinHuman.label('Квартал',field);selectFor(el,'Квартал',field);}
 for(const el of document.querySelectorAll('#quarterCategory option')){
  const code=el.value||el.textContent.replace(/^KGLF\s+/,'').trim();
  if(code)el.textContent=SolinHuman.codeLabel(code,SolinHuman.value('Квартал','KGLF',code,{}));
 }
}
function check(){const r=current;if(!r)return;const results=solinCore.controls(r),bad=results.filter(x=>x.status==='Ошибка'),unknown=results.filter(x=>x.status==='Не проверено'),named=solinNamedControls.run([r]);openModal('Проверка выдела','<p>Правила заполнения: <b>'+bad.length+' замечаний</b>. Дополнительные контроли: <b>'+named.filter(x=>x.status==='Ошибка').length+'</b>.</p>'+bad.map(x=>'<article class="wf-check bad"><b>'+h(SolinHuman.formName(x.form)+' · '+SolinHuman.label(x.form,x.source))+'</b><p>Запись '+x.row+': значение не соответствует правилу исходной SOLI-N.</p><details><summary>Исходное правило</summary>'+h(x.rule)+'</details></article>').join('')+named.filter(x=>x.status==='Ошибка').map(x=>'<article class="wf-check bad"><b>'+h(x.control==='К04'?'Проверьте параметры болота':'Проверьте особенности и категорию лесного фонда')+'</b><details><summary>Подробности контроля</summary>'+h(x.control+' · '+x.reason)+'</details></article>').join('')+(!bad.length&&!named.some(x=>x.status==='Ошибка')?'<p class="wf-check ok">По выполненным проверкам замечаний нет.</p>':'')+'<details class="human-source"><summary>Охват проверки и ограничения</summary><p>Не проверено выражений: '+unknown.length+'. Выполнены поддержанные правила полей и два предметных контроля. Это не полная проверка настольной SOLI-N.</p></details>');}
function renderActions(){const bar=document.querySelector('#wfCardActions');if(!bar)return;const more=document.createElement('details');more.className='human-more-actions';more.innerHTML='<summary>Ещё действия</summary><div></div>';const host=more.querySelector('div');for(const b of Array.from(bar.children)){if(b.id==='wfEditBase'){b.textContent='Изменить карточку';continue;}if(b.id==='wfCardCheck'){b.textContent='Проверить';b.onclick=check;continue;}host.append(b);}bar.append(more);}
function setup(){const oldModal=window.openModal;window.openModal=function(...args){const result=oldModal(...args);if(window.SolinHuman)polish();return result;};const oldRender=window.renderComp;window.renderComp=function(...args){const result=oldRender(...args);renderActions();return result;};const oldShow=window.show;window.show=function(id){const result=oldShow(id);if(id==='card')document.querySelector('.quickActions').style.display='none';else document.querySelector('.quickActions').style.display='';return result;};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
