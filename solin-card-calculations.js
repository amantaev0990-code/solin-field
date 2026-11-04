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
 if(Math.abs(fraction-0.5)<1e-8)return (lo%2===0?lo:lo+1)/factor;
 return Math.round(scaled)/factor;
}
// К59_1 uses Int() and an explicit <0.5 comparison: midpoint goes UP.
function k59Round(value,places=0){
 if(!Number.isFinite(value)||value<0)return null;
 const factor=10**places,scaled=value*factor,lo=Math.floor(scaled);
 return (lo+(scaled-lo>=0.5-1e-9?1:0))/factor;
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
// Each Maket 10 row describes a species and a layer. For the Field
// live-stock summary, ALL declared species and ALL live layers (1–6)
// contribute their existing per-hectare ZAP. Categories 7 and 8 are
// independent: isolated trees and fresh deadwood. M4SS is a separate
// existing stand-level drywood value. Never add it to fresh deadwood,
// because the source data may describe overlapping timber.
//
// This is a Field arithmetic summary of entered/computed ZAP values.
// It is NOT a claim that the single-row source K59 stock TABLE formula
// has been validated for a mixed layer.
const LIVE_LAYERS=new Set([1,2,3,4,5,6]);
function stockBreakdown(record){
 const out={included:[],singleTrees:[],freshDeadwood:[],other:[],missing:[],
  invalid:[],duplicates:[],unclassified:[],byLayer:[],bySpecies:[],
  drywoodPerHa:n(record?.M4SS),clutterPerHa:n(record?.M4ZO),liquidClutterPerHa:n(record?.M4ZL)};
 const layers=new Map(),species=new Map(),seen=new Map();
 for(const [index,row]of (record?._children?.Макет10||[]).entries()){
  if(!childMatches(record,row))continue;
  const iar=n(row.IAR),zap=n(row.ZAP),por=String(row.POR??'').trim();
  const item={index:index+1,iar,por:por||null,zap,leading:same(por,record.M3Pr)};
  if(iar===7){out.singleTrees.push(item);if(zap!==null&&zap<0)out.invalid.push(item);continue;}
  if(iar===8){out.freshDeadwood.push(item);if(zap!==null&&zap<0)out.invalid.push(item);continue;}
  if(!LIVE_LAYERS.has(iar)){
   if(zap!==null&&zap!==0)out.unclassified.push(item);
   out.other.push(item);continue;
  }
  if(!por||zap===null){out.missing.push(item);continue;}
  if(zap<0){out.invalid.push(item);continue;}
  const key=iar+'|'+por;
  // Same-species rows in the SAME source Maket10ZAP group can be
  // legitimately aggregated (historical Access behavior). Only conflicting
  // height, age, fullness or coefficient groups are ambiguous.
  const signature=['KOEF','LET','PH','PD2','POL'].map(k=>String(row[k]??'')).join('|');
  if(seen.has(key)&&seen.get(key)!==signature)out.duplicates.push(item);
  else seen.set(key,signature);
  out.included.push(item);
  layers.set(iar,(layers.get(iar)||0)+zap);
  species.set(por,(species.get(por)||0)+zap);
 }
 out.byLayer=[...layers].sort((a,b)=>a[0]-b[0]).map(([iar,zap])=>({iar,zap}));
 out.bySpecies=[...species].map(([por,zap])=>({por,zap}));
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
 if(out.invalid.length)return status('Недопустимый отрицательный запас ZAP в строке макета 10','ambiguous');
 if(out.unclassified.length)return status('Есть строка с запасом ZAP, но без подтверждённого номера яруса','waiting');
 if(out.missing.length)return status('Запас не суммирован: заполните породу POR и запас ZAP у всех '+out.missing.length+
  ' строк живого древостоя (ярусы 1–6)','waiting');
 if(out.duplicates.length)return status('Повторяется порода в одном ярусе с разными возрастом, высотой, полнотой или коэффициентом; исходный запрос даёт неоднозначные группы','ambiguous');
 if(!out.included.length)return status('В макете 10 нет заполненных запасов ZAP живых ярусов 1–6','waiting');
 const perHa=out.livePerHa,total=accessRound(perHa*area,0);
 if(total===null)return status('Невозможно округлить общий запас по правилу Access Round','ambiguous');
 return {status:'complete',reason:'ΣZAP всех пород живых ярусов 1–6 ('+
   out.byLayer.map(x=>'ярус '+x.iar+': '+x.zap).join('; ')+'); свежий сухостой, M4SS и единичные деревья отдельно',
  expectedPerHa:perHa,expectedTotal:total,area,byLayer:out.byLayer,
  bySpecies:out.bySpecies,liveSpeciesCount:out.bySpecies.length,
  freshDeadwoodPerHa:out.freshDeadwoodPerHa,freshDeadwoodTotal:out.freshDeadwoodTotal,
  singleTreesPerHa:out.singleTreesPerHa,singleTreesTotal:out.singleTreesTotal,
  drywoodPerHa:out.drywoodPerHa,drywoodTotal:out.drywoodTotal,
  basis:'arithmetic-entered-ZAP-not-multispecies-K59'};
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
function stockPerHectare(record,refs,org,quarterRow=null){
 if(!refs?.Szap?.length)return status('Таблица запасов Szap недоступна');
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
 const selected=all.map((row,index)=>({row,index})).filter(({row})=>
   childMatches(record,row)&&same(row.POR,record.M3Pr)&&
   [1,2,3,5].includes(n(row.IAR))&&n(row.KOEF)!==null&&n(row.KOEF)!==0&&
   n(row.POL)!==null&&n(row.POL)>0);
 if(selected.length!==1)return status('К59: не найдена однозначная строка основного яруса для расчёта',selected.length?'ambiguous':'waiting');
 const {row,index}=selected[0],sameLayer=all.filter(r=>childMatches(record,r)&&same(r.IAR,row.IAR));
 if(sameLayer.length!==1)return status('К59: несколько строк с одинаковым ярусом; необходимо суммирование по запросу','ambiguous');
 const weighted=n(row.KOEF)*n(row.PH)/10;
 if(!Number.isFinite(weighted)||weighted<=0)return status('К59: не указаны коэффициент состава или высота','waiting');
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
 const standard=k59Round(v*pol,0);
 if(standard===null)return status('К59: расчёт попал на неоднозначное округление','ambiguous');
 let expected=standard,source='Szap, высота '+height+' м, полнота '+pol;
 const CK=(refs.SzapCK||[]).filter(r=>same(r.Obl,region)&&same(r.p1,row.POR)&&same(r.Boni,record.M3B));
 if(CK.length>1)return status('К59: несколько совпадающих таблиц SzapCK','ambiguous');
 if(CK.length){
   const step=k59Round(weighted,1);
   if(step===null)return status('К59: неоднозначное округление высоты в SzapCK','ambiguous');
   const col='v'+Math.round(step*10).toString().padStart(2,'0')+'c';
   const vck=n(CK[0][col]);
   if(vck!==null&&vck>0){
     const year=n(record.GodT1)??n(quarterRow?.GodT);
     // QueryDef uses ВыделВыб.GodT1, NOT the quarter's current GodT.
     if(year===null)return status('К59: для выбора SzapCK нужен исходный GodT1 (год таксации выдела)','ambiguous');
     if(year>2016){
       const species=(refs.SDP_Tip||refs.SDP||[]).find(r=>same(r.KPC,row.POR));
       const ndr=n(species?.NDR);
       if(ndr===null)return status('К59: группа NDR неизвестна для выбора нормы SzapCK','ambiguous');
       expected=k59Round(vck*pol,ndr===4?1:0);
       if(expected===null)return status('К59: неоднозначное округление SzapCK','ambiguous');
       source='SzapCK, высота '+step+' м, полнота '+pol+', год '+year;
     }
   }
 }
 return {status:'complete',field:'ZAP',index,expected,reason:'К59 · '+source+
  ' · POR '+specie+', KTO '+region+', LXZ '+zone+', KUL '+cul};
}
function corrections(record,refs,org,quarterRow=null){
 const issues=[],unknown=[];
 const b=bonitet(record,refs);
 if(b.status==='complete'&&defined(record.M3B)&&!same(record.M3B,b.expected))
  issues.push({field:'M3B',label:'Бонитет',previous:String(record.M3B),expected:String(b.expected),reason:b.reason});
 else if(b.status==='complete'&&!defined(record.M3B))
  issues.push({field:'M3B',label:'Бонитет',previous:'Не указан',expected:String(b.expected),reason:b.reason});
 else if(b.status!=='complete')unknown.push({field:'M3B',...b});
 // If K58 gave an unambiguous new bonitet, subsequent SzapCK lookup
 // must use that value, never the stale manually entered class.
 const bonitetChecked=b.status==='complete'&&!same(record.M3B,b.expected)?
   {...record,M3B:b.expected}:record;
 const k59=stockPerHectare(bonitetChecked,refs,org,quarterRow);
 let computedRecord=record;
 if(k59.status==='complete'){
  const current=record._children.Макет10[k59.index].ZAP;
  if(!defined(current)||n(current)!==k59.expected){
    issues.push({field:'ZAP',scope:'Макет10',index:k59.index,label:'Запас на 1 га (макет 10), м³/га',
      previous:defined(current)?String(current):'Не указан',expected:k59.expected,reason:k59.reason});
    // Recalculate STUR from the corrected per-hectare value, not from
    // the user-entered wrong ZAP; never modify the supplied record.
    const children={...record._children,Макет10:record._children.Макет10.map((r,i)=>
      i===k59.index?{...r,ZAP:k59.expected}:r)};
    computedRecord={...record,_children:children};
  }
 }else unknown.push({field:'ZAP',...k59});
 const stock=standStock(computedRecord);
 if(stock.status==='complete'){
  for(const [field,label,expected] of [['STUR1','Запас на 1 га, м³/га',stock.expectedPerHa],['STUR','Запас выдела, м³',stock.expectedTotal]]){
   const value=record?.[field];
   if(!defined(value)||n(value)!==expected)
    issues.push({field,label,previous:defined(value)?String(value):'Не указан',expected,reason:stock.reason});
  }
 }else unknown.push({field:'STUR',...stock});
 return {issues,unknown,bonitet:b,standStock:stock,stockPerHectare:k59};
}
window.SolinCardCalculations={bonitet,standStock,stockBreakdown,stockPerHectare,stockZoneOptions,corrections,safeRoundHalf,accessRound,k59Round};
})();
