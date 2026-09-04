import React from 'react';
import { RefreshCw } from 'lucide-react';
import { RatesState } from '../types';
import { formatNumber } from '../utils/currency';

interface RatesTickerProps {
  rates: RatesState;
  isOffline: boolean;
  isCached: boolean;
  isCustomRatesActive: boolean;
  isLoading: boolean;
  lastUpdated: string;
  onRefresh: () => void;
  onOpenSettings?: () => void;
}

function formatShortDate(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });
    const timePart = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  } catch {
    return '';
  }
}

export const RatesTicker: React.FC<RatesTickerProps> = ({
  rates,
  isLoading,
  lastUpdated,
  onRefresh,
}) => {
  const formattedDateTime = React.useMemo(() => {
    try {
      if (!lastUpdated) return 'Hoy';
      const d = new Date(lastUpdated);
      if (isNaN(d.getTime())) return 'Reciente';
      const dateStr = d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });
      const timeStr = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} ${timeStr}`;
    } catch {
      return 'Reciente';
    }
  }, [lastUpdated]);

  return (
    <header className="w-full bg-white text-slate-800 px-1.5 sm:px-3 py-1 text-xs font-mono select-none shrink-0 border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto grid grid-cols-4 gap-1 sm:gap-2 w-full">
        {/* BOTÓN 1: USD */}
        <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 px-1 py-0.5 rounded text-[11px] leading-tight min-w-0 w-full">
          <div className="flex items-center justify-center gap-0.5 sm:gap-1 w-full truncate">
            <span className="font-bold text-blue-700 shrink-0">$</span>
            <span className="text-slate-400 text-[10px] shrink-0">=</span>
            <span className="font-extrabold text-slate-900 truncate">
              {formatNumber(rates.USD?.rateToVES || 0, 2)}
            </span>
          </div>
          {rates.USD?.lastUpdated ? (
            <span className="text-[8px] sm:text-[9px] text-slate-400 font-sans tracking-tight truncate max-w-full">
              {formatShortDate(rates.USD.lastUpdated)}
            </span>
          ) : (
            <span className="text-[8px] sm:text-[9px] text-transparent select-none">-</span>
          )}
        </div>

        {/* BOTÓN 2: EUR */}
        <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 px-1 py-0.5 rounded text-[11px] leading-tight min-w-0 w-full">
          <div className="flex items-center justify-center gap-0.5 sm:gap-1 w-full truncate">
            <span className="font-bold text-emerald-700 shrink-0">€</span>
            <span className="text-slate-400 text-[10px] shrink-0">=</span>
            <span className="font-extrabold text-slate-900 truncate">
              {formatNumber(rates.EUR?.rateToVES || 0, 2)}
            </span>
          </div>
          {rates.EUR?.lastUpdated ? (
            <span className="text-[8px] sm:text-[9px] text-slate-400 font-sans tracking-tight truncate max-w-full">
              {formatShortDate(rates.EUR.lastUpdated)}
            </span>
          ) : (
            <span className="text-[8px] sm:text-[9px] text-transparent select-none">-</span>
          )}
        </div>

        {/* BOTÓN 3: USDT */}
        <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 px-1 py-0.5 rounded text-[11px] leading-tight min-w-0 w-full">
          <div className="flex items-center justify-center gap-0.5 sm:gap-1 w-full truncate">
            <span className="font-bold text-amber-600 shrink-0">USDT</span>
            <span className="text-slate-400 text-[10px] shrink-0">=</span>
            <span className="font-extrabold text-slate-900 truncate">
              {formatNumber(rates.USDT?.rateToVES || 0, 2)}
            </span>
          </div>
          {rates.USDT?.lastUpdated ? (
            <span className="text-[8px] sm:text-[9px] text-slate-400 font-sans tracking-tight truncate max-w-full">
              {formatShortDate(rates.USDT.lastUpdated)}
            </span>
          ) : (
            <span className="text-[8px] sm:text-[9px] text-transparent select-none">-</span>
          )}
        </div>

        {/* BOTÓN 4: FECHA / HORA DE ACTUALIZACIÓN DE LA APP (CLICKEABLE PARA ACTUALIZAR) */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          title={`Última actualización de la app: ${formattedDateTime}. Toca para actualizar.`}
          className="flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-1 py-0.5 rounded text-[11px] text-slate-600 hover:text-blue-700 transition-all cursor-pointer active:scale-95 shadow-2xs leading-tight min-w-0 w-full"
        >
          <div className="flex items-center justify-center gap-1 w-full truncate">
            <span className="font-mono font-bold text-slate-700 text-[10px] sm:text-[11px] truncate">
              {formattedDateTime}
            </span>
            <RefreshCw
              className={`w-3 h-3 shrink-0 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-400'}`}
            />
          </div>
          <span className="text-[8px] sm:text-[9px] text-slate-400 font-sans tracking-tight truncate max-w-full">
            Actualizar
          </span>
        </button>
      </div>
    </header>
  );
};

