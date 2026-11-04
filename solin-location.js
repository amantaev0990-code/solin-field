/* One foreground location API for Android GNSS and web geolocation. */
(()=>{'use strict';
 let plugin=null;
 const native=()=>window.Capacitor?.isNativePlatform?.()&&window.Capacitor.getPlatform?.()==='android';
 function android(){
  if(!plugin)plugin=window.Capacitor?.registerPlugin?.('SolinLocation')||window.Capacitor?.Plugins?.SolinLocation;
  if(!plugin)throw Error('Модуль GPS не установлен. Установите обновлённый APK');
  return plugin;
 }
 function message(error){
  if(typeof error?.code==='string')return error.message||'GPS недоступен';
  return ({1:'Разрешите доступ к местоположению для SOLI-N Field',2:'Включите местоположение в Android и выйдите на открытое место',3:'GPS пока не получил сигнал. Выйдите на открытое место и повторите поиск'})[error?.code]||error?.message||'Не удалось получить GPS';
 }
 async function current(options={}){
  const opts={enableHighAccuracy:true,timeout:60000,maximumAge:0,...options};
  try{
   if(native())return await android().getCurrentPosition(opts);
   if(!navigator.geolocation)throw Error('На устройстве недоступна геопозиция');
   return await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,opts));
  }catch(e){throw Error(message(e));}
 }
 function watch(onPosition,onError){
  let stopped=false,id=null;
  const opts={enableHighAccuracy:true,timeout:60000,maximumAge:0};
  if(native()){
   try{
    const api=android();
    Promise.resolve(api.watchPosition(opts,(position,error)=>{
     if(stopped)return;
     if(error)onError(Error(message(error)));else onPosition(position);
    })).then(value=>{id=value;if(stopped)api.clearWatch({id});}).catch(e=>{if(!stopped)onError(Error(message(e)));});
    return ()=>{stopped=true;if(id!==null)void api.clearWatch({id}).catch(()=>{});};
   }catch(e){onError(e);return ()=>{};}
  }
  if(!navigator.geolocation){onError(Error('На устройстве недоступна геопозиция'));return ()=>{};}
  id=navigator.geolocation.watchPosition(onPosition,e=>onError(Error(message(e))),opts);
  return ()=>{stopped=true;navigator.geolocation.clearWatch(id);};
 }
 window.SolinLocation={current,watch,message};
})();
