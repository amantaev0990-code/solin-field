/* Audited SOLI-N calculation preview for the taxation card.
 * K58: Макет10Бон_1/2 -> SSHB -> Макет10Бон -> К58 -> К58_Зам.
 * Stock: Макет10ЗАП1 -> Макет10ЗАП2 -> Макет10ЗАП.
 * Source: verified Solim.mdb MSysQueries and 254 SSHB rows; 134/134
 * historical STUR1/STUR matches (single main species). The new Field
 * multi-species aggregation is explicitly distinct from that historical
 * Access subset. Never writes MDB, never guesses missing
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
// Access/Jet Round(x, digits): midpoint goes to the nearest EVEN digit.
function accessRound(value,places=0){
 if(!Number.isFinite(value)||value<0)return null;
 const factor=10**places,scaled=value*factor,lo=Math.floor(scaled),fraction=scaled-lo;
 if(fraction===0.5)return (lo%2===0?lo:lo+1)/factor;
 return Math.round(scaled)/factor;
}
// К59_1 uses Int() and an explicit <0.5 comparison: midpoint goes UP.
function k59Round(value,places=0){
 if(!Number.isFinite(value)||value<0)return null;
 const factor=10**places,scaled=value*factor,lo=Math.floor(scaled);
 return (lo+(scaled-lo>=0.5?1:0))/factor;
}
function bonitet(record,refs,quarterRow=null){
 if(!refs?.SSHB?.length)return status('Нет оригинальной шкалы SSHB');
 const category=n(record?.KU);
 if(category===null)return status('Сначала выберите категорию угодий','waiting');
 if(category>=11)return status('Контроль К58 относится к категориям KU меньше 11','not-applicable');
 if(!defined(record?.M3Pr))return status('К58: не задана главная порода','waiting');
 if(n(record.GodT1)!==null&&n(quarterRow?.GodT)!==null&&n(record.GodT1)!==n(quarterRow.GodT))
  return status('К58: GodT1 расходится с Квартал.GodT; требуется обновить контекст','ambiguous');
 const children=(record?._children?.['Макет10']||[]).filter(row=>childMatches(record,row));
 // Макет10Ярмин groups by POL and requires Min(IAR)=1, Max(ZAP)>0.
 // Макет10Бон_1 joins this result by address/IAR, not by POR or POL.
 const groups=new Map();
 for(const r of children){const key=n(r.POL);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const eligible=[...groups.values()].some(g=>{
  const layers=g.map(r=>n(r.IAR)).filter(v=>v!==null),stocks=g.map(r=>n(r.ZAP)).filter(v=>v!==null);
  return layers.length&&Math.min(...layers)===1&&stocks.length&&Math.max(...stocks)>0;
 });
 if(!eligible)return status('К58: Макет10Ярмин не создаёт строку с минимальным ярусом 1 и положительным ZAP','waiting');
 const rows=children.filter(row=>n(row.IAR)===1&&n(row.POL)!==null&&n(row.POL)!==0);
 if(rows.length!==1)return status('К58: нужна одна однозначная строка 1-го яруса с ненулевой полнотой'+(rows.length?' (найдено '+rows.length+')':'') ,rows.length?'ambiguous':'waiting');
 const row=rows[0],age=n(row.LET),height=n(row.PH),origin=n(row.PROI);
 if(age===null||height===null||origin===null||age<=0||height<0)return status('К58: не хватает возраста, высоты или происхождения','waiting');
 // The first SSHB join selects Voz using the original PROI. Only the second
 // join substitutes origin 9 for these species, retaining the first Voz.
 const special=new Set(['БРК','БОЯ','КЛН','РК','Ч','ОБ','СИР']);
 const scales=refs.SSHB.filter(r=>n(r['Происх'])===origin&&
   n(r['ВозрН'])!==null&&n(r['ВозрК'])!==null&&age>=n(r['ВозрН'])&&age<n(r['ВозрК']));
 if(scales.length!==1)return status('К58: отсутствует либо неоднозначна возрастная строка SSHB','ambiguous');
 let h=safeRoundHalf(height,1);
 if(h===null)return status('К58: высота попадает на границу округления Jet','ambiguous');
 const year=n(quarterRow?.GodT)??n(record.GodT1);
 if(origin!==5&&h>0&&h<1){
  if(year===null)return status('К58: для высоты менее 1 м нужен исходный год таксации','ambiguous');
  if(year<2017)h=1;
 }
 const scaleOrigin=special.has(String(record.M3Pr).trim().toLocaleUpperCase('ru-RU'))?9:origin;
 const targets=refs.SSHB.filter(r=>n(r['Происх'])===scaleOrigin&&n(r['Возр'])===n(scales[0]['Возр']));
 if(targets.length!==1)return status('К58: отсутствует либо неоднозначна вторая строка SSHB по происхождению и Возр','ambiguous');
 const scale=targets[0];
 const thresholds=[['Н1б','1Б'],['Н1а','1А'],['Н1','1'],['Н2','2'],['Н3','3'],['Н4','4'],['Н5','5'],['Н5а','5А'],['Н5б','5Б']];
 if(thresholds.some(([key])=>n(scale[key])===null))return status('К58: неполная строка SSHB','ambiguous');
 const match=thresholds.find(([key])=>h>=n(scale[key]));
 if(!match)return status('К58: высота ниже минимальной шкалы SSHB','ambiguous');
 return {status:'complete',reason:'К58 · SSHB (происхождение '+origin+' → '+scaleOrigin+', возраст '+age+', высота '+h+' м)',expected:match[1],
  field:'M3B',rawCurrent:record.M3B,origin,scaleOrigin,age,height:h,scaleAge:scale['Возр'],scale};
}
// Each Maket10 species participates in the layer composition, but one
// leading POR row can carry the WHOLE-tier ZAP for all its species. Categories 7 and 8 are
// independent: isolated trees and fresh deadwood. M4SS is a separate
// existing stand-level drywood value. Never add it to fresh deadwood,
// because the source data may describe overlapping timber.
//
// This is a Field arithmetic summary of entered/computed ZAP values.
// It is NOT a claim that the single-row source K59 stock TABLE formula
// has been validated for a mixed layer.
const LIVE_LAYERS=new Set([1,2,3,4,5,6]);
// SOLI-N keeps the TOTAL stock of a layer in the dominant species row.
// Select that row by composition, not by whichever row happens to contain
// a manually entered ZAP/POL. Stable tie-break: main species, then row order.
function layerLead(rows,record){
 return [...rows].sort((a,b)=>
  (n(b.row.KOEF)??-1)-(n(a.row.KOEF)??-1)||
  Number(same(b.row.POR,record?.M3Pr))-Number(same(a.row.POR,record?.M3Pr))||
  a.index-b.index)[0];
}
function companionStockIssues(record){
 const groups=new Map(),issues=[];
 for(const [index,row] of (record?._children?.Макет10||[]).entries()){
  if(!childMatches(record,row)||!LIVE_LAYERS.has(n(row.IAR)))continue;
  const iar=n(row.IAR);
  if(!groups.has(iar))groups.set(iar,[]);
  groups.get(iar).push({row,index});
 }
 for(const [iar,rows] of groups){
  if(rows.length<2||rows.some(x=>!defined(x.row.POR)||!(n(x.row.KOEF)>0)))continue;
  const dominant=layerLead(rows,record);
  for(const entry of rows){
   if(entry===dominant||!defined(entry.row.ZAP)||n(entry.row.ZAP)===0)continue;
   issues.push({field:'ZAP',scope:'Макет10',index:entry.index,kind:'companion-conflict',
    label:'Запас примеси яруса '+iar+' ('+entry.row.POR+')',
    previous:defined(entry.row.ZAP)?String(entry.row.ZAP):'Не указан',
    severity:'warning',status:'unverified',reason:'В смешанном ярусе у нескольких пород указан ZAP. '+
    'Правило автоматического обнуления не подтверждено исходным запросом; значения сохранены для проверки.'});
  }
 }
 return issues;
}
/** V21: shared, non-mutating, field-side integrity audit.  The Access
 * QueryDef graph remains authoritative: these checks report suspicious input
 * without overwriting original volumes or automatically filling unknown codes.
 * One layer contributes ONE total ZAP, carried by its leading species row.
 * Single trees (7) and fresh deadwood (8) are separate, not live composition.
 */
