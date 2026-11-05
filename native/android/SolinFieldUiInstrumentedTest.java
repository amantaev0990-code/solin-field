package kz.solin.field;

import static androidx.test.platform.app.InstrumentationRegistry.getInstrumentation;
import static org.junit.Assert.*;

import android.app.Activity;
import android.content.Intent;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Checks the real Capacitor WebView in an Android emulator, not a browser
 * pretending to be native. Ensures the GitHub Pages UI, forest and Maket10
 * controls are mounted on native Android with local app assets. */
@RunWith(AndroidJUnit4.class)
public class SolinFieldUiInstrumentedTest {
  private WebView locate(View view) {
    if(view instanceof WebView) return (WebView)view;
    if(view instanceof ViewGroup) {
      ViewGroup group=(ViewGroup)view;
      for(int i=0;i<group.getChildCount();i++) {
        WebView found=locate(group.getChildAt(i));
        if(found!=null)return found;
      }
    }
    return null;
  }

  private String eval(WebView webview,String source) throws Exception {
    CountDownLatch finished=new CountDownLatch(1);
    AtomicReference<String> result=new AtomicReference<>("");
    getInstrumentation().runOnMainSync(()->webview.evaluateJavascript(source,value->{
      result.set(value);finished.countDown();
    }));
    assertTrue("Android WebView JS callback timed out",finished.await(12,TimeUnit.SECONDS));
    return result.get();
  }

  private JSONObject parseJsonString(String encoded) throws Exception {
    String decoded=(String)new org.json.JSONTokener(encoded).nextValue();
    return new JSONObject(decoded);
  }

