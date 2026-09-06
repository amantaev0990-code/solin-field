(()=>{
  const baseShow=show;
  window.show=function(id){
    baseShow(id);
    const activeSection=id==='card'?'quartersScreen':(id==='dbScreen'?'menuScreen':id);
    document.querySelectorAll('.sectionTab').forEach(btn=>btn.classList.toggle('active',btn.dataset.s===activeSection));
    document.querySelectorAll('.nav').forEach(btn=>btn.classList.toggle('active',btn.dataset.s===activeSection));
  };

  window.openQuarter=function(k){
    const q=D.quarters[k],box=$('#quarters');
    box.innerHTML=`<div class="screenHead quarterOpenedHead"><div><h2>Квартал ${esc(k)}</h2><p>${q.compartments.length} выделов</p></div><button class="iconbtn" onclick="renderQuarters()">‹</button></div><div id="qComps"></div><button class="addCompMini" onclick="openCompForm('${esc(k)}')">＋ Добавить выдел</button>`;
    renderCompList($('#qComps'),q.compartments);
  };
})();