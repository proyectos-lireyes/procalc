import { registerPlugin, Capacitor } from '@capacitor/core';

interface AppUpdaterPlugin {
  downloadAndInstall(options: { url: string }): Promise<{ success: boolean; message?: string }>;
  installApk(): Promise<{ success: boolean; message?: string }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (info: { progress: number }) => void
  ): Promise<{ remove: () => void }>;
}

export const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export const isNativeAndroidApp = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Descarga e inicia directamente el instalador de APKs nativo de Android dentro de la misma app
 */
export async function downloadAndInstallApkNative(
  url: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    if (isNativeAndroidApp()) {
      let removeListener: (() => void) | null = null;
      if (onProgress) {
        try {
          const handle = await AppUpdater.addListener('downloadProgress', (data) => {
            if (typeof data.progress === 'number') {
              onProgress(data.progress);
            }
          });
          removeListener = handle.remove;
        } catch {
          // Ignore listener error if plugin handles synchronously
        }
      }

      const result = await AppUpdater.downloadAndInstall({ url });
      if (removeListener) removeListener();

      return { success: !!result?.success };
    } else {
      // En navegador Web / Vista previa: Descargar archivo mediante enlace directo
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'app-release.apk');
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onProgress) {
        onProgress(50);
        setTimeout(() => onProgress(100), 500);
      }
      return { success: true };
    }
  } catch (err: any) {
    console.error('Error al descargar e instalar APK:', err);
    return {
      success: false,
      error: err?.message || 'No se pudo iniciar el instalador de Android',
    };
  }
}

/**
 * Abre el instalador nativo para el APK previamente descargado
 */
export async function openNativeApkInstaller(urlFallback: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (isNativeAndroidApp()) {
      const result = await AppUpdater.installApk();
      return { success: !!result?.success };
    } else {
      window.open(urlFallback, '_blank');
      return { success: true };
    }
  } catch (err: any) {
    console.error('Error al abrir instalador nativo:', err);
    window.open(urlFallback, '_blank');
    return { success: false, error: err?.message };
  }
}
