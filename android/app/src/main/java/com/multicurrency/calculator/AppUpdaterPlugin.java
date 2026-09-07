package com.multicurrency.calculator;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String TAG = "AppUpdaterPlugin";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("URL de descarga no proporcionada");
            return;
        }

        executor.execute(() -> {
            try {
                Context context = getContext();
                File cacheDir = context.getExternalCacheDir();
                if (cacheDir == null) {
                    cacheDir = context.getCacheDir();
                }
                File apkFile = new File(cacheDir, "app-update.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                // Manejar descargas con redirecciones automáticas (ej. GitHub Releases a AWS S3)
                URL url = new URL(urlString);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android)");
                conn.connect();

                int responseCode = conn.getResponseCode();
                int redirects = 0;
                while ((responseCode == HttpURLConnection.HTTP_MOVED_PERM || 
                        responseCode == HttpURLConnection.HTTP_MOVED_TEMP || 
                        responseCode == HttpURLConnection.HTTP_SEE_OTHER ||
                        responseCode == 307 || responseCode == 308) && redirects < 6) {
                    String newUrl = conn.getHeaderField("Location");
                    conn.disconnect();
                    conn = (HttpURLConnection) new URL(newUrl).openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android)");
                    conn.connect();
                    responseCode = conn.getResponseCode();
                    redirects++;
                }

                if (responseCode != HttpURLConnection.HTTP_OK) {
                    call.reject("Error del servidor al descargar APK: HTTP " + responseCode);
                    return;
                }

                int fileLength = conn.getContentLength();
                InputStream input = conn.getInputStream();
                FileOutputStream output = new FileOutputStream(apkFile);

                byte[] data = new byte[8192];
                int count;
                long total = 0;
                long lastNotifyTime = 0;

                while ((count = input.read(data)) != -1) {
                    total += count;
                    output.write(data, 0, count);

                    long now = System.currentTimeMillis();
                    if (fileLength > 0 && now - lastNotifyTime > 150) {
                        lastNotifyTime = now;
                        int progress = (int) (total * 100 / fileLength);
                        JSObject progressObj = new JSObject();
                        progressObj.put("progress", progress);
                        notifyListeners("downloadProgress", progressObj);
                    }
                }

                output.flush();
                output.close();
                input.close();
                conn.disconnect();

                // Notificar 100%
                JSObject finalProgress = new JSObject();
                finalProgress.put("progress", 100);
                notifyListeners("downloadProgress", finalProgress);

                // Iniciar el instalador nativo de Android
                boolean launched = launchInstaller(apkFile);
                if (launched) {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } else {
                    call.reject("No se pudo iniciar el instalador de paquetes de Android");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error en downloadAndInstall", e);
                call.reject("Error al descargar e instalar: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        try {
            Context context = getContext();
            File cacheDir = context.getExternalCacheDir();
            if (cacheDir == null) {
                cacheDir = context.getCacheDir();
            }
            File apkFile = new File(cacheDir, "app-update.apk");
            if (!apkFile.exists()) {
                call.reject("No se encontró el archivo APK descargado");
                return;
            }

            boolean ok = launchInstaller(apkFile);
            if (ok) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } else {
                call.reject("No se pudo abrir el instalador de Android");
            }
        } catch (Exception e) {
            call.reject("Error al abrir instalador: " + e.getMessage());
        }
    }

    private boolean launchInstaller(File apkFile) {
        try {
            Context context = getContext();
            Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apkFile
            );

            // Si es Android 8.0 (API 26) o superior y no tiene permiso para instalar paquetes de esta app
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.getPackageManager().canRequestPackageInstalls()) {
                    Intent permIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    permIntent.setData(Uri.parse("package:" + context.getPackageName()));
                    permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(permIntent);
                }
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

            context.startActivity(intent);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "launchInstaller exception", e);
            return false;
        }
    }
}
