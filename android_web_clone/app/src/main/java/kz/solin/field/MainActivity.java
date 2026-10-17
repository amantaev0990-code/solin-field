package kz.solin.field;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final int PICK_FILES = 901;
    private static final int GPS_PERMISSION = 902;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private GeolocationPermissions.Callback gpsCallback;
    private String gpsOrigin;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(6, 37, 20));
        getWindow().setNavigationBarColor(Color.rgb(6, 37, 20));

        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new NativeFiles(), "SolinAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(
                    String origin, GeolocationPermissions.Callback callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    gpsOrigin = origin;
                    gpsCallback = callback;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION}, GPS_PERMISSION);
                }
            }

            @Override public boolean onShowFileChooser(WebView view,
                    ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, PICK_FILES);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "Невозможно открыть файл", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, size) -> {
            if (!url.startsWith("https://")) return;
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                req.setMimeType(mime);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "solin-download");
                ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
            } catch (Exception e) {
                Toast.makeText(this, "Ошибка загрузки файла", Toast.LENGTH_LONG).show();
            }
        });
        setContentView(web);
        web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == PICK_FILES && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code, permissions, grants);
        if (code == GPS_PERMISSION && gpsCallback != null) {
            boolean allowed = false;
            for (int grant : grants) if (grant == PackageManager.PERMISSION_GRANTED) allowed = true;
            gpsCallback.invoke(gpsOrigin, allowed, false);
            gpsCallback = null;
            gpsOrigin = null;
        }
    }

    @Override public void onBackPressed() {
        // Return to original SOLI-N screens instead of unexpectedly exiting the app.
        web.evaluateJavascript("(function(){var m=document.getElementById('modal');" +
            "if(m&&!m.classList.contains('hidden')){closeModal();return true;}" +
            "var c=document.getElementById('card');" +
            "if(c&&c.classList.contains('active')){show('quartersScreen');return true;}" +
            "return false;})()", handled -> {
                if (!"true".equals(handled)) {
                    if (web.canGoBack()) web.goBack();
                    else MainActivity.super.onBackPressed();
                }
            });
    }

    @Override protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    private class NativeFiles {
        @JavascriptInterface public void saveBase64(String filename, String base64, String mime) {
            new Thread(() -> {
                try {
                    String name = filename.replaceAll("[/\\\\]", "_");
                    if (name.isEmpty()) name = "solin-export.bin";
                    byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                    OutputStream out;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                        values.put(MediaStore.Downloads.MIME_TYPE,
                                mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SOLI-N");
                        Uri dest = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (dest == null) throw new IllegalStateException("Не удалось создать файл");
                        out = getContentResolver().openOutputStream(dest);
                    } else {
                        File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "SOLI-N");
                        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Каталог недоступен");
                        out = new FileOutputStream(new File(dir, name));
                    }
                    if (out == null) throw new IllegalStateException("Запись недоступна");
                    try (OutputStream stream = out) { stream.write(bytes); }
                    runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Сохранено в Загрузки / SOLI-N", Toast.LENGTH_LONG).show());
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Ошибка экспорта: " + e.getMessage(), Toast.LENGTH_LONG).show());
                }
            }).start();
        }
    }
}
