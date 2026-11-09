package kz.solin.field;

import android.content.Intent;
import android.content.Context;
import android.content.BroadcastReceiver;
import android.app.PendingIntent;
import android.content.pm.PackageInstaller;
import android.util.Log;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Optional sideload updater. It is deliberately isolated from MDB, card and
 * offline-data storage. No file is ever written to the app data directory
 * except a temporary APK in cache/updates, deleted on failure.
 *
 * Android (not the WebView) verifies the APK signature again at installation.
 */
@CapacitorPlugin(name = "SolinUpdate")
public class SolinUpdatePlugin extends Plugin {
  private static final String INSTALL_PREFS = "solin-update-installer";
  private static final String INSTALL_ERROR = "lastInstallError";
  private static final String LOG_TAG = "SolinUpdateInstaller";
  private static final long MAX_APK_BYTES = 250L * 1024L * 1024L;
  private static final long DOWNLOAD_TIMEOUT_MS = 240_000L;
  private static final int NETWORK_TIMEOUT_MS = 15_000;
  private static final String REPO_DOWNLOAD_PREFIX =
      "/amantaev0990-code/solin-field/releases/download/";
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final AtomicReference<UpdateTask> activeUpdate = new AtomicReference<>();

  private static final class UpdateTask {
    final String requestId;
    final long deadline = SystemClock.elapsedRealtime() + DOWNLOAD_TIMEOUT_MS;
    volatile boolean cancelled;
    boolean installerOpening;

    UpdateTask(String requestId) {
      this.requestId = requestId;
    }

    int timeLeft() throws IOException {
      if (cancelled) throw new IOException("Загрузка отменена.");
      long remaining = deadline - SystemClock.elapsedRealtime();
      if (remaining <= 0) throw new SocketTimeoutException("Время загрузки APK истекло.");
      return (int) Math.min(remaining, NETWORK_TIMEOUT_MS);
    }
  }

