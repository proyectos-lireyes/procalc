export const APP_CURRENT_VERSION = (import.meta as any).env?.VITE_APP_VERSION || '1.0.0';
export const DEFAULT_GITHUB_REPO = (import.meta as any).env?.VITE_GITHUB_REPO || 'proyectos-lireyes/procalc';
export const DEFAULT_PUBLIC_APK_URL = (import.meta as any).env?.VITE_PUBLIC_APK_URL || `https://github.com/${DEFAULT_GITHUB_REPO}/releases/latest/download/app-release.apk`;

export interface AppReleaseInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  apkDownloadUrl: string;
  apkFileName: string;
  apkSizeMb?: number;
  htmlUrl: string;
}

/**
 * Normalizes version strings for comparison (e.g. "v1.0.5" -> [1, 0, 5])
 */
function parseVersion(versionStr: string): number[] {
  const clean = versionStr.replace(/^v/i, '').trim();
  const parts = clean.split('.').map((p) => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
  return parts;
}

/**
 * Compares two semantic version strings: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);
  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Fetches the latest release from a GitHub repository via public GitHub API.
 * Defaults to the built-in repository if none is passed.
 * @param repo - e.g. "usuario/repositorio"
 */
export async function checkGitHubRelease(repo?: string): Promise<AppReleaseInfo> {
  const targetRepo = repo?.trim() || DEFAULT_GITHUB_REPO;
  const cleanRepo = targetRepo.replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/, '');

  if (!cleanRepo || !cleanRepo.includes('/')) {
    throw new Error('Formato de repositorio inválido. Debe ser "usuario/repositorio" (ej: "proyectos-lireyes/procalc").');
  }

  const apiUrl = `https://api.github.com/repos/${cleanRepo}/releases/latest`;
  
  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `No se encontró el repositorio o no tiene ningún Release publicado aún. Asegúrate de que el repositorio sea público y el workflow de GitHub Actions haya ejecutado con éxito.`
      );
    }
    if (response.status === 403) {
      throw new Error('Límite de peticiones a la API de GitHub alcanzado temporalmente. Intenta nuevamente en unos minutos o descarga el APK directamente.');
    }
    throw new Error(`Error al consultar GitHub (código ${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  const latestTag = data.tag_name || data.name || '1.0.0';

  // Search for an APK asset
  let apkAsset = null;
  if (Array.isArray(data.assets) && data.assets.length > 0) {
    apkAsset = data.assets.find((asset: { name?: string }) =>
      asset.name?.toLowerCase().endsWith('.apk')
    );
  }

  const apkDownloadUrl =
    apkAsset?.browser_download_url ||
    `https://github.com/${cleanRepo}/releases/latest/download/app-release.apk`;

  const apkFileName = apkAsset?.name || 'app-release.apk';
  const apkSizeMb = apkAsset?.size ? Math.round((apkAsset.size / (1024 * 1024)) * 10) / 10 : undefined;

  const hasUpdate = compareVersions(latestTag, APP_CURRENT_VERSION) > 0;

  return {
    hasUpdate,
    currentVersion: APP_CURRENT_VERSION,
    latestVersion: latestTag.replace(/^v/i, ''),
    releaseName: data.name || latestTag,
    releaseNotes: data.body || 'Sin notas de publicación.',
    publishedAt: data.published_at || new Date().toISOString(),
    apkDownloadUrl,
    apkFileName,
    apkSizeMb,
    htmlUrl: data.html_url || `https://github.com/${cleanRepo}/releases/latest`,
  };
}