function compositionAudit(record){
 const groups=new Map(),issues=[],layers=[];
 for(const [index,row] of (record?._children?.Макет10||[]).entries()){
  if(!childMatches(record,row))continue;
  const iar=n(row.IAR);
  if(!LIVE_LAYERS.has(iar))continue;
  if(!groups.has(iar))groups.set(iar,[]);
  groups.get(iar).push({index,row});
 }
 for(const [iar,rows] of [...groups].sort((a,b)=>a[0]-b[0])){
  const supplied=rows.map(x=>n(x.row.KOEF));
  const known=supplied.every(v=>v!==null),sum=known?supplied.reduce((a,b)=>a+b,0):null;
  const named=rows.map(x=>String(x.row.POR??'').trim());
  const lead=layerLead(rows,record);
  if(named.some(x=>!x))issues.push({status:'bad',layer:iar,field:'POR',
   message:'Ярус '+iar+': не указана порода в одной из строк древостоя.'});
  if(supplied.some(v=>v!==null&&(v<=0||v>10)))issues.push({status:'bad',layer:iar,field:'KOEF',
   message:'Ярус '+iar+': коэффициент состава каждой породы должен быть больше 0 и не превышать 10.'});
  else if(!known)issues.push({status:'warn',layer:iar,field:'KOEF',
   message:'Ярус '+iar+': заполните коэффициент состава у каждой породы.'});
  else if(Math.abs(sum-10)>0.000001)issues.push({status:'warn',layer:iar,field:'KOEF',
   message:'Ярус '+iar+': сумма коэффициентов состава равна '+sum+' вместо 10. Проверьте состав до расчёта запаса.'});
  if(rows.length>1){
   const companions=rows.filter(x=>x!==lead&&n(x.row.ZAP)!==null&&n(x.row.ZAP)!==0);
   if(companions.length)issues.push({status:'warn',layer:iar,field:'ZAP',
    message:'Ярус '+iar+': запас указан у '+companions.length+' примесных пород. Проверьте, не учтён ли запас яруса дважды.'});
  }
  layers.push({iar,rows:rows.length,coefficientSum:sum,leadingSpecies:lead?.row.POR??null,
   leadingStock:n(lead?.row.ZAP),species:named});
 }
 return {status:issues.length?'attention':groups.size?'complete':'empty',layers,issues};
}
/** Validation across the same source rows used by Макет 5/10/16/31/32.
 * Do not classify NULL optional fields as zero, or auto-edit a saved stand. */
