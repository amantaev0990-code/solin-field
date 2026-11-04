package kz.solin.field;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.HashMap;
import java.util.Map;

/** Foreground GNSS, including flight mode and devices without Google Play.
 * No Google location accuracy / network service is required by GPS_PROVIDER. */
@CapacitorPlugin(name="SolinLocation",permissions={
  @Permission(alias="location",strings={Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION})
})
public class SolinLocationPlugin extends Plugin {
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final Map<String,FixRequest> requests=new HashMap<>();
  private boolean allowed() {
    return ContextCompat.checkSelfPermission(getContext(),Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(getContext(),Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
  }
  @PluginMethod public void getCurrentPosition(PluginCall call) { request(call); }
  @PluginMethod(returnType=PluginMethod.RETURN_CALLBACK)
  public void watchPosition(PluginCall call) { call.setKeepAlive(true); request(call); }
  private void request(PluginCall call) {
    if(!allowed()){requestPermissionForAlias("location",call,"permissionResult");return;}
    handler.post(()->start(call));
  }
  @PermissionCallback private void permissionResult(PluginCall call) {
    if(!allowed()){call.setKeepAlive(false);call.reject("Разрешите приложению доступ к местоположению в настройках Android","PERMISSION_DENIED");return;}
    handler.post(()->start(call));
  }
  static JSObject position(Location location) {
    JSObject coords=new JSObject();
    coords.put("latitude",location.getLatitude());coords.put("longitude",location.getLongitude());
    coords.put("accuracy",location.hasAccuracy()?location.getAccuracy():null);
    coords.put("altitude",location.hasAltitude()?location.getAltitude():null);
    coords.put("heading",location.hasBearing()?location.getBearing():null);
    coords.put("speed",location.hasSpeed()?location.getSpeed():null);
    JSObject result=new JSObject();result.put("coords",coords);result.put("timestamp",location.getTime());
    result.put("provider",location.getProvider());return result;
  }
  static boolean fresh(Location location,long maximumAgeMs) {
    return location!=null && location.getElapsedRealtimeNanos()>0 &&
      SystemClock.elapsedRealtimeNanos()-location.getElapsedRealtimeNanos()>=0 &&
      SystemClock.elapsedRealtimeNanos()-location.getElapsedRealtimeNanos()<=maximumAgeMs*1000000L;
  }
  private void start(PluginCall call) {
    LocationManager manager=(LocationManager)getContext().getSystemService(Context.LOCATION_SERVICE);
    if(manager==null){call.setKeepAlive(false);call.reject("На устройстве нет службы местоположения","UNAVAILABLE");return;}
    boolean hasGps=manager.getAllProviders().contains(LocationManager.GPS_PROVIDER);
    boolean gps=hasGps&&manager.isProviderEnabled(LocationManager.GPS_PROVIDER);
    boolean network=manager.getAllProviders().contains(LocationManager.NETWORK_PROVIDER)&&manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    if(!gps&&!network){
      call.setKeepAlive(false);
      call.reject(hasGps?"Включите «Местоположение» в настройках Android. GPS работает и без интернета":"На планшете нет доступного GPS-приёмника","GPS_DISABLED");return;
    }
    FixRequest request=new FixRequest(call,manager);requests.put(call.getCallbackId(),request);
    try{
      // Register GNSS independently: NETWORK_PROVIDER must never gate GPS.
      if(gps)manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,1000,0,request,Looper.getMainLooper());
      if(network)manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,1000,0,request,Looper.getMainLooper());
      long maxAge=Math.max(0,Math.min(call.getLong("maximumAge",0L),60000));
      Location last=gps?manager.getLastKnownLocation(LocationManager.GPS_PROVIDER):null;
      if(!fresh(last,maxAge)&&network)last=manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
      if(fresh(last,maxAge))request.onLocationChanged(last);
      if(!request.closed)handler.postDelayed(request.timeout,Math.max(15000,Math.min(call.getLong("timeout",60000L),120000)));
    }catch(SecurityException e){request.fail("Разрешите точное местоположение для SOLI-N Field","PERMISSION_DENIED");}
    catch(Exception e){request.fail("Не удалось запустить GPS: "+e.getMessage(),"UNAVAILABLE");}
  }
  private final class FixRequest implements LocationListener {
    final PluginCall call;final LocationManager manager;boolean closed=false,received=false;
    final Runnable timeout=()->{if(!received)fail("GPS пока не получил сигнал. Выйдите на открытое место и повторите поиск","TIMEOUT");};
    FixRequest(PluginCall call,LocationManager manager){this.call=call;this.manager=manager;}
    @Override public void onLocationChanged(Location location) {
      if(closed||!fresh(location,60000))return;
      received=true;handler.removeCallbacks(timeout);call.resolve(position(location));
      if(!call.isKeptAlive())close();
    }
    @Override public void onProviderDisabled(String provider) {
      if(!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)&&!manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
        fail("Местоположение выключено в настройках Android","GPS_DISABLED");
    }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onStatusChanged(String provider,int status,Bundle extras) {}
    void fail(String message,String code){if(closed)return;call.setKeepAlive(false);call.reject(message,code);close();}
    void close(){if(closed)return;closed=true;handler.removeCallbacks(timeout);manager.removeUpdates(this);requests.remove(call.getCallbackId());getBridge().releaseCall(call);}
  }
  @PluginMethod public void clearWatch(PluginCall call) {
    handler.post(()->{FixRequest r=requests.get(call.getString("id",""));if(r!=null)r.close();call.resolve();});
  }
  @Override protected void handleOnPause(){handler.post(()->{for(FixRequest r:requests.values().toArray(new FixRequest[0]))r.fail("Поиск GPS приостановлен. Нажмите GPS после возврата в приложение","PAUSED");});}
  @Override protected void handleOnDestroy(){handler.post(()->{for(FixRequest r:requests.values().toArray(new FixRequest[0]))r.close();});}
}
