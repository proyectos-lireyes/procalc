import { registerPlugin, Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
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
  readClipboardText(): Promise<{ value: string }>;
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
 * Ensures full height from start to finish without clipping long receipts or accounts
 */
export async function captureElementToPng(
  elem: HTMLElement
): Promise<{ dataUrl: string; blob: Blob } | null> {
  if (!elem) return null;

  // Let UI paint and layout settle
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Find scrollable parents and record their scroll positions
  const scrollableParents: Array<{ node: HTMLElement; top: number; left: number }> = [];
  let curr: HTMLElement | null = elem.parentElement;
  while (curr && curr !== document.body) {
    if (curr.scrollTop > 0 || curr.scrollLeft > 0) {
      scrollableParents.push({ node: curr, top: curr.scrollTop, left: curr.scrollLeft });
      curr.scrollTop = 0;
      curr.scrollLeft = 0;
    }
    curr = curr.parentElement;
  }

  // Calculate full natural dimensions
  const fullWidth = Math.max(elem.scrollWidth, elem.offsetWidth, 360);
  const fullHeight = Math.max(elem.scrollHeight, elem.offsetHeight);

  // Adaptive pixelRatio for ultra-high-definition zoom & crystal-sharp text
  let idealPixelRatio = 3.0;
  if (fullHeight * idealPixelRatio > 4000) {
    idealPixelRatio = 2.5;
  }
  if (fullHeight * idealPixelRatio > 4000) {
    idealPixelRatio = 2.0;
  }
  if (fullHeight * idealPixelRatio > 4000) {
    idealPixelRatio = 1.5;
  }
  if (fullHeight * idealPixelRatio > 4000) {
    idealPixelRatio = 1.2;
  }
  if (fullHeight * idealPixelRatio > 4000) {
    idealPixelRatio = 1.0;
  }

  try {
    // Attempt 1: Full-height capture with adaptive HD resolution
    const dataUrl = await toPng(elem, {
      pixelRatio: idealPixelRatio,
      width: fullWidth,
      height: fullHeight,
      backgroundColor: '#ffffff',
      cacheBust: true,
      skipFonts: false,
      style: {
        width: `${fullWidth}px`,
        height: `${fullHeight}px`,
        maxHeight: 'none',
        minHeight: `${fullHeight}px`,
        overflow: 'visible',
        transform: 'none',
        margin: '0 auto',
      } as any,
      filter: (domNode) => {
        if (domNode instanceof HTMLElement && domNode.classList?.contains('no-export')) {
          return false;
        }
        return true;
      },
    });

    const blob = dataUrlToBlob(dataUrl);
    return { dataUrl, blob };
  } catch (err1) {
    console.warn('Adaptive HD capture failed, retrying with 1x ratio...', err1);
    try {
      // Attempt 2: Standard 1x ratio fallback
      const dataUrl = await toPng(elem, {
        pixelRatio: 1.0,
        width: fullWidth,
        height: fullHeight,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: true,
        style: {
          width: `${fullWidth}px`,
          height: `${fullHeight}px`,
          maxHeight: 'none',
          minHeight: `${fullHeight}px`,
          overflow: 'visible',
          transform: 'none',
          margin: '0 auto',
        },
      });
      const blob = dataUrlToBlob(dataUrl);
      return { dataUrl, blob };
    } catch (err2) {
      console.error('Final image capture failure:', err2);
      return null;
    }
  } finally {
    // Restore previous scroll positions so user preview is not displaced
    scrollableParents.forEach(({ node, top, left }) => {
      node.scrollTop = top;
      node.scrollLeft = left;
    });
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

/**
 * Reads text from clipboard with native Android Capacitor support & Web fallback
 */
export async function readClipboardTextMedia(): Promise<string> {
  // 1. Try official @capacitor/clipboard plugin
  try {
    const result = await Clipboard.read();
    if (result && typeof result.value === 'string' && result.value.trim().length > 0) {
      return result.value.trim();
    }
  } catch (capErr) {
    // Ignore and fallback
  }

  // 2. Try Native Android Capacitor custom MediaShare plugin
  if (isNativeAndroidApp()) {
    try {
      const res = await MediaShare.readClipboardText();
      if (res && typeof res.value === 'string' && res.value.trim().length > 0) {
        return res.value.trim();
      }
    } catch (err) {
      console.warn('Native MediaShare.readClipboardText error, trying web fallback:', err);
    }
  }

  // 3. Try Web Navigator Async Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (text && typeof text === 'string' && text.trim().length > 0) {
        return text.trim();
      }
    } catch (err) {
      console.warn('navigator.clipboard.readText failed or permission denied:', err);
    }
  }

  return '';
}