  @PluginMethod
  public void getInfo(PluginCall call) {
    try {
      PackageInfo current = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
      JSObject data = new JSObject();
      data.put("packageId", current.packageName);
      data.put("versionCode", code(current));
      data.put("versionName", current.versionName == null ? "" : current.versionName);
      data.put("canInstall", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
      data.put("updaterProtocol", 3);
      data.put("lastInstallError", getContext().getSharedPreferences(INSTALL_PREFS, Context.MODE_PRIVATE).getString(INSTALL_ERROR, ""));
      call.resolve(data);
    } catch (Exception error) {
      call.reject("Не удалось определить установленную версию: " + error.getMessage());
    }
  }

  @PluginMethod
  public void cancelDownload(PluginCall call) {
    UpdateTask task = activeUpdate.get();
    boolean cancelled = false;
    if (task != null && Objects.equals(task.requestId, call.getString("requestId"))) {
      synchronized (task) {
        if (!task.installerOpening) {
          task.cancelled = true;
          cancelled = true;
        }
      }
    }
    JSObject result = new JSObject();
    result.put("cancelled", cancelled);
    call.resolve(result);
  }

  private void progress(UpdateTask task, String phase, long downloaded, long total) {
    if (task.requestId == null || task.cancelled) return;
    JSObject data = new JSObject();
    data.put("requestId", task.requestId);
    data.put("phase", phase);
    data.put("downloaded", downloaded);
    data.put("total", total);
    notifyListeners("updateProgress", data);
  }

  @PluginMethod
  public void installRelease(PluginCall call) {
    final String link = call.getString("url");
    final String sha = call.getString("sha256");
    final Integer releaseVersion = call.getInt("versionCode");
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
    UpdateTask task = new UpdateTask(call.getString("requestId"));
    if (!activeUpdate.compareAndSet(null, task)) {
      call.reject("Скачивание обновления уже запущено.");
      return;
    }
    executor.execute(() -> {
      File apk = null;
      try {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("Нет папки для обновления.");
        apk = File.createTempFile("solin-update-", ".apk", dir);
        String actualSha = downloadApk(link, apk, task);
        task.timeLeft();
        progress(task, "verify", 0, 0);
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
        if (releaseVersion != null && code(newPkg) != releaseVersion) {
          throw new SecurityException("Версия APK не совпадает с релизом GitHub.");
        }
        if (!sameCertificate(oldPkg, newPkg)) {
          throw new SecurityException("Подпись APK отличается от постоянного ключа V23.");
        }
        // PackageInstaller takes a complete COPY of the APK into its own
        // protected staging area. This avoids parsing failures caused by a
        // ContentProvider stream disappearing before Android has read it.
        // Android still requires user confirmation; Play Protect still runs.
        stageInstall(pm, apk, task, code(newPkg));
        apk.delete();  // PackageInstaller now owns its own verified copy.
        JSObject result = new JSObject();
        result.put("installerOpened", true); // Legacy JS bridge result.
        result.put("installationRequested", true);
        result.put("versionCode", code(newPkg));
        call.resolve(result);
        activeUpdate.compareAndSet(task, null);
      } catch (Exception error) {
        if (apk != null) apk.delete();
        activeUpdate.compareAndSet(task, null);
        call.reject(task.cancelled ? "Загрузка отменена пользователем."
            : "Обновление не удалось: " + error.getMessage());
      }
    });
  }

  private void stageInstall(PackageManager pm, File apk, UpdateTask task, long versionCode)
      throws Exception {
    PackageInstaller installer = pm.getPackageInstaller();
    PackageInstaller.SessionParams params =
        new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
    params.setAppPackageName(getContext().getPackageName());
    params.setSize(apk.length());
    if (Build.VERSION.SDK_INT >= 31) {
      params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
    }
    final int sessionId = installer.createSession(params);
    PackageInstaller.Session session = null;
    boolean committed = false;
    try {
      session = installer.openSession(sessionId);
      try (InputStream input = new FileInputStream(apk);
           OutputStream output = session.openWrite("base.apk", 0, apk.length())) {
        byte[] buffer = new byte[64 * 1024];
        int length;
        while ((length = input.read(buffer)) >= 0) {
          task.timeLeft();
          if (length > 0) output.write(buffer, 0, length);
        }
        session.fsync(output);
      }
      Intent callback = new Intent(getContext(), InstallResultReceiver.class);
      callback.setAction("kz.solin.field.UPDATE_INSTALL_RESULT");
      callback.setPackage(getContext().getPackageName());
      int flags = PendingIntent.FLAG_UPDATE_CURRENT;
      if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
      PendingIntent pendingIntent = PendingIntent.getBroadcast(
          getContext(), sessionId, callback, flags);
      getContext().getSharedPreferences(INSTALL_PREFS, Context.MODE_PRIVATE)
          .edit().remove(INSTALL_ERROR).apply();
      synchronized (task) {
        task.timeLeft();
        task.installerOpening = true;
      }
      session.commit(pendingIntent.getIntentSender());
      committed = true;
      Log.i(LOG_TAG, "Submitted verified APK versionCode=" + versionCode
          + " to Android PackageInstaller session " + sessionId);
    } finally {
      if (session != null) session.close();
      if (!committed) installer.abandonSession(sessionId);
    }
  }

  /**
   * Explicit, non-exported receiver. It handles Android's confirmation UI,
   * not a custom installer or a bypass of device security checks.
   */
  public static class InstallResultReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
      int status = intent.getIntExtra(
          PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
      if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
        Intent confirm;
        if (Build.VERSION.SDK_INT >= 33) {
          confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
        } else {
          confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
        }
        if (confirm == null) {
          recordError(context, "Android не передал окно подтверждения установки.");
          return;
        }
        confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
          context.startActivity(confirm);
        } catch (Exception error) {
          recordError(context, "Android не открыл окно установки: " + error.getMessage());
        }
        return;
      }
      if (status == PackageInstaller.STATUS_SUCCESS) {
        context.getSharedPreferences(INSTALL_PREFS, Context.MODE_PRIVATE)
            .edit().remove(INSTALL_ERROR).apply();
        Log.i(LOG_TAG, "Android confirmed successful APK installation");
        return;
      }
      String reason = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
      recordError(context, "Установка отклонена Android (код " + status
          + "): " + (reason == null ? "нет подробностей" : reason));
    }
    private static void recordError(Context context, String message) {
      Log.e(LOG_TAG, message);
      context.getSharedPreferences(INSTALL_PREFS, Context.MODE_PRIVATE)
          .edit().putString(INSTALL_ERROR, message).apply();
    }
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
    return "https".equals(url.getProtocol()) && url.getUserInfo() == null && url.getPort() == -1 &&
      (host.equals("github.com") || host.equals("release-assets.githubusercontent.com")
       || host.equals("objects.githubusercontent.com")
       || host.endsWith(".githubusercontent.com"));
  }
  // GitHub sometimes answers 502/503/504 for valid public release assets.
  // Retry only transient network failures; never retry security checks,
  // non-GitHub redirects, a wrong signature or a changed APK checksum.
  private String downloadApk(String location, File target, UpdateTask task) throws Exception {
    IOException lastNetworkError = null;
    final int maxAttempts = 4;
    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      task.timeLeft();
      try {
        return downloadApkOnce(location, target, task);
      } catch (IOException error) {
        lastNetworkError = error;
        if (attempt == maxAttempts) {
          throw new IOException("GitHub временно недоступен после " + maxAttempts
              + " попыток (" + error.getMessage() + "). Повторите обновление.", error);
        }
        Log.w(LOG_TAG, "Temporary GitHub download failure, attempt " + attempt
            + " of " + maxAttempts + ": " + error.getMessage());
        progress(task, "retry", attempt, maxAttempts);
        long pauseEnd = SystemClock.elapsedRealtime() + (1500L * attempt);
        while (SystemClock.elapsedRealtime() < pauseEnd) {
          task.timeLeft();
          Thread.sleep(Math.max(1L, Math.min(250L, pauseEnd - SystemClock.elapsedRealtime())));
        }
      }
    }
    throw new IOException("Не удалось загрузить APK: " + lastNetworkError);
  }

  private String downloadApkOnce(String location, File target, UpdateTask task) throws Exception {
    URL url = new URL(location);
    HttpURLConnection conn = null;
    try {
      for (int attempt = 0; attempt < 7; attempt++) {
        int timeout = task.timeLeft();
        if (!safeRedirect(url)) throw new SecurityException("Недоверенный адрес загрузки.");
        conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(timeout);
        conn.setReadTimeout(timeout);
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
        if (status != 200) {
          // 404, 401 and 403 are permanent errors: don't hammer the server.
          if (status == 408 || status == 429 || status == 500 ||
              status == 502 || status == 503 || status == 504) {
            throw new IOException("GitHub вернул HTTP " + status);
          }
          throw new IllegalStateException("GitHub вернул HTTP " + status);
        }
        long size = conn.getContentLengthLong();
        if (size > MAX_APK_BYTES) throw new SecurityException("Файл обновления слишком большой.");
        progress(task, "download", 0, size);
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(target)) {
          byte[] buf = new byte[64 * 1024];
          long written = 0;
          long nextProgress = 0;
          while (true) {
            task.timeLeft();
            int count = in.read(buf);
            if (count == -1) break;
            written += count;
            if (written > MAX_APK_BYTES) throw new SecurityException("Превышен максимальный размер APK.");
            digest.update(buf, 0, count);
            out.write(buf, 0, count);
            long now = SystemClock.elapsedRealtime();
            if (now >= nextProgress) {
              progress(task, "download", written, size);
              nextProgress = now + 500;
            }
          }
          task.timeLeft();
          out.getFD().sync();
          if (written < 1024) throw new IllegalStateException("Скачанный APK пустой.");
          if (size > 0 && written != size) throw new IOException("APK скачан не полностью.");
          progress(task, "download", written, size);
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

