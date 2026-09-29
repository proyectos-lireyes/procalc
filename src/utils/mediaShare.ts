import { registerPlugin, Capacitor } from '@capacitor/core';
import { toPng } from 'html-to-image';
import { isNativeAndroidApp } from './appUpdater';

interface MediaSharePlugin {
  shareImage(options: {
    dataUrl: string;
    title?: string;
    text?: string;
    fileName?: string;
  }): Promise<{ success: boolean }>;
  saveImageToGallery(options: {
    dataUrl: string;
    fileName?: string;
  }): Promise<{ success: boolean; fileName?: string }>;
  copyImageToClipboard(options: {
    dataUrl: string;
    fileName?: string;
  }): Promise<{ success: boolean }>;
}

export const MediaShare = registerPlugin<MediaSharePlugin>('MediaShare');

/**
 * Helper to convert Base64 Data URL to a native Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Captures any DOM element into PNG dataUrl and Blob with mobile-safe optimizations
 */
export async function captureElementToPng(
  elem: HTMLElement
): Promise<{ dataUrl: string; blob: Blob } | null> {
  if (!elem) return null;

  // Let UI paint and layout settle
  await new Promise((resolve) => setTimeout(resolve, 60));

  try {
    // Attempt 1: High definition (pixelRatio 2) with skipFonts to avoid CORS issues
    const dataUrl = await toPng(elem, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      skipFonts: true,
      filter: (domNode) => {
        // Exclude interactive modal backdrop or buttons if inside
        if (domNode instanceof HTMLElement && domNode.classList?.contains('no-export')) {
          return false;
        }
        return true;
      },
    });

    const blob = dataUrlToBlob(dataUrl);
    return { dataUrl, blob };
  } catch (err1) {
    console.warn('Initial HD capture failed, retrying with standard pixelRatio...', err1);
    try {
      // Attempt 2: Standard resolution
      const dataUrl = await toPng(elem, {
        pixelRatio: 1.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: true,
      });
      const blob = dataUrlToBlob(dataUrl);
      return { dataUrl, blob };
    } catch (err2) {
      console.error('Final image capture failure:', err2);
      return null;
    }
  }
}

/**
 * Cross-platform Share Image: Native Android Intent on APK, Web Share API on modern browsers
 */
export async function shareImageMedia(options: {
  dataUrl: string;
  blob?: Blob;
  title: string;
  text?: string;
  fileName: string;
}): Promise<{ success: boolean; method: string; error?: string }> {
  const { dataUrl, blob, title, text, fileName } = options;

  // 1. Android Native App (Capacitor bridge with FileProvider & Intent.ACTION_SEND)
  if (isNativeAndroidApp()) {
    try {
      await MediaShare.shareImage({
        dataUrl,
        title,
        text,
        fileName,
      });
      return { success: true, method: 'native-share' };
    } catch (err) {
      console.error('Native Android shareImage error:', err);
      // Fallback to gallery save
      try {
        await MediaShare.saveImageToGallery({ dataUrl, fileName });
        return { success: true, method: 'native-save-fallback' };
      } catch (saveErr) {
        return { success: false, method: 'native-fail', error: String(saveErr) };
      }
    }
  }

  // 2. Web browser: Web Share API with Files support
  const targetBlob = blob || dataUrlToBlob(dataUrl);
  const file = new File([targetBlob], fileName, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: text || title,
      });
      return { success: true, method: 'web-share-files' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: true, method: 'user-canceled' };
      }
      console.warn('Web Share API failed, falling back to download:', err);
    }
  }

  // 3. Fallback: Direct File Download
  return downloadImageMedia({ dataUrl, blob: targetBlob, fileName });
}

/**
 * Cross-platform Download / Save Image: MediaStore in Android APK, Blob Object URL in Web
 */
export async function downloadImageMedia(options: {
  dataUrl: string;
  blob?: Blob;
  fileName: string;
}): Promise<{ success: boolean; method: string; error?: string }> {
  const { dataUrl, blob, fileName } = options;

  // 1. Android Native App (MediaStore Gallery / Downloads)
  if (isNativeAndroidApp()) {
    try {
      const res = await MediaShare.saveImageToGallery({
        dataUrl,
        fileName,
      });
      return { success: !!res?.success, method: 'native-gallery' };
    } catch (err) {
      console.error('Native saveImageToGallery error:', err);
      // Fallback: Try share dialog so user can save anywhere
      try {
        await MediaShare.shareImage({ dataUrl, fileName, title: 'Guardar Comprobante' });
        return { success: true, method: 'native-share-fallback' };
      } catch (shareErr) {
        return { success: false, method: 'native-fail', error: String(shareErr) };
      }
    }
  }

  // 2. Web Browser: Reliable Blob Object URL download with proper cleanup
  try {
    const targetBlob = blob || dataUrlToBlob(dataUrl);
    const blobUrl = URL.createObjectURL(targetBlob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = blobUrl;
    link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1500);

    return { success: true, method: 'web-download' };
  } catch (err) {
    console.error('Web image download failed:', err);
    return { success: false, method: 'web-download-fail', error: String(err) };
  }
}

/**
 * Cross-platform Copy Image to Clipboard: Android Clipboard URI on APK, Clipboard API on desktop
 */
export async function copyImageMediaToClipboard(options: {
  dataUrl: string;
  blob?: Blob;
  fileName: string;
  fallbackText?: string;
}): Promise<{ success: boolean; method: string; error?: string }> {
  const { dataUrl, blob, fileName, fallbackText } = options;

  // 1. Android Native App (ClipData with FileProvider content URI)
  if (isNativeAndroidApp()) {
    try {
      const res = await MediaShare.copyImageToClipboard({
        dataUrl,
        fileName,
      });
      return { success: !!res?.success, method: 'native-clipboard' };
    } catch (err) {
      console.error('Native Android copyImageToClipboard error:', err);
      // If clipboard failed, open share intent directly so user can paste into WhatsApp/Telegram
      try {
        await MediaShare.shareImage({
          dataUrl,
          fileName,
          title: 'Compartir Comprobante',
        });
        return { success: true, method: 'native-share-fallback' };
      } catch (shareErr) {
        return { success: false, method: 'native-fail', error: String(shareErr) };
      }
    }
  }

  // 2. Web Browser: Async Clipboard API for PNG
  const targetBlob = blob || dataUrlToBlob(dataUrl);
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': targetBlob,
        }),
      ]);
      return { success: true, method: 'web-clipboard-image' };
    } catch (err) {
      console.warn('ClipboardItem write image failed (unsupported on mobile browsers):', err);
    }
  }

  // 3. Fallback for mobile browsers (Android Chrome doesn't allow image clipboard):
  // Share image directly or copy text
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [new File([targetBlob], fileName, { type: 'image/png' })] })) {
    try {
      await navigator.share({
        files: [new File([targetBlob], fileName, { type: 'image/png' })],
        title: 'Comprobante',
      });
      return { success: true, method: 'web-share-fallback' };
    } catch {
      // User canceled or failed
    }
  }

  // 4. Download image as final fallback if clipboard is unavailable
  return downloadImageMedia({ dataUrl, blob: targetBlob, fileName });
}
