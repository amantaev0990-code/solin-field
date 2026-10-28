/* EXPERIMENT ONLY — iPhone Safari local Jet MDB writer through CheerpJ.
 * Activated ONLY with ?test-mdb=1. Production Export is not modified.
 * CheerpJ runtime is fetched from its official CDN; the original MDB and
 * Transfer records never leave this browser. No uploaded DB in repository.
 * Requires a compiled converter JAR from the GitHub Actions build.
 */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('test-mdb') !== '1') return;
  const JAR = './vendor/solin-browser-mdb.jar';
  let scriptPromise, runtimePromise, ready = false;
  const button = () => document.getElementById('solin-mdb-export');
  const html = v => String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const jet = buf => {
    const bytes = new Uint8Array(buf,0,Math.min(buf.byteLength,32));
    return bytes.length>=32 &&
      String.fromCharCode(...bytes.subarray(4,19))==='Standard Jet DB';
  };
  const view = (title,content) => {
    if (typeof openModal !== 'function') throw Error('SOLI-N Field не загрузил окно экспорта.');
    openModal(title,content);
  };
  const showError = error => {
    view('Тест MDB — ошибка',
      '<p role="alert">'+html(error?.message||error)+'</p>'+
      '<p>Исходный MDB и карточки не изменены. Веб-экспорт остаётся экспериментальным.</p>'+
      '<button class="primary" onclick="closeModal()">Закрыть</button>');
  };
  function loadRuntime() {
    if (!scriptPromise) scriptPromise = new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cjrtnc.leaningtech.com/4.3/loader.js';
      script.onload=resolve;
      script.onerror=()=>reject(Error('Не удалось загрузить CheerpJ. Для первой загрузки нужен интернет.'));
      document.head.append(script);
    });
    if (!runtimePromise) runtimePromise = (async()=>{
      await scriptPromise;
      if (typeof cheerpjInit !== 'function') throw Error('CheerpJ не поддерживается в этом браузере.');
      await cheerpjInit({version:17,status:'splash'});
    })();
    return runtimePromise;
  }
  function resultFile(blob,filename,tableCount) {
    const href=URL.createObjectURL(blob);
    const name=html(filename);
    view('Тест: настоящий MDB подготовлен',
      '<p><b>'+name+'</b></p>'+
      '<p>Локальная запись завершена. Таблиц в экспортном пакете: '+tableCount+'.</p>'+
      '<div id="solin-iphone-mdb-save"></div>'+
      '<p>Это опытная сборка. Файл необходимо проверить в Access и настольном SOLI-N на резервной копии!</p>'+
      '<button onclick="closeModal()">Закрыть</button>');
    const host=document.getElementById('solin-iphone-mdb-save');
    if (!host) throw Error('Кнопка сохранения не появилась.');
    const anchor=document.createElement('a');
    anchor.href=href;anchor.download=filename;
    anchor.className='primary';anchor.textContent='Сохранить MDB в Файлы';
    anchor.style.cssText='display:block;padding:14px;background:#218546;color:#fff;text-align:center;border-radius:12px;text-decoration:none;font-weight:700;';
    host.append(anchor);
    setTimeout(()=>URL.revokeObjectURL(href),10*60*1000);
  }
  async function convert(file) {
    const b=button();if (b)b.disabled=true;
    try {
      if(!file) return;
      if(file.size<1024||file.size>12_000_000)throw Error('Исходный MDB должен быть от 1 КБ до 12 МБ.');
      const original=await file.arrayBuffer();
      if(!jet(original))throw Error('Выбранный файл не является настоящим Jet MDB.');
      await window.SolinWorkspace?.ready;
      await window.SolinWorkspace?.persist?.();
      const transfer=window.SolinMDBBridge?.snapshot?.();
      if(!transfer||transfer.format!=='SOLIN-MDB-Bridge-v1')throw Error('Не удалось собрать карточки Transfer.');
      const id=transfer.identity;
      const wanted='Transf_'+id.POS+'_'+id.LESN+'_'+id.GodT+'.mdb';
      if(file.name!==wanted && !confirm('Файл '+file.name+' отличается от '+wanted+
         '. Схему и лесничество всё равно проверит конвертер. Продолжить?'))return;
      const res=await fetch(JAR,{method:'HEAD',cache:'no-store'});
      if(!res.ok)throw Error('Конвертер Java ещё не собран или не опубликован. MDB пока не создаётся.');
      view('Создание MDB на iPhone',
           '<p>Запускаю локальный конвертер. Данные не передаются на сервер.</p>'+
           '<p role="status">Первая загрузка Java может потребовать интернет и занимать память устройства.</p>');
      await loadRuntime();
      if(typeof cheerpOSAddStringFile!=='function'||typeof cheerpjRunMain!=='function'||typeof cjFileBlob!=='function')
         throw Error('CheerpJ не предоставил необходимые файловые функции.');
      cheerpOSAddStringFile('/str/solin-template.mdb',new Uint8Array(original));
      cheerpOSAddStringFile('/str/solin-transfer.json',new TextEncoder().encode(JSON.stringify(transfer)));
      const result=await cheerpjRunMain(
        'kz.solin.mdb.BrowserMDBRunner',
        '/app/vendor/solin-browser-mdb.jar',
        '/str/solin-transfer.json','/str/solin-template.mdb','/files/solin-generated.mdb'
      );
      if(result!==0)throw Error('Java остановила преобразование из-за ошибки структуры или несовместимости MDB (код '+result+').');
      const blob=await cjFileBlob('/files/solin-generated.mdb');
      if(blob.size<1024||!jet(await blob.slice(0,32).arrayBuffer()))
        throw Error('Проверка полученного MDB не прошла. Скачивание отменено.');
      ready=true;
      resultFile(blob,'Transf_'+id.POS+'_'+id.LESN+'_'+id.GodT+'_Field.mdb',
        Object.keys(transfer.tables).length);
    }catch(e){showError(e);}
    finally{if(b)b.disabled=false;}
  }
  function start(){
    view('Пробный экспорт MDB — iPhone',
      '<p>Выбери <b>оригинальный Transf_...mdb</b> в «Файлах» на телефоне.</p>'+
      '<p>Данные будут обработаны локально. Это <b>только тест</b>, не проверенный рабочий экспорт.</p>'+
      '<label>Исходный MDB<input id="solin-iphone-template" type="file" accept=".mdb" style="width:100%"></label>'+
      '<button onclick="closeModal()">Отмена</button>');
    const picker=document.getElementById('solin-iphone-template');
    if(picker) picker.onchange=()=>convert(picker.files?.[0]);
  }
  function install(){
    const b=button();
    if(!b)return;
    b.type='button';
    b.innerHTML='<span><b>Экспорт MDB — испытание</b><small>На iPhone, локально; тестовая функция</small></span><span>⇩</span>';
    b.onclick=start;
  }
  window.SolinIphoneMDBLab={start,convert,get isVerified(){return ready;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
