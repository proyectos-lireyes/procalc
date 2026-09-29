package com.multicurrency.calculator;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "MediaShare")
public class MediaSharePlugin extends Plugin {
    private static final String TAG = "MediaSharePlugin";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private byte[] decodeBase64Image(String dataUrl) {
        if (dataUrl == null || dataUrl.isEmpty()) {
            return null;
        }
        String cleanData = dataUrl;
        if (cleanData.contains(",")) {
            cleanData = cleanData.substring(cleanData.indexOf(",") + 1);
        }
        cleanData = cleanData.replaceAll("\\s+", "");
        return Base64.decode(cleanData, Base64.DEFAULT);
    }

    private File saveImageToCacheFile(byte[] imageBytes, String fileName) throws Exception {
        Context context = getContext();
        File cacheDir = context.getExternalCacheDir();
        if (cacheDir == null) {
            cacheDir = context.getCacheDir();
        }
        File sharedFolder = new File(cacheDir, "shared_images");
        if (!sharedFolder.exists()) {
            sharedFolder.mkdirs();
        }

        String safeFileName = (fileName != null && !fileName.trim().isEmpty())
                ? fileName.trim()
                : ("comprobante_" + System.currentTimeMillis() + ".png");
        if (!safeFileName.endsWith(".png")) {
            safeFileName += ".png";
        }

        File imageFile = new File(sharedFolder, safeFileName);
        try (FileOutputStream fos = new FileOutputStream(imageFile)) {
            fos.write(imageBytes);
            fos.flush();
        }
        return imageFile;
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        String title = call.getString("title", "Compartir Comprobante");
        String text = call.getString("text", "");
        String fileName = call.getString("fileName", "comprobante.png");

        if (dataUrl == null || dataUrl.isEmpty()) {
            call.reject("dataUrl requerido");
            return;
        }

        executor.execute(() -> {
            try {
                byte[] imageBytes = decodeBase64Image(dataUrl);
                if (imageBytes == null || imageBytes.length == 0) {
                    call.reject("Error decodificando imagen");
                    return;
                }

                File imageFile = saveImageToCacheFile(imageBytes, fileName);
                Context context = getContext();
                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        imageFile
                );

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("image/png");
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                if (text != null && !text.isEmpty()) {
                    shareIntent.putExtra(Intent.EXTRA_TEXT, text);
                }
                if (title != null && !title.isEmpty()) {
                    shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
                }
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(shareIntent, title);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                context.startActivity(chooser);

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Error compartiendo imagen", e);
                call.reject("Error al compartir imagen: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        String fileName = call.getString("fileName", "comprobante_" + System.currentTimeMillis() + ".png");

        if (dataUrl == null || dataUrl.isEmpty()) {
            call.reject("dataUrl requerido");
            return;
        }

        if (!fileName.endsWith(".png")) {
            fileName += ".png";
        }
        final String finalFileName = fileName;

        executor.execute(() -> {
            try {
                byte[] imageBytes = decodeBase64Image(dataUrl);
                if (imageBytes == null || imageBytes.length == 0) {
                    call.reject("Error decodificando imagen");
                    return;
                }

                Context context = getContext();
                boolean saved = false;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, finalFileName);
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/CalculadoraMultidivisa");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);

                    Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                    Uri itemUri = context.getContentResolver().insert(collection, values);
                    if (itemUri != null) {
                        try (OutputStream out = context.getContentResolver().openOutputStream(itemUri)) {
                            if (out != null) {
                                out.write(imageBytes);
                                out.flush();
                                saved = true;
                            }
                        }
                        values.clear();
                        values.put(MediaStore.Images.Media.IS_PENDING, 0);
                        context.getContentResolver().update(itemUri, values, null, null);
                    }
                } else {
                    File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                    File appDir = new File(picturesDir, "CalculadoraMultidivisa");
                    if (!appDir.exists()) {
                        appDir.mkdirs();
                    }
                    File outFile = new File(appDir, finalFileName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(imageBytes);
                        fos.flush();
                        saved = true;
                    }
                    MediaScannerConnection.scanFile(
                            context,
                            new String[]{outFile.getAbsolutePath()},
                            new String[]{"image/png"},
                            null
                    );
                }

                if (saved) {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("fileName", finalFileName);
                    call.resolve(ret);
                } else {
                    call.reject("No se pudo guardar la imagen en el almacenamiento");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error guardando imagen en galería", e);
                call.reject("Error al guardar imagen: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void copyImageToClipboard(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        String fileName = call.getString("fileName", "comprobante.png");

        if (dataUrl == null || dataUrl.isEmpty()) {
            call.reject("dataUrl requerido");
            return;
        }

        executor.execute(() -> {
            try {
                byte[] imageBytes = decodeBase64Image(dataUrl);
                if (imageBytes == null || imageBytes.length == 0) {
                    call.reject("Error decodificando imagen");
                    return;
                }

                File imageFile = saveImageToCacheFile(imageBytes, fileName);
                Context context = getContext();
                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        imageFile
                );

                ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard != null) {
                    ClipData clip = ClipData.newUri(context.getContentResolver(), "Comprobante", contentUri);
                    clipboard.setPrimaryClip(clip);

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } else {
                    call.reject("Portapapeles no disponible");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error copiando imagen al portapapeles", e);
                call.reject("Error al copiar imagen: " + e.getMessage());
            }
        });
    }
}