function cardIntegrity(record){
 const composition=compositionAudit(record),issues=[...composition.issues];
 for(const form of ['Макет10','Макет16','Макет31','Макет32']){
  for(const [i,row]of (record?._children?.[form]||[]).entries()){
   const mismatched=address.filter(k=>defined(row[k])&&!same(row[k],record[k]));
   if(mismatched.length)issues.push({status:'bad',form,index:i,field:mismatched[0],
    message:form+', строка '+(i+1)+': адрес ('+mismatched.join(', ')+') не соответствует выделу '+record.KV+'/'+record.VD+'.'});
  }
 }
 // This is a warning only: old Access main-species stock can differ from
 // verified Field full-layer summaries. Never silently rewrite STUR/STUR1.
 const stock=standStock(record);
 if(stock.status==='complete'){
  for(const [field,expected,label] of [['STUR1',stock.expectedPerHa,'Запас на гектар'],['STUR',stock.expectedTotal,'Запас выдела']]){
   const actual=n(record?.[field]);
   if(actual!==null&&Math.abs(actual-expected)>0.000001)
    issues.push({status:'warn',form:'Макет5',field,
     message:'Макет 5: '+label+' ('+actual+') отличается от расчёта живых ярусов ('+expected+'). Не исправляйте автоматически без проверки исходной методики.'});
  }
 }
 return {status:issues.some(x=>x.status==='bad')?'invalid':issues.length?'attention':'complete',issues,composition,stock};
}
function stockBreakdown(record){
 const out={included:[],singleTrees:[],freshDeadwood:[],other:[],missing:[],
  invalid:[],duplicates:[],conflicts:[],companions:[],unclassified:[],byLayer:[],bySpecies:[],
  drywoodPerHa:n(record?.M4SS),clutterPerHa:n(record?.M4ZO),liquidClutterPerHa:n(record?.M4ZL)};
 const layers=new Map(),carriers=new Map(),allSpecies=new Set();
 for(const [index,row]of (record?._children?.Макет10||[]).entries()){
  if(!childMatches(record,row))continue;
  const iar=n(row.IAR),zap=n(row.ZAP),por=String(row.POR??'').trim();
  const item={index:index+1,iar,por:por||null,zap,leading:same(por,record.M3Pr),
   coef:n(row.KOEF),row};
  if(iar===7){out.singleTrees.push(item);if(zap!==null&&zap<0)out.invalid.push(item);continue;}
  if(iar===8){out.freshDeadwood.push(item);if(zap!==null&&zap<0)out.invalid.push(item);continue;}
  if(!LIVE_LAYERS.has(iar)){
   if(zap!==null&&zap!==0)out.unclassified.push(item);
   out.other.push(item);continue;
  }
  if(!por){out.missing.push(item);continue;}
  if(zap!==null&&zap<0){out.invalid.push(item);continue;}
  allSpecies.add(por);
  if(!layers.has(iar))layers.set(iar,[]);
  layers.get(iar).push(item);
 }
 for(const [iar,rows]of [...layers].sort((a,b)=>a[0]-b[0])){
  const observed=rows.filter(x=>x.zap!==null);
  const positive=observed.filter(x=>x.zap>0);
  if(!observed.length){
   out.missing.push({iar,por:null,zap:null,reason:'Для яруса '+iar+' не введён запас ZAP'});continue;
  }
  const carrier=layerLead(rows.map(x=>({row:x.row,index:x.index-1,item:x})),record)?.item;
  if(!carrier||carrier.zap===null){
   out.missing.push({iar,por:carrier?.por||null,zap:null,reason:'Запас ведущей породы яруса '+iar+' не задан'});continue;
  }
  if(rows.length>1&&rows.some(x=>x!==carrier&&x.zap!==null&&x.zap!==0))
   out.conflicts.push({iar,reason:'У примесной породы яруса '+iar+' задан самостоятельный ZAP. Полный запас должен стоять только у '+carrier.por});
  // The historical Access STUR query also sums repeated Maket10 rows when
  // their GROUP BY fields match. Different groups of the SAME species
  // are ambiguous; avoid accidentally doubling a different cohort.
  const signatures=new Map();
  for(const item of positive){
   const key=item.por;
   const sig=['KOEF','LET','PH','PD2','POL'].map(k=>String(item.row[k]??'')).join('|');
   if(signatures.has(key)&&signatures.get(key)!==sig)out.duplicates.push(item);
   signatures.set(key,sig);
  }
  const total=carrier.zap;
  const composition=rows.map(x=>({por:x.por,coef:x.coef,hasZAP:x.zap!==null}));
  out.byLayer.push({iar,zap:total,por:carrier.por,composition,
   sourceRows:[carrier.index]});
  out.included.push(carrier);
  carriers.set(carrier.por,(carriers.get(carrier.por)||0)+carrier.zap);
  for(const row of rows.filter(x=>x!==carrier))out.companions.push(row);
 }
 out.bySpecies=[...carriers].map(([por,zap])=>({por,zap}));
 out.liveSpeciesCount=allSpecies.size;
 out.candidatePerHa=out.included.reduce((sum,row)=>sum+row.zap,0);
 out.livePerHa=out.candidatePerHa;
 out.singleTreesPerHa=out.singleTrees.every(x=>x.zap!==null&&x.zap>=0)?
  out.singleTrees.reduce((sum,row)=>sum+row.zap,0):null;
 out.freshDeadwoodPerHa=out.freshDeadwood.every(x=>x.zap!==null&&x.zap>=0)?
  out.freshDeadwood.reduce((sum,row)=>sum+row.zap,0):null;
 out.area=n(record?.PLV);
 out.singleTreesTotal=out.area!==null&&out.singleTreesPerHa!==null?
  accessRound(out.singleTreesPerHa*out.area,0):null;
 out.freshDeadwoodTotal=out.area!==null&&out.freshDeadwoodPerHa!==null?
  accessRound(out.freshDeadwoodPerHa*out.area,0):null;
 out.drywoodTotal=out.area!==null&&out.drywoodPerHa!==null?
  accessRound(out.drywoodPerHa*out.area,0):null;
 return out;
}
function standStock(record){
 const category=n(record?.KU),area=n(record?.PLV);
 if(category===null||area===null||area<=0)return status('Не заданы категория угодий или площадь','waiting');
 if(category>=20)return status('Расчёт запаса древостоя относится к KU меньше 20; единичные деревья и сухостой показаны отдельно','not-applicable');
 const out=stockBreakdown(record);
 if(out.invalid.length)return status('Недопустимый отрицательный ZAP в строке Макета 10','ambiguous');
 if(out.unclassified.length)return status('Есть запас ZAP без подтверждённого номера яруса','waiting');
 if(out.missing.length)return status('Для '+out.missing.length+' строки или яруса нет POR либо ZAP ведущей породы. Нельзя подставлять ноль','waiting');
 if(out.duplicates.length)return status('Повторяются неоднозначные группы той же породы в ярусе: нужны исходные параметры Макета 10','ambiguous');
 if(out.conflicts.length)return status('Неоднозначный запас в смешанном ярусе: '+out.conflicts.map(x=>x.reason).join('; '),'ambiguous');
 if(!out.included.length)return status('В макете 10 нет заполненных ZAP живых ярусов 1–6','waiting');
 const perHa=out.livePerHa,total=accessRound(perHa*area,0);
 if(total===null)return status('Невозможно округлить запас по правилу Access Round','ambiguous');
 return {status:'complete',reason:'ΣZAP живых ярусов 1–6 по записям ведущих пород ('+
   out.byLayer.map(x=>'ярус '+x.iar+': '+x.zap).join('; ')+'); примесь без отдельного ZAP входит в запас своего яруса, сухостой и единичные деревья — отдельно',
  expectedPerHa:perHa,expectedTotal:total,area,byLayer:out.byLayer,
  bySpecies:out.bySpecies,liveSpeciesCount:out.liveSpeciesCount,
  freshDeadwoodPerHa:out.freshDeadwoodPerHa,freshDeadwoodTotal:out.freshDeadwoodTotal,
  singleTreesPerHa:out.singleTreesPerHa,singleTreesTotal:out.singleTreesTotal,
  drywoodPerHa:out.drywoodPerHa,drywoodTotal:out.drywoodTotal,
  basis:'source-backed-tier-arithmetic-not-complete-K59'};
}
// Read-only replay of the scalar part of Макет10ЗАП1 / Макет10ЗАП.
// The source GROUP BY includes IAR and the five species measurements.
// Several groups update one address: no deterministic scalar result is proven.
// Keep this distinct from the useful Field subtotal of living layers 1–6.
function sourceStandStock(record){
 const category=n(record?.KU),area=n(record?.PLV);
 if(category===null||area===null||area<=0||!defined(record?.M3Pr))
  return status('Для исходного запроса не заданы KU, PLV или M3Pr','waiting');
 if(category>=20)return status('Исходный Макет10ЗАП1 выполняется при KU < 20','not-applicable');
 const groups=new Map();
 for(const row of record?._children?.Макет10||[]){
  const iar=n(row.IAR),zap=n(row.ZAP);
  if(!childMatches(record,row)||!same(row.POR,record.M3Pr)||iar===null||!(iar<4||iar===8))continue;
  if(defined(row.ZAP)&&zap===null||zap!==null&&zap<0)
   return status('Недопустимое значение ZAP в исходной группе','ambiguous');
  const signature=JSON.stringify(['KOEF','LET','PH','PD2','POL','IAR'].map(k=>n(row[k])));
  const group=groups.get(signature)||{sum:0,known:false};
  if(zap!==null){group.sum+=zap;group.known=true;}
  groups.set(signature,group);
 }
 const selected=[...groups.values()].filter(g=>g.known&&g.sum!==0);
 if(!selected.length)return status('Макет10ЗАП1 не создаёт строку с ненулевым запасом','waiting');
 if(selected.length!==1)return status('Макет10ЗАП1 создаёт несколько групп для одного адреса; порядок UPDATE в Access не подтверждён','ambiguous');
 return {status:'complete',expectedPerHa:selected[0].sum,expectedTotal:accessRound(selected[0].sum*area),
  reason:'Макет10ЗАП1 → Макет10ЗАП: одна исходная группа POR=M3Pr, IAR<4 или IAR=8',basis:'original-saved-query-scalar'};
}
// The original forest registry contains the KTO of each district. Older
// Field-created forests omitted it despite having an exact POS/LESN match.
function originalForestKTO(record){
 const rows=(window.SOLIN_FOREST_CATALOG?.rows||[]).filter(row=>
   same(row[0],record?.POS)&&same(row[1],record?.LESN)&&
   n(row[4])!==null&&n(row[4])>0);
 return rows.length===1?n(rows[0][4]):null;
}
// K59, constrained to one main-species Maket 10 row, with an exact
// (KTO, POR, KlxrVD, KUL) lookup in original Szap. The physical Szap
// table has 2389 unique keys. No approximate height extrapolation.
function stockZoneOptions(refs,region,kpz=null){
 const regionRows=(refs?.Szap||[]).filter(r=>same(r.Obl,region));
 const availableZones=[...new Set(regionRows.map(r=>n(r.LXZ)).filter(x=>x!==null))].sort((x,y)=>x-y);
 const zoneOptions=(refs?.Slxr||[]).filter(r=>availableZones.some(z=>same(r.Klxz,z))&&
   (kpz===null||kpz===undefined||same(r.Kpz,kpz))).map(r=>({value:n(r.Klxz),name:String(r.Nlxr??'')}));
 return {regionRows,availableZones,zoneOptions};
}
function stockPerHectare(record,refs,org,quarterRow=null,targetLayer=null){
 if(!refs?.Szap?.length)return status('Таблица запасов Szap недоступна');
 if(org&&['POS','LESN'].some(k=>defined(org[k])&&!same(org[k],record?.[k])))
  return status('К59: лесничество не соответствует адресу карточки','ambiguous');
 if(quarterRow&&address.slice(0,4).some(k=>defined(quarterRow[k])&&!same(quarterRow[k],record?.[k])))
  return status('К59: квартал не соответствует полному адресу карточки','ambiguous');
 const category=n(record?.KU),area=n(record?.PLV),original=originalForestKTO(record);
 const direct=n(org?.KTO),region=direct!==null&&direct>0?direct:original;
 const explicit=n(record?.KlxrVD),quarterZone=n(quarterRow?.Klxr);
 const zone=explicit!==null&&explicit>0?explicit:(!defined(record?.KlxrVD)&&quarterZone!==null&&quarterZone>0?quarterZone:explicit);
 const missing=[];
 if(category===null)missing.push('KU (категория угодий)');
 if(area===null||area<=0)missing.push('PLV (площадь)');
 if(zone===null||zone<=0)missing.push('KlxrVD (нет кода в выделе и однозначной строки Квартал.Klxr — укажите лесохозяйственную зону при редактировании квартала)');
 if(region===null)missing.push('KTO (код области лесничества)');
 if(missing.length)return status('К59: отсутствует '+missing.join('; ')+'. Адрес '+[record?.POS,record?.LESN,record?.KV,record?.VD].join('/') ,'waiting');
 if(category>=11)return status('К59 проверяет KU10 меньше 11','not-applicable');
 const all=record?._children?.['Макет10']||[];
 const eligible=all.map((row,index)=>({row,index})).filter(({row})=>childMatches(record,row)&&
   [1,2,3,5].includes(n(row.IAR))&&defined(row.POR)&&n(row.KOEF)>0);
 const layer=targetLayer??eligible.find(x=>n(x.row.IAR)===1&&same(x.row.POR,record.M3Pr))?.row.IAR??
   eligible.find(x=>same(x.row.POR,record.M3Pr))?.row.IAR;
 const sameLayer=all.filter(r=>childMatches(record,r)&&same(r.IAR,layer));
 if(!sameLayer.length)return status('К59: сначала заполните состав яруса','waiting');
 if(sameLayer.some(r=>!defined(r.POR)||n(r.KOEF)===null||n(r.KOEF)<=0||n(r.PH)===null||n(r.PH)<=0))
  return status('К59: укажите породу, коэффициент и высоту каждой строки яруса '+layer,'waiting');
 if(new Set(sameLayer.map(r=>String(r.POR).trim())).size!==sameLayer.length)
  return status('К59: повторные группы одной породы в ярусе требуют проверки','ambiguous');
 const coefficient=sameLayer.reduce((sum,r)=>sum+n(r.KOEF),0);
 if(sameLayer.length>1&&Math.abs(coefficient-10)>0.00001)
  return status('К59: сумма коэффициентов состава яруса '+layer+' должна быть 10 (сейчас '+coefficient+')','waiting');
 const candidates=eligible.filter(x=>same(x.row.IAR,layer));
 const dominant=layerLead(candidates,record);
 if(!dominant||!(n(dominant.row.POL)>0))
  return status('К59: укажите полноту у ведущей породы яруса '+layer,'waiting');
 const {row,index}=dominant;
 const fullness=new Set(candidates.map(x=>n(x.row.POL)).filter(x=>x!==null&&x>0));
 if(fullness.size>1)return status('К59: у пород одного яруса указана разная полнота. Укажите общую полноту у ведущей строки','ambiguous');
 // Original К59_2: Sum(Макет10Выб!KOEF*Макет10Выб!PH)/10,
 // joined on the complete address AND IAR. Companion species matter even
 // when POL and ZAP are stored only on the leading row.
 const weighted=sameLayer.reduce((sum,r)=>sum+n(r.KOEF)*n(r.PH),0)/10;
 const height=k59Round(weighted,0);
 if(height===null||height<1||height>39)return status('К59: неоднозначная или недоступная высота в таблице Szap','ambiguous');
 const specie=String(row.POR).trim();
 const cul=(([2,4,7].includes(category)&&['С','СО'].includes(specie))||
   (n(row.IAR)===5&&['С','СО'].includes(specie)))?'К':
   n(record.POS)===1424&&specie==='Л'?'З':'.';
 // Diagnose the *actual* failed Access join, never label a zero match
 // "ambiguous" and never silently map a zone to a neighbouring norm.
 const kPz=n(quarterRow?.Kpz);
 const {regionRows,availableZones,zoneOptions}=stockZoneOptions(refs,region,kPz);
 const zoneRows=regionRows.filter(r=>same(r.LXZ,zone));
 const zoneDetail='KTO '+region+', LXZ '+zone+', POR '+specie+', KUL '+cul+
   (kPz===null?'':', Kpz '+kPz);
 if(!regionRows.length)return status('К59: для KTO '+region+' в исходной Szap вообще нет таблиц запаса','unavailable');
 if(!zoneRows.length)return {status:'unsupported-zone',reason:
   'К59: для '+zoneDetail+' нет нормативной строки, потому что зона LXZ '+zone+
   ' не представлена в Szap этой области. Доступные зоны: '+availableZones.join(', ')+
   '. Проверьте Квартал.Klxr и природную зону Kpz; исходный ZAP не подтверждён.',
   region,zone,species:specie,kpz:kPz,availableZones,zoneOptions};
 const speciesRows=zoneRows.filter(r=>same(r.p1,row.POR));
 if(!speciesRows.length)return {status:'unavailable',reason:
   'К59: зона LXZ '+zone+' есть в Szap для KTO '+region+
   ', но нет породы POR '+specie+'. Проверяйте шифр породы; ZAP не подтверждён.',
   region,zone,species:specie,availableZones,zoneOptions};
 const rows=speciesRows.filter(r=>same(r.KUL,cul));
 if(!rows.length)return {status:'unavailable',reason:
   'К59: для '+zoneDetail+' отсутствует KUL '+cul+
   '. Доступны KUL: '+[...new Set(speciesRows.map(r=>String(r.KUL)))].join(', ')+
   '. Нельзя заменять группу культур наугад.',
   region,zone,species:specie,availableZones,zoneOptions};
 if(rows.length!==1)return {status:'ambiguous',reason:
   'К59: в исходной Szap найдено '+rows.length+' строк для '+zoneDetail+
   ', автоматический норматив неоднозначен.',region,zone,species:specie,availableZones,zoneOptions};
 const v=n(rows[0]['v'+height]),pol=n(row.POL);
 if(v===null||v<=0)return status('К59: нет нормативного запаса для этой высоты','ambiguous');
 if(pol>1)return status('К59: относительная полнота вне диапазона 0–1','ambiguous');
 const standard=k59Round(v*pol,0);
 if(standard===null)return status('К59: расчёт попал на неоднозначное округление','ambiguous');
 let expected=standard,source='Szap, высота '+height+' м, полнота '+pol;
 // An omitted table is not the same as a verified LEFT JOIN with no rows.
 if(!Array.isArray(refs.SzapCK))return status('К59: таблица SzapCK отсутствует; выбор нормативной ветви не подтверждён','unavailable');
 const CK=refs.SzapCK.filter(r=>same(r.Obl,region)&&same(r.p1,row.POR)&&same(r.Boni,record.M3B));
 if(CK.length>1)return status('К59: несколько совпадающих таблиц SzapCK','ambiguous');
 const species=(refs.SDP_Tip||refs.SDP||[]).filter(r=>same(r.KPC,row.POR));
 if(species.length!==1||n(species[0].NDR)===null)
  return status('К59: нет единственной исходной группы SDP_Tip.NDR','unavailable');
 const ndr=n(species[0].NDR);
 // ВыделЛес.GodT1 is explicitly projected from Квартал.GodT.
 if(n(record.GodT1)!==null&&n(quarterRow?.GodT)!==null&&n(record.GodT1)!==n(quarterRow.GodT))
  return status('К59: GodT1 расходится с Квартал.GodT; требуется обновить контекст','ambiguous');
 const year=n(quarterRow?.GodT)??n(record.GodT1),step=k59Round(weighted,1);
 const col='v'+Math.round(step*10).toString().padStart(2,'0')+'c';
 // The saved expression enumerates heights 0.5..3.8; outside that
 // domain its three IIf branches are zero even on an unmatched LEFT JOIN.
 const ckValue=step>=0.5&&step<=3.8?(CK.length?n(CK[0][col]):null):0;
 if(year===null&&(ndr===4||ckValue!==null&&ckValue>0))
  return status('К59: для выбора SzapCK нужен исходный GodT1 (Квартал.GodT)','ambiguous');
 if(year>2016&&(ndr===4||ckValue!==null&&ckValue>0)){
  if(ckValue===null)return status('К59: исходная ветвь NDR=4 требует значение SzapCK, а не подмену таблицей Szap','unavailable');
  expected=k59Round(ckValue*pol,ndr===4?1:0);
  source='SzapCK, высота '+step+' м, полнота '+pol+', год '+year;
 }
 return {status:'complete',field:'ZAP',index,expected,layer:n(layer),weightedHeight:weighted,composition:sameLayer.map(r=>({por:r.POR,coef:n(r.KOEF),height:n(r.PH)})),reason:'К59 · Σ(коэфф. × высота)/10 = '+weighted+' м · '+source+
  ' · POR '+specie+', KTO '+region+', LXZ '+zone+', KUL '+cul};
}
function corrections(record,refs,org,quarterRow=null){
 const issues=[],unknown=[];
 const b=bonitet(record,refs,quarterRow);
 if(b.status==='complete'&&defined(record.M3B)&&!same(record.M3B,b.expected))
  issues.push({field:'M3B',label:'Бонитет',previous:String(record.M3B),expected:String(b.expected),reason:b.reason});
 else if(b.status==='complete'&&!defined(record.M3B))
  issues.push({field:'M3B',label:'Бонитет',previous:'Не указан',expected:String(b.expected),reason:b.reason});
 else if(b.status!=='complete')unknown.push({field:'M3B',...b});
 // If K58 gave an unambiguous new bonitet, subsequent SzapCK lookup
 // must use that value, never the stale manually entered class.
 const bonitetChecked=b.status==='complete'&&!same(record.M3B,b.expected)?
   {...record,M3B:b.expected}:record;
 const layers=[...new Set((record?._children?.Макет10||[]).filter(r=>childMatches(record,r)&&[1,2,3,5].includes(n(r.IAR))).map(r=>n(r.IAR)))];
 const layerCalculations=layers.map(iar=>({...stockPerHectare(bonitetChecked,refs,org,quarterRow,iar),layer:iar}));
 const k59=layerCalculations.find(x=>x.layer===1)||layerCalculations[0]||stockPerHectare(bonitetChecked,refs,org,quarterRow);
 let computedRecord={...record,_children:{...record._children,Макет10:(record?._children?.Макет10||[]).map(r=>({...r}))}};
 // A source observation is not an UPDATE rule. Never erase a companion's
 // entered stock (or replace NULL with zero) merely to make totals pass.
 unknown.push(...companionStockIssues(record));
 for(const result of layerCalculations){
  if(result.status!=='complete'){unknown.push({field:'ZAP',...result});continue;}
  const current=record._children.Макет10[result.index].ZAP;
  if(!defined(current)||n(current)!==result.expected){
   issues.push({field:'ZAP',scope:'Макет10',index:result.index,label:'Запас яруса '+result.layer+' на 1 га, м³/га',
     previous:defined(current)?String(current):'Не указан',expected:result.expected,reason:result.reason});
   computedRecord._children.Макет10[result.index].ZAP=result.expected;
  }
 }
 if(!layers.length)unknown.push({field:'ZAP',...k59});
 const blocked=layerCalculations.filter(x=>x.status==='waiting'&&/коэффициент|состав|высоту|сумма/.test(x.reason));
 const stock=blocked.length?status(blocked.map(x=>x.reason).join('; '),'waiting'):standStock(computedRecord);
 const sourceStock=sourceStandStock(computedRecord);
 const standStockVerified=stock.status==='complete'&&sourceStock.status==='complete'&&
  stock.expectedPerHa===sourceStock.expectedPerHa&&stock.expectedTotal===sourceStock.expectedTotal;
 if(standStockVerified){
  for(const [field,label,expected] of [['STUR1','Запас на 1 га, м³/га',stock.expectedPerHa],['STUR','Запас выдела, м³',stock.expectedTotal]]){
   const value=record?.[field];
   if(!defined(value)||n(value)!==expected)
    issues.push({field,label,previous:defined(value)?String(value):'Не указан',expected,reason:stock.reason});
  }
 }else unknown.push({field:'STUR',...stock,status:stock.status==='complete'?'unverified':stock.status,
  reason:stock.status==='complete'?'Живой запас подсчитан, но совпадение с исходным Макет10ЗАП1 не подтверждено. STUR1 и STUR сохранены. '+sourceStock.reason:stock.reason});
 return {issues,unknown,bonitet:b,standStock:stock,originalStandStock:sourceStock,standStockVerified,stockPerHectare:k59,layerCalculations};
}
window.SolinCardCalculations={bonitet,standStock,sourceStandStock,stockBreakdown,stockPerHectare,stockZoneOptions,companionStockIssues,compositionAudit,cardIntegrity,corrections,safeRoundHalf,accessRound,k59Round};
})();