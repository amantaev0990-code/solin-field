const SOLIN_DATA_TABLES=[
 ['KU','Категории угодий'],
 ['POR','Древесные и кустарниковые породы'],
 ['M3B','Классы бонитета'],
 ['IAR','Ярусы древостоя'],
 ['M2PM1','Проектируемые мероприятия'],
 ['PROI','Происхождение насаждений'],
 ['TB','Типы болот'],
 ['TR','Растительность болот'],
 ['KTP','Типы повреждений'],
 ['Fzona','Функциональные зоны'],
 ['KGLF','Категории лесного фонда']
];

function solinLookup(key){
 const aliases={POR:'POR',KU:'KU',M3B:'M3B',IAR:'IAR',M2PM1:'M2PM1',PROI:'PROI',TB:'TB',TR:'TR',KTP:'KTP',Fzona:'Fzona',KGLF:'KGLF'};
 return (D&&D.fieldLookups&&D.fieldLookups[aliases[key]||key])||{};
}

function renderDataTables(){
 const box=document.querySelector('#dataTableList');
 if(!box||!D)return;
 const items=SOLIN_DATA_TABLES.map(([key,title])=>{
   const rows=Object.entries(solinLookup(key)).filter(([c,n])=>String(c).trim()!==''&&n!==null&&n!==undefined&&String(n).trim()!=='');
   if(!rows.length)return '';
   return `<button class="menuRow dataTableButton" onclick="openDataTable('${key}','${title.replace(/'/g,"\\'")}')"><span><b>${title}</b><small>${rows.length} значений с шифрами</small></span><span>›</span></button>`;
 }).join('');
 box.innerHTML=items||'<div class="empty">Таблицы пока не найдены</div>';
}

function openDataTable(key,title){
 const rows=Object.entries(solinLookup(key))
   .filter(([c,n])=>String(c).trim()!==''&&n!==null&&n!==undefined&&String(n).trim()!=='')
   .sort((a,b)=>{const x=Number(a[0]),y=Number(b[0]);return Number.isFinite(x)&&Number.isFinite(y)?x-y:String(a[0]).localeCompare(String(b[0]),'ru')});
 const head=document.querySelector('#dataTableTitle');
 const list=document.querySelector('#dataTableRows');
 const home=document.querySelector('#dataTableHome');
 const detail=document.querySelector('#dataTableDetail');
 if(head)head.textContent=title;
 if(list)list.innerHTML=rows.map(([code,name])=>`<div class="codedRow"><span class="codedName">${esc(name)}</span><span class="codedCode">${esc(code)}</span></div>`).join('')||'<div class="empty">Нет данных</div>';
 home?.classList.add('hidden');
 detail?.classList.remove('hidden');
}

function backDataTables(){
 document.querySelector('#dataTableDetail')?.classList.add('hidden');
 document.querySelector('#dataTableHome')?.classList.remove('hidden');
}

const oldShowForTables=show;
show=function(id){
 oldShowForTables(id);
 if(id==='dbScreen'){
   backDataTables();
   setTimeout(renderDataTables,0);
 }
};

window.addEventListener('load',()=>setTimeout(renderDataTables,250));