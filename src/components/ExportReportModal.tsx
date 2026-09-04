import React, { useState } from 'react';
import { X, Download, FileText, Share2, Copy, Check, Printer, FileSpreadsheet } from 'lucide-react';
import { Sheet, ComputedRow, ComputedSheetTotals, RatesState, AppSettings, Currency } from '../types';
import { CURRENCY_CONFIG, formatCurrency, formatNumber } from '../utils/currency';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheet: Sheet;
  computedRows: ComputedRow[];
  totals: ComputedSheetTotals;
  rates: RatesState;
  settings: AppSettings;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  sheet,
  computedRows,
  totals,
  rates,
  settings,
}) => {
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

  const nowFormatted = new Date().toLocaleString('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Generate WhatsApp / text formatted report
  const generateTextReport = () => {
    let text = `🧾 *REPORTE DE CUENTA: ${sheet.title.toUpperCase()}*\n`;
    text += `📅 Fecha: ${nowFormatted}\n`;
    text += `💱 *Tasas de Cambio Aplicadas (DolarAPI):*\n`;
    text += `• USD (BCV): Bs. ${formatNumber(rates.USD?.rateToVES || 0, 2)}\n`;
    text += `• USDT (Paralelo): Bs. ${formatNumber(rates.USDT?.rateToVES || 0, 2)}\n`;
    text += `• EUR (BCV): Bs. ${formatNumber(rates.EUR?.rateToVES || 0, 2)}\n\n`;

    text += `📋 *DETALLE DE REGISTROS:*\n`;
    computedRows.forEach((row, idx) => {
      const conceptStr = row.concept ? ` [${row.concept}]` : '';
      const payerStr = row.payer ? ` (Pagó: ${row.payer})` : '';
      const inOrig = formatCurrency(row.evaluatedValue, row.currency, settings.decimals);
      const inDisplay = formatCurrency(row.equivalents[settings.displayCurrency], settings.displayCurrency, settings.decimals);
      const inPay = formatCurrency(row.equivalents[settings.paymentCurrency], settings.paymentCurrency, settings.decimals);

      text += `${idx + 1}. ${inOrig}${conceptStr}${payerStr}\n   ↳ Equivalente: ${inDisplay} | ${inPay}\n`;
    });

    text += `\n───────────────────────────\n`;
    text += `📊 *TOTALES EN LAS 4 MONEDAS:*\n`;
    text += `💵 *Total en $:* ${formatCurrency(totals.netByCurrency.USD, 'USD', settings.decimals)}\n`;
    text += `💶 *Total en EUR:* ${formatCurrency(totals.netByCurrency.EUR, 'EUR', settings.decimals)}\n`;
    text += `🪙 *Total en USDT:* ${formatCurrency(totals.netByCurrency.USDT, 'USDT', settings.decimals)}\n`;
    text += `🇻🇪 *TOTAL A PAGAR (Bs):* ${formatCurrency(totals.netByCurrency.VES, 'VES', settings.decimals)}\n`;

    // TRICOUNT SECTION (If active or has members)
    const members = sheet.members || [];
    if (sheet.isTricountActive && members.length > 0) {
      const settleCurrency = settings.displayCurrency;
      const paidByPerson: Record<string, number> = {};
      members.forEach((m) => {
        paidByPerson[m] = 0;
      });

      let totalShared = 0;
      computedRows.forEach((row) => {
        const val = Math.abs(row.equivalents[settleCurrency]);
        const payer = row.payer && members.includes(row.payer) ? row.payer : members[0];
        if (payer && val > 0) {
          paidByPerson[payer] = (paidByPerson[payer] || 0) + val;
          totalShared += val;
        }
      });

      const fairShare = totalShared / members.length;
      const balances: Record<string, number> = {};
      members.forEach((m) => {
        balances[m] = (paidByPerson[m] || 0) - fairShare;
      });

      const debtors: Array<{ name: string; balance: number }> = [];
      const creditors: Array<{ name: string; balance: number }> = [];

      members.forEach((m) => {
        const bal = balances[m] || 0;
        if (bal < -0.009) debtors.push({ name: m, balance: -bal });
        else if (bal > 0.009) creditors.push({ name: m, balance: bal });
      });

      const transfers: Array<{
        from: string;
        to: string;
        amount: number;
        inUSD: number;
        inVES: number;
        inEUR: number;
        inUSDT: number;
      }> = [];

      let dIdx = 0;
      let cIdx = 0;
      const dCopy = debtors.map((d) => ({ ...d }));
      const cCopy = creditors.map((c) => ({ ...c }));

      while (dIdx < dCopy.length && cIdx < cCopy.length) {
        const d = dCopy[dIdx];
        const c = cCopy[cIdx];
        const amt = Math.min(d.balance, c.balance);
        if (amt > 0.001) {
          const inVES =
            settleCurrency === 'VES'
              ? amt
              : amt * (rates[settleCurrency]?.rateToVES || 1);

          transfers.push({
            from: d.name,
            to: c.name,
            amount: amt,
            inVES,
            inUSD: inVES / (rates.USD?.rateToVES || 1),
            inEUR: inVES / (rates.EUR?.rateToVES || 1),
            inUSDT: inVES / (rates.USDT?.rateToVES || 1),
          });
        }
        d.balance -= amt;
        c.balance -= amt;
        if (d.balance <= 0.009) dIdx++;
        if (c.balance <= 0.009) cIdx++;
      }

      text += `───────────────────────────\n`;
      text += `👥 *TRICOUNT / GASTOS COMPARTIDOS:*\n`;
      text += `• Total Compartido: ${formatCurrency(totalShared, settleCurrency, settings.decimals)}\n`;
      text += `• Cuota por Persona (${members.length}): ${formatCurrency(fairShare, settleCurrency, settings.decimals)}\n\n`;
      text += `*Pagos y Balances:* \n`;
      members.forEach((m) => {
        const p = paidByPerson[m] || 0;
        const b = balances[m] || 0;
        const status =
          b > 0.009
            ? `(Recibe +${formatCurrency(b, settleCurrency, settings.decimals)})`
            : b < -0.009
            ? `(Debe ${formatCurrency(Math.abs(b), settleCurrency, settings.decimals)})`
            : `(Al día)`;
        text += `• ${m}: Pagó ${formatCurrency(p, settleCurrency, settings.decimals)} ${status}\n`;
      });

      if (transfers.length > 0) {
        text += `\n*Liquidación de Pagos:* \n`;
        transfers.forEach((t) => {
          text += `👉 *${t.from}* paga a *${t.to}*:\n`;
          text += `   • $ ${formatNumber(t.inUSD, 2)} | Bs. ${formatNumber(t.inVES, 2)} | USDT ${formatNumber(t.inUSDT, 2)} | € ${formatNumber(t.inEUR, 2)}\n`;
        });
      }
    }

    text += `───────────────────────────\n`;
    text += `_Generado con Calculadora de Pagos Multimoneda_`;

    return text;
  };

  const handleCopyText = () => {
    const text = generateTextReport();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="export-report-modal"
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-slate-800 max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Share2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Exportar & Compartir Reporte</h3>
              <p className="text-xs text-slate-500">
                Imprime en PDF o copia el resumen con desglose para WhatsApp y Telegram
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Action Cards (CSV option removed as requested) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="copy-whatsapp-text-btn"
              onClick={handleCopyText}
              className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <div className="p-2 rounded-md bg-emerald-50 text-emerald-600 w-fit mb-2 group-hover:scale-105 transition-transform border border-emerald-100">
                {copiedText ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                  {copiedText ? '¡Copiado al Portapapeles!' : 'Copiar Mensaje Completo'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Listo para pegar en WhatsApp o Telegram con formato y Tricount
                </div>
              </div>
            </button>

            <button
              id="print-report-btn"
              onClick={handlePrint}
              className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <div className="p-2 rounded-md bg-purple-50 text-purple-600 w-fit mb-2 group-hover:scale-105 transition-transform border border-purple-100">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                  Imprimir / Guardar PDF
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Generar comprobante o factura impresa
                </div>
              </div>
            </button>
          </div>

          {/* Preview of report */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Vista Previa del Resumen de Pago:</span>
              <button
                onClick={handleCopyText}
                className="text-blue-600 hover:text-blue-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                Copiar
              </button>
            </div>
            <pre className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap overflow-x-auto max-h-64 scrollbar-thin">
              {generateTextReport()}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
