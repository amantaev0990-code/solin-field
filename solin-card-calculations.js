/* Audited SOLI-N calculation preview for the taxation card.
 * K58: Макет10Бон_1/2 -> SSHB -> Макет10Бон -> К58 -> К58_Зам.
 * Stock: Макет10ЗАП1 -> Макет10ЗАП2 -> Макет10ЗАП.
 * Source: verified Solim.mdb MSysQueries and 254 SSHB rows; 134/134
 * historical STUR1/STUR matches. Never writes MDB, never guesses missing
 * lookups and never performs unattended persistent updates. */
(()=>{'use strict';
const defined=x=>x!==null&&x!==undefined&&String(x).trim()!=='';
const n=x=>defined(x)&&Number.isFinite(Number(x))?Number(x):null;
const same=(a,b)=>defined(a)&&defined(b)&&String(a).trim()===String(b).trim();
const address=['POS','LESN','KV','KGLF','VD'];
function childMatches(record,row){
 return address.every(k=>!defined(row[k])||same(row[k],record[k]));
}
function status(message,reason='unavailable'){return {status:reason,reason:message,corrections:[]};}
function safeRoundHalf(numb,places=0){
 if(!Number.isFinite(numb)||numb<0)return null;
 const v=numb*10**places,part=v-Math.floor(v);
 // Jet Round is not safely replayed at decimal or binary ties.
 if(Math.abs(part-0.5)<0.0000001)return null;
 return Math.round(v)/10**places;
}
function bonitet(record,refs){
 if(!refs?.SSHB?.length)return status('Нет оригинальной шкалы SSHB');
 const category=n(record?.KU);
 if(category===null)return status('Сначала выберите категорию угодий','waiting');
 if(category>=11)return status('Контроль К58 относится к категориям KU меньше 11','not-applicable');
 const rows=(record?._children?.['Макет10']||[]).filter(row=>childMatches(record,row)&&n(row.IAR)===1&&n(row.POL)!==null&&n(row.POL)!==0&&same(row.POR,record.M3Pr));
 if(rows.length!==1)return status('К58: нужна одна однозначная ведущая строка 1-го яруса макета 10'+(rows.length?' (найдено '+rows.length+')':'') ,rows.length?'ambiguous':'waiting');
 const row=rows[0],age=n(row.LET),height=n(row.PH),origin=n(row.PROI);
 if(age===null||height===null||origin===null||age<=0||height<0)return status('К58: не хватает возраста, высоты или происхождения','waiting');
 // Original QueryDef sets Проис=9 for these species AFTER first joining SSHB
 // on the original PROI; do not infer that first-stage Access join.
 const special=new Set(['БРК','БОЯ','КЛН','РК','Ч','ОБ','СИР']);
 if(special.has(String(record.M3Pr).trim())&&origin!==9)
  return status('К58: особый класс происхождения; точный двухэтапный Access JOIN не подтверждён','ambiguous');
 const scales=refs.SSHB.filter(r=>n(r['Происх'])===origin&&
   n(r['ВозрН'])!==null&&n(r['ВозрК'])!==null&&age>=n(r['ВозрН'])&&age<n(r['ВозрК']));
 if(scales.length!==1)return status('К58: отсутствует либо неоднозначна возрастная строка SSHB','ambiguous');
 const h=safeRoundHalf(height,1);
 if(h===null)return status('К58: высота попадает на границу округления Jet','ambiguous');
 const scale=scales[0];
 const thresholds=[['Н1б','1Б'],['Н1а','1А'],['Н1','1'],['Н2','2'],['Н3','3'],['Н4','4'],['Н5','5'],['Н5а','5А'],['Н5б','5Б']];
 if(thresholds.some(([key])=>n(scale[key])===null))return status('К58: неполная строка SSHB','ambiguous');
 const match=thresholds.find(([key])=>h>=n(scale[key]));
 if(!match)return status('К58: высота ниже минимальной шкалы SSHB','ambiguous');
 return {status:'complete',reason:'К58 · SSHB (происхождение '+origin+', возраст '+age+', высота '+h+' м)',expected:match[1],
  field:'M3B',rawCurrent:record.M3B,origin,age,height:h,scaleAge:scale['Возр'],scale};
}
function standStock(record){
 const category=n(record?.KU),area=n(record?.PLV);
 if(category===null||area===null||area<=0)return status('Не заданы категория угодий или площадь','waiting');
 if(category>=20)return status('Расчёт Макет10ЗАП1 применяется к KU меньше 20','not-applicable');
 const eligible=(record?._children?.['Макет10']||[]).filter(row=>
   childMatches(record,row)&&same(row.POR,record.M3Pr)&&n(row.IAR)!==null&&(n(row.IAR)<4||n(row.IAR)===8)&&
   n(row.ZAP)!==null&&n(row.ZAP)!==0);
 if(!eligible.length)return status('В макете 10 нет подходящих строк с запасом главной породы','waiting');
 const grouped=eligible.map(x=>['IAR','KOEF','LET','PH','PD2','POL'].map(k=>String(x[k]??'')).join('|'));
 if(new Set(grouped).size>1)
  return status('Несколько групп Макет10ЗАП1; оригинальное UPDATE не имеет единственного результата','ambiguous');
 const perHa=eligible.reduce((s,x)=>s+n(x.ZAP),0),total=safeRoundHalf(perHa*area,0);
 if(total===null)return status('Общий запас попадает на неоднозначную границу Jet Round','ambiguous');
 return {status:'complete',reason:'Макет10ЗАП · ΣZAP главной породы '+perHa+' м³/га × '+area+' га',
   expectedPerHa:perHa,expectedTotal:total,area};
}
function corrections(record,refs){
 const issues=[],unknown=[];
 const b=bonitet(record,refs);
 if(b.status==='complete'&&defined(record.M3B)&&!same(record.M3B,b.expected))
  issues.push({field:'M3B',label:'Бонитет',previous:String(record.M3B),expected:String(b.expected),reason:b.reason});
 else if(b.status==='complete'&&!defined(record.M3B))
  issues.push({field:'M3B',label:'Бонитет',previous:'Не указан',expected:String(b.expected),reason:b.reason});
 else if(b.status!=='complete')unknown.push({field:'M3B',...b});
 const stock=standStock(record);
 if(stock.status==='complete'){
  for(const [field,label,expected] of [['STUR1','Запас на 1 га, м³/га',stock.expectedPerHa],['STUR','Запас выдела, м³',stock.expectedTotal]]){
   const value=record?.[field];
   if(!defined(value)||n(value)!==expected)
    issues.push({field,label,previous:defined(value)?String(value):'Не указан',expected,reason:stock.reason});
  }
 }else unknown.push({field:'STUR',...stock});
 return {issues,unknown,bonitet:b,standStock:stock};
}
window.SolinCardCalculations={bonitet,standStock,corrections,safeRoundHalf};
})();
