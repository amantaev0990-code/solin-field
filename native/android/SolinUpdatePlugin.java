package kz.solin.field;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.SignatureException;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Optional sideload updater. It is deliberately isolated from MDB, card and
 * offline-data storage. No file is ever written to the app data directory
 * except a temporary APK in cache/updates, deleted on failure.
 *
 * Android (not the WebView) verifies the APK signature again at installation.
 */
@CapacitorPlugin(name = "SolinUpdate")
public class SolinUpdatePlugin extends Plugin {
  private static final long MAX_APK_BYTES = 250L * 1024L * 1024L;
  private static final String REPO_DOWNLOAD_PREFIX =
      "/amantaev0990-code/solin-field/releases/download/";
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final AtomicBoolean running = new AtomicBoolean(false);

  @PluginMethod
  public void getInfo(PluginCall call) {
    try {
      PackageInfo current = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
      JSObject data = new JSObject();
      data.put("packageId", current.packageName);
      data.put("versionCode", code(current));
      data.put("versionName", current.versionName == null ? "" : current.versionName);
      data.put("canInstall", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
      call.resolve(data);
    } catch (Exception error) {
      call.reject("Не удалось определить установленную версию: " + error.getMessage());
    }
  }

  @PluginMethod
  public void installRelease(PluginCall call) {
    final String link = call.getString("url");
    final String sha = call.getString("sha256");
    if (link == null || !isOriginalGitHubRelease(link)
        || sha == null || !sha.matches("(?i)[0-9a-f]{64}")) {
      call.reject("Недостоверный источник обновления или отсутствует контрольная сумма.");
      return;
    }
    if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
      getActivity().runOnUiThread(() -> {
        try {
          Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
              Uri.parse("package:" + getContext().getPackageName()));
          getActivity().startActivity(settings);
        } catch (Exception ignored) {
          // The user can grant this permission from Android Settings.
        }
      });
      call.reject("Разрешите установку обновлений для SOLI-N Field в настройках Android, затем нажмите «Обновить» повторно.");
      return;
    }
    if (!running.compareAndSet(false, true)) {
      call.reject("Скачивание обновления уже запущено.");
      return;
    }
    executor.execute(() -> {
      File apk = null;
      try {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("Нет папки для обновления.");
        apk = File.createTempFile("solin-update-", ".apk", dir);
        String actualSha = downloadApk(link, apk);
        if (!actualSha.equalsIgnoreCase(sha)) throw new SecurityException("Контрольная сумма APK не совпала.");
        PackageManager pm = getContext().getPackageManager();
        PackageInfo oldPkg = getInstalled(pm);
        PackageInfo newPkg = getArchive(pm, apk);
        if (newPkg == null || !oldPkg.packageName.equals(newPkg.packageName)) {
          throw new SecurityException("APK предназначен для другого приложения.");
        }
        if (code(newPkg) <= code(oldPkg)) {
          throw new SecurityException("Версия обновления не новее установленной.");
        }
        if (!sameCertificate(oldPkg, newPkg)) {
          throw new SecurityException("Подпись APK отличается от постоянного ключа V23.");
        }
        final Uri uri = FileProvider.getUriForFile(getContext(),
            getContext().getPackageName() + ".updater", apk);
        getActivity().runOnUiThread(() -> {
          try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.setClipData(android.content.ClipData.newRawUri("SOLI-N Field update", uri));
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("installerOpened", true);
            result.put("versionCode", code(newPkg));
            call.resolve(result);
          } catch (Exception e) {
            call.reject("Android не смог открыть установщик: " + e.getMessage());
          } finally {
            running.set(false);
          }
        });
        // Keep cached APK until Android finishes reading it from FileProvider.
      } catch (Exception error) {
        if (apk != null) apk.delete();
        running.set(false);
        call.reject("Обновление отменено: " + error.getMessage());
      }
    });
  }

  private PackageInfo getInstalled(PackageManager pm) throws Exception {
    return pm.getPackageInfo(getContext().getPackageName(), flags());
  }
  private PackageInfo getArchive(PackageManager pm, File apk) {
    return pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags());
  }
  private static int flags() {
    return Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
  }
  private static long code(PackageInfo p) {
    return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
  }
  private static boolean sameCertificate(PackageInfo a, PackageInfo b) throws Exception {
    android.content.pm.Signature[] sa = Build.VERSION.SDK_INT >= 28
        ? a.signingInfo.getApkContentsSigners() : a.signatures;
    android.content.pm.Signature[] sb = Build.VERSION.SDK_INT >= 28
        ? b.signingInfo.getApkContentsSigners() : b.signatures;
    if (sa == null || sa.length != 1 || sb == null || sb.length != 1) return false;
    byte[] expected = new byte[] {
      (byte)0x5a,(byte)0x1c,(byte)0x2e,(byte)0x2b,(byte)0xf2,(byte)0xef,(byte)0xe5,(byte)0xaa,
      (byte)0x73,(byte)0x82,(byte)0x67,(byte)0x4b,(byte)0x65,(byte)0x15,(byte)0x33,(byte)0xa1,
      (byte)0x1d,(byte)0x2b,(byte)0x93,(byte)0xc8,(byte)0x02,(byte)0xa1,(byte)0xc0,(byte)0x9a,
      (byte)0xdc,(byte)0x72,(byte)0x65,(byte)0x6c,(byte)0x5a,(byte)0x29,(byte)0xed,(byte)0x7e
    };
    byte[] oldFingerprint = MessageDigest.getInstance("SHA-256").digest(sa[0].toByteArray());
    byte[] newFingerprint = MessageDigest.getInstance("SHA-256").digest(sb[0].toByteArray());
    return MessageDigest.isEqual(oldFingerprint, expected)
        && MessageDigest.isEqual(newFingerprint, expected);
  }
  private static boolean isOriginalGitHubRelease(String link) {
    try {
      Uri u = Uri.parse(link);
      return "https".equalsIgnoreCase(u.getScheme()) &&
          "github.com".equalsIgnoreCase(u.getHost()) &&
          u.getPath() != null && u.getPath().startsWith(REPO_DOWNLOAD_PREFIX) &&
          u.getPath().endsWith(".apk") && u.getUserInfo() == null &&
          u.getPort() == -1;
    } catch (Exception e) { return false; }
  }
  private static boolean safeRedirect(URL url) {
    String host = url.getHost().toLowerCase(Locale.ROOT);
    return "https".equals(url.getProtocol()) &&
      (host.equals("github.com") || host.equals("release-assets.githubusercontent.com")
       || host.equals("objects.githubusercontent.com")
       || host.endsWith(".githubusercontent.com"));
  }
  private static String downloadApk(String location, File target) throws Exception {
    URL url = new URL(location);
    HttpURLConnection conn = null;
    try {
      for (int attempt = 0; attempt < 7; attempt++) {
        if (!safeRedirect(url)) throw new SecurityException("Недоверенный адрес загрузки.");
        conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setRequestProperty("Accept", "application/octet-stream");
        int status = conn.getResponseCode();
        if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
          String next = conn.getHeaderField("Location");
          if (next == null) throw new SecurityException("Нет адреса перенаправления.");
          URL redirected = new URL(url, next);
          conn.disconnect();
          conn = null;
          url = redirected;
          continue;
        }
        if (status != 200) throw new IllegalStateException("GitHub вернул HTTP " + status);
        long size = conn.getContentLengthLong();
        if (size > MAX_APK_BYTES) throw new SecurityException("Файл обновления слишком большой.");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(target)) {
          byte[] buf = new byte[64 * 1024];
          long written = 0;
          int count;
          while ((count = in.read(buf)) != -1) {
            written += count;
            if (written > MAX_APK_BYTES) throw new SecurityException("Превышен максимальный размер APK.");
            digest.update(buf, 0, count);
            out.write(buf, 0, count);
          }
          out.getFD().sync();
          if (written < 1024) throw new IllegalStateException("Скачанный APK пустой.");
        }
        byte[] bytes = digest.digest();
        StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) hex.append(String.format(Locale.US, "%02x", b & 0xff));
        return hex.toString();
      }
      throw new SecurityException("Слишком много перенаправлений.");
    } finally { if (conn != null) conn.disconnect(); }
  }
}
