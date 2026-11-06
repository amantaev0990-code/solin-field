package kz.solin.field;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
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
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/** Explicit, verified self-updates. Never removes an installed APK or local forest data. */
@CapacitorPlugin(name = "SolinUpdate")
public final class SolinUpdatePlugin extends Plugin {
  private static final String PACKAGE = "kz.solin.field.v23build";
  private static final String EXPECTED_CERT = "5A1C2E2BF2EFE5AA7382674B651533A11D2B93C802A1C09ADC72656C5A29ED7E";
  private static final String SOURCE_PREFIX =
      "/amantaev0990-code/solin-field/releases/download/solin-android-v";
  private static final String SOURCE_SUFFIX = "/SOLIN-Field-update.apk";
  private static final long MAX_APK = 200L * 1024 * 1024;
  private final AtomicBoolean downloading = new AtomicBoolean(false);

  private static long versionCode(PackageInfo pkg) {
    return Build.VERSION.SDK_INT >= 28 ? pkg.getLongVersionCode() : pkg.versionCode;
  }

  @SuppressWarnings("deprecation")
  private static String certificate(PackageInfo pkg) throws Exception {
    Signature[] signatures;
    if (Build.VERSION.SDK_INT >= 28) {
      if (pkg.signingInfo == null) throw new SecurityException("Нет подписи APK");
      signatures = pkg.signingInfo.getApkContentsSigners();
    } else {
      signatures = pkg.signatures;
    }
    if (signatures == null || signatures.length != 1)
      throw new SecurityException("Неоднозначная подпись APK");
    byte[] bytes = MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray());
    return hex(bytes).toUpperCase(Locale.ROOT);
  }

  private static String hex(byte[] bytes) {
    StringBuilder s = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) s.append(String.format(Locale.ROOT, "%02x", b & 0xff));
    return s.toString();
  }

  private PackageInfo installedInfo() throws Exception {
    PackageManager pm = getContext().getPackageManager();
    int flags = Build.VERSION.SDK_INT >= 28 ?
        PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
    return pm.getPackageInfo(getContext().getPackageName(), flags);
  }

  private static boolean sourceAllowed(URL url, boolean initial) {
    if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getUserInfo() != null ||
        url.getPort() != -1) return false;
    final String host = url.getHost().toLowerCase(Locale.ROOT);
    if (initial) {
      String path = url.getPath();
      return "github.com".equals(host) &&
          path.startsWith(SOURCE_PREFIX) && path.endsWith(SOURCE_SUFFIX) &&
          path.substring(SOURCE_PREFIX.length(), path.length() - SOURCE_SUFFIX.length())
              .matches("[1-9][0-9]{1,9}") &&
          url.getQuery() == null && url.getRef() == null;
    }
    return "github.com".equals(host) ||
        "release-assets.githubusercontent.com".equals(host) ||
        "objects.githubusercontent.com".equals(host);
  }

  @PluginMethod
  public void getInfo(PluginCall call) {
    try {
      PackageInfo p = installedInfo();
      JSObject out = new JSObject();
      out.put("packageName", getContext().getPackageName());
      out.put("versionCode", versionCode(p));
      out.put("certificateSha256", certificate(p));
      call.resolve(out);
    } catch (Exception e) {
      call.reject("Не удалось проверить установленную версию: " + e.getMessage());
    }
  }

  @PluginMethod
  public void installUpdate(PluginCall call) {
    if (!downloading.compareAndSet(false, true)) {
      call.reject("Другая загрузка обновления уже выполняется");
      return;
    }
    try {
      if (!PACKAGE.equals(getContext().getPackageName()) ||
          !EXPECTED_CERT.equals(certificate(installedInfo()))) {
        throw new SecurityException("Неизвестная подпись или пакет V23");
      }
      final String urlValue = call.getString("url", "");
      final String sha = call.getString("sha256", "").toLowerCase(Locale.ROOT);
      final Integer version = call.getInt("versionCode");
      final Integer size = call.getInt("expectedSize");
      final URL url = new URL(urlValue);
      if (!sourceAllowed(url, true)) throw new SecurityException("Обновление не с нашего GitHub Releases");
      if (!sha.matches("[a-f0-9]{64}")) throw new SecurityException("Нет SHA-256 файла");
      if (version == null || version <= versionCode(installedInfo())) {
        throw new SecurityException("Версия должна быть новее установленной");
      }
      if (size == null || size < 5_000_000 || size > MAX_APK) {
        throw new SecurityException("Некорректный размер APK");
      }
      if (Build.VERSION.SDK_INT >= 26 &&
          !getContext().getPackageManager().canRequestPackageInstalls()) {
        getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())));
        throw new SecurityException("Разреши установку из SOLI-N Field и нажми «Проверить обновления» ещё раз");
      }
      final int targetVersion = version, expectedSize = size;
      new Thread(() -> downloadAndInstall(call, url, sha, targetVersion, expectedSize),
          "solin-verified-apk-updater").start();
    } catch (Exception e) {
      downloading.set(false);
      call.reject("Обновление не началось: " + e.getMessage());
    }
  }

  private void progress(int downloaded, int expected) {
    JSObject data = new JSObject();
    data.put("percent", Math.min(100, Math.round(downloaded * 100f / expected)));
    notifyListeners("updateProgress", data);
  }

  private void downloadAndInstall(PluginCall call, URL url, String expectedSha,
                                  int expectedVersion, int expectedSize) {
    File staged = null;
    try {
      File dir = new File(getContext().getCacheDir(), "updates");
      if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Нет временного каталога");
      if (dir.getUsableSpace() < expectedSize + 15_000_000L)
        throw new IllegalStateException("Недостаточно свободного места для обновления");

      staged = new File(dir, "solin-download.tmp");
      if (staged.exists() && !staged.delete()) throw new IllegalStateException("Не удалён старый временный файл");
      MessageDigest hash = MessageDigest.getInstance("SHA-256");
      HttpURLConnection connection = null;
      URL current = url;
      int redirects = 0;
      while (true) {
        if (!sourceAllowed(current, redirects == 0))
          throw new SecurityException("Запрещённый адрес загрузки");
        connection = (HttpURLConnection) current.openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("User-Agent", "SOLI-N-Field-Android-Updater");
        int status = connection.getResponseCode();
        if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
          if (++redirects > 6) throw new SecurityException("Слишком много перенаправлений");
          String location = connection.getHeaderField("Location");
          connection.disconnect();
          if (location == null) throw new SecurityException("Отсутствует адрес загрузки");
          current = new URL(current, location);
          continue;
        }
        if (status != 200) throw new IllegalStateException("Ошибка скачивания HTTP " + status);
        break;
      }

      long length = connection.getContentLengthLong();
      if (length > MAX_APK || (length > 0 && length != expectedSize))
        throw new SecurityException("Размер скачиваемого файла не соответствует GitHub");
      int count = 0;
      try (InputStream in = connection.getInputStream();
           FileOutputStream out = new FileOutputStream(staged)) {
        byte[] buffer = new byte[32 * 1024];
        int n;
        while ((n = in.read(buffer)) >= 0) {
          if (n == 0) continue;
          count += n;
          if (count > expectedSize || count > MAX_APK)
            throw new SecurityException("Размер APK превысил ожидаемый");
          out.write(buffer, 0, n);
          hash.update(buffer, 0, n);
          if (count % (1024 * 1024) < n) progress(count, expectedSize);
        }
        out.getFD().sync();
      } finally {
        connection.disconnect();
      }
      if (count != expectedSize || !hex(hash.digest()).equals(expectedSha))
        throw new SecurityException("Контрольная сумма или размер APK не совпадают");

      PackageManager pm = getContext().getPackageManager();
      int flags = Build.VERSION.SDK_INT >= 28 ?
          PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
      @SuppressWarnings("deprecation")
      PackageInfo archive = pm.getPackageArchiveInfo(staged.getAbsolutePath(), flags);
      if (archive == null || !PACKAGE.equals(archive.packageName) ||
          versionCode(archive) != expectedVersion ||
          versionCode(archive) <= versionCode(installedInfo()) ||
          !EXPECTED_CERT.equals(certificate(archive))) {
        throw new SecurityException("APK имеет другой пакет, версию или сертификат");
      }

      File verified = new File(dir, "solin-update.apk");
      if (verified.exists() && !verified.delete()) throw new IllegalStateException("Старый APK не удалён");
      if (!staged.renameTo(verified)) throw new IllegalStateException("Не удалось сохранить проверенный APK");
      staged = null;

      final Uri uri = FileProvider.getUriForFile(getContext(),
          getContext().getPackageName() + ".solinupdates", verified);
      getActivity().runOnUiThread(() -> {
        try {
          Intent intent = new Intent(Intent.ACTION_VIEW);
          intent.setDataAndType(uri, "application/vnd.android.package-archive");
          intent.setClipData(ClipData.newUri(getContext().getContentResolver(), "SOLI-N Field update", uri));
          intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          getActivity().startActivity(intent); // Android system asks for install confirmation.
          JSObject reply = new JSObject();
          reply.put("installerOpened", true);
          call.resolve(reply);
        } catch (Exception e) {
          call.reject("Не удалось открыть установщик Android: " + e.getMessage());
        } finally {
          downloading.set(false);
        }
      });
    } catch (Exception e) {
      if (staged != null) staged.delete();
      downloading.set(false);
      call.reject("Обновление отклонено: " + e.getMessage());
    }
  }
}
