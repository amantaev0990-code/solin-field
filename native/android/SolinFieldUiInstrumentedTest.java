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
       "return {forests:forests.length,fields:originalFields,maket10:!!document.getElementById('ce-section-10'),"+
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
    } finally {
      getInstrumentation().runOnMainSync(activity::finish);
    }
  }
}
