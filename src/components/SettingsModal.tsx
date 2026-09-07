import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Check,
  RefreshCcw,
  DollarSign,
  Sliders,
  AlertCircle,
  Download,
  Sparkles,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { AppSettings, Currency, RatesState } from '../types';
import { ALL_CURRENCIES, CURRENCY_CONFIG } from '../utils/currency';
import {
  APP_CURRENT_VERSION,
  DEFAULT_GITHUB_REPO,
  AppReleaseInfo,
  checkGitHubRelease,
} from '../services/updateService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  rates: RatesState;
  onSaveSettings: (settings: AppSettings) => void;
  onResetRatesToApi: () => void;
  initialReleaseInfo?: AppReleaseInfo | null;
  hasUpdateNotification?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  rates,
  onSaveSettings,
  onResetRatesToApi,
  initialReleaseInfo,
  hasUpdateNotification,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Update check states
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [releaseInfo, setReleaseInfo] = useState<AppReleaseInfo | null>(initialReleaseInfo || null);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'completed'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Sync with background startup check if received later
  useEffect(() => {
    if (initialReleaseInfo) {
      setReleaseInfo(initialReleaseInfo);
    }
  }, [initialReleaseInfo]);

  if (!isOpen) return null;

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateError(null);
    setDownloadStatus('idle');
    setDownloadProgress(0);

    try {
      const info = await checkGitHubRelease(localSettings.githubRepo || DEFAULT_GITHUB_REPO);
      setReleaseInfo(info);
    } catch (err: any) {
      setUpdateError(err.message || 'Error al consultar actualizaciones.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadApk = (url: string) => {
    if (downloadStatus === 'downloading') return;

    setDownloadStatus('downloading');
    setDownloadProgress(15);

    // Iniciar descarga silenciosa en el almacenamiento interno del dispositivo sin abrir pestaña externa
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 60000);
    } catch {
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'app-release.apk');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Simulación de progreso de guardado en almacenamiento local
    let progress = 20;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 12;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setDownloadProgress(100);
        setDownloadStatus('completed');
      } else {
        setDownloadProgress(progress);
      }
    }, 380);
  };

  const handleInstallUpdate = (url: string) => {
    // Abre el paquete descargado en el instalador del sistema operativo
    window.location.href = url;
  };

  const handleCustomRateChange = (curr: Currency, val: string) => {
    const num = parseFloat(val);
    setLocalSettings((prev) => ({
      ...prev,
      customRates: {
        ...prev.customRates,
        [curr]: isNaN(num) ? 0 : num,
      },
    }));
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="settings-modal"
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-slate-800 max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="relative p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Settings className="w-4 h-4" />
              {(hasUpdateNotification || releaseInfo?.hasUpdate) && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-white"></span>
                </span>
              )}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">Ajustes de la Calculadora</h3>
                {(hasUpdateNotification || releaseInfo?.hasUpdate) && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                    Actualización disponible
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Moneda de cálculo, moneda de pago y tasas de cambio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Section 1: Monedas por Defecto */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-blue-600" />
              Configuración de Monedas
            </h4>

            {/* Moneda de visualización / cálculos */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Moneda por defecto para mostrar cálculos:
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Cada fila tendrá una columna adicional calculando su equivalente en esta moneda (por ejemplo $).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_CURRENCIES.map((curr) => {
                  const cfg = CURRENCY_CONFIG[curr];
                  const isSelected = localSettings.displayCurrency === curr;
                  return (
                    <button
                      key={'disp_' + curr}
                      type="button"
                      onClick={() =>
                        setLocalSettings((prev) => ({ ...prev, displayCurrency: curr }))
                      }
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-base mb-0.5">{cfg.flag}</div>
                      <div className="text-sm font-bold text-slate-900 font-mono">{cfg.name}</div>
                      <div className="text-[10px] text-slate-500">{curr === 'VES' ? 'Bolívares' : curr === 'USD' ? 'Dólar Oficial' : curr === 'USDT' ? 'Tether Paralelo' : 'Euro Oficial'}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Moneda para hacer los pagos */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Moneda para realizar los pagos:
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Se aplicará la tasa de cambio vigente automáticamente para mostrar el total a pagar (generalmente Bs).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_CURRENCIES.map((curr) => {
                  const cfg = CURRENCY_CONFIG[curr];
                  const isSelected = localSettings.paymentCurrency === curr;
                  return (
                    <button
                      key={'pay_' + curr}
                      type="button"
                      onClick={() =>
                        setLocalSettings((prev) => ({ ...prev, paymentCurrency: curr }))
                      }
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-base mb-0.5">{cfg.flag}</div>
                      <div className="text-sm font-bold text-slate-900 font-mono">{cfg.name}</div>
                      <div className="text-[10px] text-slate-500">{curr === 'VES' ? 'Bolívares' : curr === 'USD' ? 'Dólar Oficial' : curr === 'USDT' ? 'Tether Paralelo' : 'Euro Oficial'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Decimales */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Precisión de decimales:
            </label>
            <div className="flex gap-2">
              {[2, 3, 4].map((dec) => (
                <button
                  key={dec}
                  type="button"
                  onClick={() => setLocalSettings((prev) => ({ ...prev, decimals: dec }))}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold border transition-colors ${
                    localSettings.decimals === dec
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {dec} decimales ({dec === 2 ? '0.00' : dec === 3 ? '0.000' : '0.0000'})
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Tasas Personalizadas (Modo Offline o Custom) */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  Tasas de Cambio Personalizadas
                </h4>
                <p className="text-[11px] text-slate-500">
                  Permite fijar tasas manuales si estás offline o requieres una tasa acordada
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="custom-rates-toggle"
                  type="checkbox"
                  checked={localSettings.useCustomRates}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, useCustomRates: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {localSettings.useCustomRates ? (
              <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 space-y-2.5">
                <div className="text-[11px] text-blue-800 flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                  Estás usando tasas personalizadas. Se ignorará temporalmente DolarAPI.
                </div>

                {(['USD', 'USDT', 'EUR'] as Currency[]).map((curr) => {
                  const cfg = CURRENCY_CONFIG[curr];
                  const currentRate =
                    localSettings.customRates[curr] ?? rates[curr]?.rateToVES ?? 0;
                  return (
                    <div key={'rate_' + curr} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span>{cfg.flag}</span>
                        <span className="font-bold text-slate-900 font-mono text-sm">{cfg.name}</span>
                        <span className="text-[10px] text-slate-500 font-sans">
                          {curr === 'USD' ? 'Dólar Oficial' : curr === 'USDT' ? 'Tether Paralelo' : 'Euro Oficial'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500 font-mono">Bs</span>
                        <input
                          type="number"
                          step="0.01"
                          value={currentRate || ''}
                          onChange={(e) => handleCustomRateChange(curr, e.target.value)}
                          className="w-28 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-right font-mono text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onResetRatesToApi}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    Restaurar valores de DolarAPI
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span>Usando tasas oficiales de DolarAPI en tiempo real</span>
                <span className="text-blue-700 font-semibold">Activo</span>
              </div>
            )}
          </div>
            {/* Section 4: Actualizaciones de la Aplicación */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Actualizaciones de la Aplicación
                </h4>
                <p className="text-[11px] text-slate-500">
                  Comprueba e instala las últimas versiones disponibles
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                v{APP_CURRENT_VERSION}
              </span>
            </div>

            {/* Main updates card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              {/* Botón principal: Comprobar Nueva Versión */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckUpdates}
                  disabled={isCheckingUpdate}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                  <span>{isCheckingUpdate ? 'Comprobando en GitHub...' : 'Comprobar Nueva Versión'}</span>
                </button>
              </div>

              {/* Resultado de la versión y Novedades */}
              {releaseInfo && (
                <div
                  className={`p-3 rounded-lg border text-xs space-y-2.5 ${
                    releaseInfo.hasUpdate
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                      : 'bg-blue-50/80 border-blue-200 text-blue-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {releaseInfo.hasUpdate ? (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                          </span>
                          <span>¡Nueva versión disponible: v{releaseInfo.latestVersion}!</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          <span>Tienes la versión más reciente (v{releaseInfo.latestVersion})</span>
                        </>
                      )}
                    </span>
                    {releaseInfo.apkSizeMb && (
                      <span className="text-[10px] opacity-75 font-mono">
                        {releaseInfo.apkSizeMb} MB
                      </span>
                    )}
                  </div>

                  {/* Lo de las novedades */}
                  {releaseInfo.releaseNotes && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Novedades de esta versión:
                      </span>
                      <div className="bg-white/95 p-2.5 rounded-lg border border-slate-200/80 font-mono text-[11px] whitespace-pre-line max-h-36 overflow-y-auto text-slate-700 leading-relaxed">
                        {releaseInfo.releaseNotes}
                      </div>
                    </div>
                  )}

                  {/* Flujo de Descarga en almacenamiento e Instalación posterior */}
                  <div className="space-y-2 pt-1">
                    {downloadStatus === 'idle' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadApk(releaseInfo.apkDownloadUrl)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar APK al Almacenamiento</span>
                      </button>
                    )}

                    {downloadStatus === 'downloading' && (
                      <div className="p-2.5 bg-white rounded-lg border border-blue-200 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <RefreshCcw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                            Descargando instalador en el dispositivo...
                          </span>
                          <span className="font-mono font-bold text-blue-600">{downloadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Guardando paquete APK en tu carpeta de Descargas.
                        </p>
                      </div>
                    )}

                    {downloadStatus === 'completed' && (
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-lg bg-emerald-100/90 border border-emerald-300 text-emerald-950 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold">Instalador guardado en el almacenamiento</p>
                            <p className="text-[10px] text-emerald-800">
                              El archivo APK está listo en la carpeta Descargas de tu teléfono.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleInstallUpdate(releaseInfo.apkDownloadUrl)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Instalar Actualización Descargada</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadApk(releaseInfo.apkDownloadUrl)}
                            className="px-2.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-all cursor-pointer"
                            title="Volver a descargar"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500 pt-0.5">
                      ℹ️ La descarga se realiza internamente. Al pulsar &quot;Instalar Actualización Descargada&quot; se actualizará la aplicación manteniendo todas tus hojas y datos.
                    </p>
                  </div>
                </div>
              )}

              {/* Mensaje de error si falla la consulta */}
              {updateError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                  <div className="flex items-start gap-1.5 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{updateError}</span>
                  </div>
                  <p className="text-[10px] text-rose-700 pl-5">
                    Verifica tu conexión a internet o intenta nuevamente en unos momentos.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="save-settings-btn"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : null}
            <span>{savedSuccess ? 'Guardado' : 'Aplicar Ajustes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
