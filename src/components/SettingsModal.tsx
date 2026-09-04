import React, { useState } from 'react';
import { X, Settings, Check, RefreshCcw, DollarSign, Sliders, Database, AlertCircle } from 'lucide-react';
import { AppSettings, Currency, RatesState } from '../types';
import { ALL_CURRENCIES, CURRENCY_CONFIG, formatNumber } from '../utils/currency';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  rates: RatesState;
  onSaveSettings: (settings: AppSettings) => void;
  onResetRatesToApi: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  rates,
  onSaveSettings,
  onResetRatesToApi,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

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
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Settings className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Ajustes de la Calculadora</h3>
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