  @Test public void nativeApkRunsSameForestAndTaxCardAsGithubPages() throws Exception {
    Intent launch=new Intent(getInstrumentation().getTargetContext(),MainActivity.class);
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);
    Activity activity=getInstrumentation().startActivitySync(launch);
    assertNotNull("Capacitor MainActivity failed to start",activity);
    try{
      getInstrumentation().waitForIdleSync();
      AtomicReference<WebView> found=new AtomicReference<>();
      getInstrumentation().runOnMainSync(()->found.set(locate(activity.getWindow().getDecorView())));
      WebView webview=found.get();
      assertNotNull("Capacitor WebView missing",webview);
      boolean ready=false;
      String diagnostic="";
      for(int tries=0;tries<80;tries++){
        String output=eval(webview,"JSON.stringify({href:location.href,loaded:!!(typeof D!=='undefined' && D.quarters),"+
         "ready:!!window.SolinWorkspace,editor:!!window.SolinCardEditor,main:document.querySelector('.brand h1')?.textContent,"+
         "status:document.getElementById('forestListStatus')?.textContent||'',screen:document.querySelector('.screen.active')?.id})");
        diagnostic=output;
        if(output!=null&&!output.equals("null")){
          JSONObject obj=parseJsonString(output);
          if(obj.optBoolean("loaded")&&obj.optBoolean("ready")&&obj.optBoolean("editor")){
            assertEquals("SOLI-N Field",obj.optString("main"));
            assertTrue("Must load local bundled UI, not Flutter: "+obj,
              obj.optString("href").startsWith("https://localhost")||
              obj.optString("href").startsWith("http://localhost"));
            ready=true;break;
          }
        }
        SystemClock.sleep(500);
      }
      assertTrue("Native WebView failed to mount approved PWA after 40s: "+diagnostic,ready);
      // Ensure source tables are populated in the native WebView; without
      // these the dependent controls render grey with no choices.
      JSONObject references=null;
      for(int i=0;i<40;i++){
        String value=eval(webview,"JSON.stringify({refs:!!window.SOLIN_REFS,tables:Object.keys(window.SOLIN_REFS?.tables||{}).length,"+
          "gzip:typeof DecompressionStream,sku:window.SOLIN_REFS?.tables?.SKU?.length||0,"+
          "siar:window.SOLIN_REFS?.tables?.SIAR?.length||0,species:window.SOLIN_REFS?.tables?.SDP_Tip?.length||0})");
        references=parseJsonString(value);
        if(references.optInt("tables")>=100)break;
        SystemClock.sleep(500);
      }
      System.out.println("SOLIN_ANDROID_REFERENCE_DIAGNOSTIC: "+references);
      assertTrue("Android missing full forestry reference tables; dependent choices stay disabled: "+references,
        references!=null&&references.optInt("tables")>=100);
      eval(webview,"window.__solinNativeParity='pending';(async()=>{"+
       "await SolinWorkspace.ready;"+
       "const forests=await SolinWorkspace.list();if(!forests.length)throw Error('No forest fixture');"+
       "await SolinWorkspace.activate(forests[0].id);"+
       "const id=Object.keys(D.quarters).find(k=>D.quarters[k]?.compartments?.length);"+
       "if(!id)throw Error('No forest stand');"+
       "current=D.quarters[id].compartments[0];renderComp();show('card');"+
       "const originalFields=document.querySelectorAll('#humanContent .humanField').length;"+
       "if(!originalFields)throw Error('Missing human tax card');"+
       "SolinCardEditor.open(current);"+
       "const ku=document.querySelector('.dt-board select[data-ce-scope=\\\"base\\\"][data-ce-field=\\\"KU\\\"]');"+
       "if(!ku||ku.disabled||ku.options.length<2)throw Error('Android KU choices unavailable');"+
       "ku.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch'}));"+
       "const keyboardField=document.activeElement?.id;"+
       "return {keyboardField,kuChoices:ku.options.length,nativePicker:!!window.SolinAndroidSelects,forests:forests.length,fields:originalFields,maket10:!!document.getElementById('ce-section-10'),"+
       "modal:!document.getElementById('modal').classList.contains('hidden'),"+
       "title:document.querySelector('#modalTitle')?.textContent};"+
       "})().then(x=>window.__solinNativeParity=JSON.stringify(x)).catch(e=>window.__solinNativeParity=JSON.stringify({error:String(e.message||e)}));"+
       "'started'");
      JSONObject result=null;
      for(int tries=0;tries<60;tries++){
        String v=eval(webview,"window.__solinNativeParity||'pending'");
        Object decoded=new org.json.JSONTokener(v).nextValue();
        if(decoded instanceof String && !decoded.equals("pending")){
          result=new JSONObject((String)decoded);break;
        }
        SystemClock.sleep(500);
      }
      assertNotNull("Native tax card did not load",result);
      assertFalse("Native forest/card exception: "+result,result.has("error"));
      assertTrue("Native forest missing",result.optInt("forests")>=1);
      assertTrue("Android tax card fields missing",result.optInt("fields")>=1);
      assertTrue("Android classic Maket10 missing",result.optBoolean("maket10"));
      assertTrue("Android tax-card edit dialog missing",result.optBoolean("modal"));
      assertTrue("Native Android selector helper missing",result.optBoolean("nativePicker"));
      assertTrue("KU contains no selectable source-backed values",result.optInt("kuChoices")>=2);
      assertEquals("Android taxonomy search must receive keyboard focus", "ce-assist-query",result.optString("keyboardField"));
      // The user's failing mixed stand must calculate in a REAL Android
      // WebView, not only in the desktop/browser test harness.
      eval(webview,"window.__mixedNative='pending';(async()=>{"+
       "document.querySelector('#ce-assist [data-ce-assist-close]')?.click();document.getElementById('ce-cancel')?.click();"+
       "const r=JSON.parse(JSON.stringify(current));Object.assign(r,{KU:2,PLV:2,KlxrVD:8,GodT1:2015,M3Pr:'ОС',STUR1:0,STUR:0});"+
       "const quarter=SolinAddressContext.resolveQuarter(r,D.quarters[String(r.KV)]);if(quarter)quarter.GodT=2015;"+
       "D.lesnichestvo[0].KTO=150000000;const address=Object.fromEntries(['POS','LESN','KV','KGLF','VD'].map(k=>[k,r[k]]));"+
       "r._children={Макет10:[{...address,IAR:1,POR:'ОС',KOEF:6,PH:20,POL:.6,LET:40,PROI:7,ZAP:null},"+
       "{...address,IAR:1,POR:'Б',KOEF:4,PH:null,POL:null,LET:40,PROI:7,ZAP:null}]};"+
       "current=r;SolinCardEditor.open(r);"+
       "const h=[...document.querySelectorAll('#ce-form [data-ce-field]')].find(e=>e.dataset.ceScope==='Макет10'&&e.dataset.ceField==='PH'&&e.dataset.ceRow==='1');"+
       "h.value='18';h.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(done=>setTimeout(done,500));"+
       "const read=f=>Number([...document.querySelectorAll('#ce-form [data-ce-field]')].find(e=>e.dataset.ceScope==='base'&&e.dataset.ceField===f).value);"+
       "return {perHa:read('STUR1'),total:read('STUR'),saved:current.STUR1};"+
       "})().then(x=>window.__mixedNative=JSON.stringify(x)).catch(e=>window.__mixedNative=JSON.stringify({error:e.message}));'started'");
      JSONObject mixed=null;
      for(int i=0;i<40;i++){
        Object value=new org.json.JSONTokener(eval(webview,"window.__mixedNative")).nextValue();
        if(value instanceof String&&!value.equals("pending")){mixed=new JSONObject((String)value);break;}
        SystemClock.sleep(250);
      }
      assertNotNull("6ОС+4Б native calculation timed out",mixed);
      assertFalse("Mixed stand calculation error: "+mixed,mixed.has("error"));
      assertEquals("Original Szap.v19=287, rounded 287*0.6",172,mixed.getInt("perHa"));
      assertEquals(344,mixed.getInt("total"));assertEquals("Do not write until Save",0,mixed.getInt("saved"));
      JSONObject sourceRules=parseJsonString(eval(webview,"JSON.stringify((()=>{"+
        "const r={POS:213,LESN:2,KV:1,KGLF:27,VD:'1',KU:1,M3Pr:'Б',M3B:'3',GodT1:2016,"+
        "_children:{Макет10:[{IAR:1,POR:'ОС',POL:.5,PROI:7,LET:5,PH:.6,ZAP:40}]}};"+
        "const refs=SOLIN_REFS.tables,before=JSON.stringify(r),early=SolinCardCalculations.bonitet(r,refs);"+
        "const later=SolinCardCalculations.bonitet({...r,GodT1:2026},refs);"+
        "const special=SolinCardCalculations.bonitet({...r,M3Pr:'БРК',GodT1:2026},refs);"+
        "const edit=SolinDependentRules.functionalZones({KGLF:5},refs,{form:'Квартал'});"+
        "const create=SolinDependentRules.functionalZones({KGLF:5},refs,{scenario:'create'});"+
        "const cedar={POS:213,LESN:2,KV:1,KGLF:27,VD:'001',KU:1,KlxrVD:17,M3TLU:'КЕР',"+
        "_children:{Макет10:[{IAR:1,POR:'К',KOEF:1,LET:202,POL:.3,ZAP:40}]}};"+
        "const material=SolinMaket16.creationPreview(cedar,refs);"+
        "return {early:early.expected,later:later.expected,special:special.scaleOrigin,"+
        "m16:material.rows?.[0]?.Ur16,m16Type:SolinFieldTypes.type('Макет16','H16'),"+
        "precision:String(SolinFieldTypes.read({value:'0,123457',dataset:{solinInitial:'0,123457'}},.123456789012345,'Макет16','Ediz')),"+
        "edit:edit.items.map(x=>x.value).join(','),create:create.items.map(x=>x.value).join(','),preserved:before===JSON.stringify(r)};"+
        "})())"));
      assertEquals("Pre-2017 low-height K58 branch", "4",sourceRules.getString("early"));
      assertEquals("2017+ K58 branch", "5",sourceRules.getString("later"));
      assertEquals("Second SSHB join uses substituted origin",9,sourceRules.getInt("special"));
      assertEquals("1,2,3,4,12,13,14,15",sourceRules.getString("edit"));
      assertEquals("1,2,3,4",sourceRules.getString("create"));
      assertEquals("Original M16 yield uses even midpoint rounding",162,sourceRules.getInt("m16"));
      assertEquals("H16 stores a forest type code", "text",sourceRules.getString("m16Type"));
      assertEquals("Untouched display must preserve source Double precision", "0.123456789012345",sourceRules.getString("precision"));
      assertTrue("Source-backed previews must not mutate inputs",sourceRules.getBoolean("preserved"));
    } finally {
      getInstrumentation().runOnMainSync(activity::finish);
    }
  }
}
