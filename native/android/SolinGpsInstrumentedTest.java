package kz.solin.field;

import static androidx.test.platform.app.InstrumentationRegistry.getInstrumentation;
import static org.junit.Assert.*;
import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.location.Criteria;
import android.location.Location;
import android.location.LocationManager;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Exercise the native permission, Capacitor callback and GPS_PROVIDER path
 * with airplane mode enabled. Test positions never leave this emulator. */
@RunWith(AndroidJUnit4.class)
public class SolinGpsInstrumentedTest {
  private void shell(String command) throws Exception {
    try(android.os.ParcelFileDescriptor fd=getInstrumentation().getUiAutomation().executeShellCommand(command);
        java.io.FileInputStream stream=new java.io.FileInputStream(fd.getFileDescriptor())) {
      byte[] buffer=new byte[1024];while(stream.read(buffer)!=-1){}
    }
  }
  private WebView find(View view){
    if(view instanceof WebView)return (WebView)view;
    if(view instanceof ViewGroup){ViewGroup g=(ViewGroup)view;for(int i=0;i<g.getChildCount();i++){WebView v=find(g.getChildAt(i));if(v!=null)return v;}}
    return null;
  }
  private String eval(WebView view,String js) throws Exception {
    CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
    getInstrumentation().runOnMainSync(()->view.evaluateJavascript(js,v->{result.set(v);latch.countDown();}));
    assertTrue(latch.await(10,TimeUnit.SECONDS));return result.get();
  }
  @Test public void nativeGnssReturnsPositionInAirplaneMode() throws Exception {
    Context context=getInstrumentation().getTargetContext();String packageName=context.getPackageName();
    getInstrumentation().getUiAutomation().grantRuntimePermission(packageName,Manifest.permission.ACCESS_COARSE_LOCATION);
    getInstrumentation().getUiAutomation().grantRuntimePermission(packageName,Manifest.permission.ACCESS_FINE_LOCATION);
    shell("appops set "+packageName+" android:mock_location allow");
    shell("cmd connectivity airplane-mode enable");
    shell("cmd location set-location-enabled true");
    LocationManager manager=(LocationManager)context.getSystemService(Context.LOCATION_SERVICE);
    Activity activity=null;boolean mock=false;
    try{
      manager.addTestProvider(LocationManager.GPS_PROVIDER,false,true,false,false,true,true,true,Criteria.POWER_LOW,Criteria.ACCURACY_FINE);
      mock=true;manager.setTestProviderEnabled(LocationManager.GPS_PROVIDER,true);
      Intent launch=new Intent(context,MainActivity.class);launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);
      activity=getInstrumentation().startActivitySync(launch);
      AtomicReference<WebView> ref=new AtomicReference<>();Activity running=activity;
      getInstrumentation().runOnMainSync(()->ref.set(find(running.getWindow().getDecorView())));
      WebView view=ref.get();assertNotNull(view);
      boolean ready=false;
      for(int i=0;i<80;i++){
        if("true".equals(eval(view,"!!(window.SolinLocation&&window.Capacitor?.isPluginAvailable?.('SolinLocation'))"))){ready=true;break;}
        SystemClock.sleep(250);
      }
      assertTrue("Native GNSS plugin was not registered in the actual APK",ready);
      eval(view,"window.__gpsResult='pending';SolinLocation.current({timeout:15000}).then(p=>window.__gpsResult=JSON.stringify(p)).catch(e=>window.__gpsResult=JSON.stringify({error:e.message}));'started'");
      JSONObject result=null;
      for(int i=0;i<40;i++){
        Location fix=new Location(LocationManager.GPS_PROVIDER);fix.setLatitude(50.123456);fix.setLongitude(59.987654);
        fix.setAccuracy(3);fix.setTime(System.currentTimeMillis());fix.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
        manager.setTestProviderLocation(LocationManager.GPS_PROVIDER,fix);SystemClock.sleep(250);
        String value=eval(view,"window.__gpsResult");Object decoded=new org.json.JSONTokener(value).nextValue();
        if(decoded instanceof String&&!decoded.equals("pending")){result=new JSONObject((String)decoded);break;}
      }
      assertNotNull("GNSS callback timed out in airplane mode",result);
      assertFalse("Native location failed: "+result,result.has("error"));
      assertEquals(50.123456,result.getJSONObject("coords").getDouble("latitude"),0.000001);
      assertEquals(59.987654,result.getJSONObject("coords").getDouble("longitude"),0.000001);
      assertEquals("gps",result.getString("provider"));
      System.out.println("SOLIN_NATIVE_GPS_AIRPLANE_OK: "+result);
    }finally{
      if(activity!=null){Activity running=activity;getInstrumentation().runOnMainSync(running::finish);}
      if(mock)manager.removeTestProvider(LocationManager.GPS_PROVIDER);
      shell("cmd connectivity airplane-mode disable");
      shell("appops set "+packageName+" android:mock_location default");
    }
  }
}
