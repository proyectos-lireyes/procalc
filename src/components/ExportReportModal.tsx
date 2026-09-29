import React, { useState, useRef } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  Image as ImageIcon,
  Code2,
  FileCode,
  Loader2,
  Users,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  Sheet,
  ComputedRow,
  ComputedSheetTotals,
  RatesState,
  AppSettings,
} from '../types';
import { encodeSheetShare } from '../utils/shareImporter';
import { formatCurrency, formatNumber } from '../utils/currency';
import {
  captureElementToPng,
  copyImageMediaToClipboard,
  shareImageMedia,
  downloadImageMedia,
} from '../utils/mediaShare';

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
  // Exactly 3 tabs with 'image' as the 1st one
  const [activeTab, setActiveTab] = useState<'image' | 'base64' | 'json'>('image');
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedBase64, setCopiedBase64] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const nowFormatted = new Date().toLocaleString('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const members = sheet.members || [];
  const isTricountActive = Boolean(sheet.isTricountActive && members.length > 0);
  const settleCurrency = settings.displayCurrency;

  // Compute Tricount statistics
  const tricountData = (() => {
    if (!isTricountActive) return null;

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

    const fairShare = members.length > 0 ? totalShared / members.length : 0;
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

    return {
      totalShared,
      fairShare,
      paidByPerson,
      balances,
      transfers,
    };
  })();

  // 1. Base64
  const sheetBase64 = encodeSheetShare(sheet);

  // 2. Structured JSON
  const sheetJsonString = JSON.stringify(
    {
      app: 'ProCalc',
      version: '2.0',
      type: 'spreadsheet_sheet',
      exportedAt: new Date().toISOString(),
      sheet: {
        id: sheet.id,
        title: sheet.title,
        currency: sheet.currency,
        isTricountActive: sheet.isTricountActive,
        members: sheet.members,
        payer: sheet.payer,
        rows: sheet.rows,
        createdAt: sheet.createdAt,
      },
    },
    null,
    2
  );

  const reportFileName = `${sheet.title.replace(/\s+/g, '_')}_reporte.png`;

  // Copy Image to Clipboard (Cross-platform Android / Web)
  const handleCopyImage = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const captured = await captureElementToPng(receiptRef.current);
      if (!captured) {
        setStatusMessage({ text: 'Error al procesar la imagen del comprobante.', type: 'error' });
        return;
      }

      const res = await copyImageMediaToClipboard({
        dataUrl: captured.dataUrl,
        blob: captured.blob,
        fileName: reportFileName,
        fallbackText: `Reporte de cuenta: ${sheet.title}`,
      });

      if (res.success) {
        setCopiedImage(true);
        setStatusMessage({
          text: '¡Imagen copiada al portapapeles! Lista para pegar en WhatsApp o chats.',
          type: 'success',
        });
        setTimeout(() => setCopiedImage(false), 3000);
      } else {
        setStatusMessage({
          text: 'Portapapeles no soportado directamente. Se abrió la opción para compartir.',
          type: 'info',
        });
      }
    } catch (err) {
      console.error('handleCopyImage failed:', err);
      setStatusMessage({ text: 'Error al copiar la imagen.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Share Image via Android Intent / Web Share API
  const handleShareImage = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const captured = await captureElementToPng(receiptRef.current);
      if (!captured) {
        setStatusMessage({ text: 'Error al generar la imagen para compartir.', type: 'error' });
        return;
      }

      const res = await shareImageMedia({
        dataUrl: captured.dataUrl,
        blob: captured.blob,
        title: sheet.title,
        text: `Reporte de cuenta: ${sheet.title}`,
        fileName: reportFileName,
      });

      if (res.success && res.method !== 'user-canceled') {
        setStatusMessage({
          text: res.method === 'native-gallery' || res.method === 'web-download'
            ? '¡Imagen descargada con éxito!'
            : '¡Compartiendo comprobante!',
          type: 'success',
        });
      }
    } catch (err) {
      console.error('handleShareImage failed:', err);
      setStatusMessage({ text: 'No se pudo compartir la imagen.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Download / Save Image to Gallery / Downloads
  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const captured = await captureElementToPng(receiptRef.current);
      if (!captured) {
        setStatusMessage({ text: 'Error al generar imagen PNG.', type: 'error' });
        return;
      }

      const res = await downloadImageMedia({
        dataUrl: captured.dataUrl,
        blob: captured.blob,
        fileName: reportFileName,
      });

      if (res.success) {
        setStatusMessage({
          text: res.method === 'native-gallery'
            ? '¡Guardado con éxito en tu Galería de Fotos (Pictures/CalculadoraMultidivisa)!'
            : '¡Archivo PNG descargado exitosamente!',
          type: 'success',
        });
      } else {
        setStatusMessage({ text: 'Error al guardar la imagen PNG.', type: 'error' });
      }
    } catch (err) {
      console.error('handleDownloadImage failed:', err);
      setStatusMessage({ text: 'Error al descargar la imagen.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Base64
  const handleCopyBase64 = async () => {
    try {
      await navigator.clipboard.writeText(sheetBase64);
      setCopiedBase64(true);
      setTimeout(() => setCopiedBase64(false), 2500);
    } catch (err) {
      console.error('Error copying base64', err);
    }
  };

  // Share Base64
  const handleShareBase64 = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Cuenta: ${sheet.title}`,
          text: sheetBase64,
        });
      } else {
        handleCopyBase64();
      }
    } catch {
      handleCopyBase64();
    }
  };

  // Copy JSON
  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(sheetJsonString);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    } catch (err) {
      console.error('Error copying json', err);
    }
  };

  // Share JSON
  const handleShareJson = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `JSON: ${sheet.title}`,
          text: sheetJsonString,
        });
      } else {
        handleCopyJson();
      }
    } catch {
      handleCopyJson();
    }
  };

  // Download .json
  const handleDownloadJson = () => {
    try {
      const blob = new Blob([sheetJsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${sheet.title.replace(/\s+/g, '_')}_cuenta.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading json file', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                Compartir Cuenta: {sheet.title}
              </h3>
              <p className="text-[11px] text-slate-500">
                {sheet.rows.length} filas • Moneda base: {sheet.currency}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Tabs: 1. Imagen (1ra opción) | 2. Código BASE64 | 3. Estructura JSON */}
        <div className="flex items-center p-1 bg-slate-100 mx-4 mt-3 rounded-xl border border-slate-200 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'image'
                ? 'bg-white text-indigo-900 shadow-2xs border border-indigo-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>1. Imagen</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('base64')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'base64'
                ? 'bg-white text-indigo-900 shadow-2xs border border-indigo-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>2. BASE64</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-white text-indigo-900 shadow-2xs border border-indigo-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>3. JSON</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          {/* TAB 1: IMAGEN */}
          {activeTab === 'image' ? (
            <div className="flex flex-col items-center gap-3">
              {/* Scrollable Container with Complete Report Canvas inside */}
              <div className="w-full bg-slate-100 p-2 sm:p-3 rounded-xl border border-slate-200 overflow-y-auto max-h-[58vh] touch-pan-y overscroll-contain">
                <div
                  ref={receiptRef}
                  className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 w-full max-w-[400px] mx-auto text-slate-800 font-sans h-auto"
                  style={{ minWidth: '300px' }}
                >
                  {/* Receipt Header */}
                  <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                    <div className="inline-block px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] font-black uppercase tracking-wider mb-1 border border-indigo-100">
                      Reporte de Gastos y Cuenta
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                      {sheet.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {nowFormatted}
                    </span>
                  </div>

                  {/* Rates Bar */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mb-3 text-[10px] space-y-0.5 font-medium text-slate-600">
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[9px] mb-1">
                      Tasas del Día (DolarAPI):
                    </div>
                    <div className="flex items-center justify-between">
                      <span>USD (BCV):</span>
                      <span className="font-mono font-bold text-slate-900">
                        Bs. {formatNumber(rates.USD?.rateToVES || 0, 2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>USDT (Paralelo):</span>
                      <span className="font-mono font-bold text-slate-900">
                        Bs. {formatNumber(rates.USDT?.rateToVES || 0, 2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>EUR (BCV):</span>
                      <span className="font-mono font-bold text-slate-900">
                        Bs. {formatNumber(rates.EUR?.rateToVES || 0, 2)}
                      </span>
                    </div>
                  </div>

                  {/* Complete Rows Table */}
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                      Desglose de Gastos:
                    </div>
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          <th className="py-1 px-1 w-5 text-center">#</th>
                          <th className="py-1 px-1.5">Concepto</th>
                          <th className="py-1 px-1.5 text-right">Monto Orig.</th>
                          <th className="py-1 px-1.5 text-right">Equiv. $</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {computedRows.map((row, i) => (
                          <tr key={row.id || i} className="text-[11px]">
                            <td className="py-1.5 px-1 font-mono font-bold text-slate-400 text-center">
                              {i + 1}
                            </td>
                            <td className="py-1.5 px-1.5 font-medium text-slate-700 max-w-[120px] break-words">
                              {row.concept.trim() || <span className="text-slate-300">—</span>}
                              {row.payer && isTricountActive && (
                                <span className="text-[9px] text-indigo-600 block">
                                  ({row.payer})
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 font-mono font-bold text-slate-900 text-right whitespace-nowrap">
                              {formatCurrency(row.evaluatedValue, row.currency, settings.decimals)}
                            </td>
                            <td className="py-1.5 px-1.5 font-mono font-bold text-indigo-700 text-right whitespace-nowrap">
                              ${formatNumber(row.equivalents.USD, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 4 Currency Totals Bar */}
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 mb-3 space-y-1 text-xs">
                    <div className="font-black text-indigo-950 uppercase tracking-tight text-[10.5px] border-b border-indigo-200/60 pb-1 flex justify-between">
                      <span>Totales Multimoneda</span>
                      <span className="text-indigo-600">4 Divisas</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">Total $:</span>
                        <span className="font-bold text-slate-900">${formatNumber(totals.netByCurrency.USD, 2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">Total EUR:</span>
                        <span className="font-bold text-slate-900">€{formatNumber(totals.netByCurrency.EUR, 2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">Total USDT:</span>
                        <span className="font-bold text-slate-900">{formatNumber(totals.netByCurrency.USDT, 2)}</span>
                      </div>
                      <div className="flex justify-between col-span-2 pt-1 border-t border-indigo-200/60">
                        <span className="text-indigo-900 font-black">A PAGAR (Bs):</span>
                        <span className="font-black text-indigo-900">Bs. {formatNumber(totals.netByCurrency.VES, 2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tricount Section if Active */}
                  {tricountData && (
                    <div className="border-t border-dashed border-slate-300 pt-2.5 space-y-2 text-xs">
                      <div className="font-black text-slate-800 uppercase tracking-tight text-[11px] flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Gastos Compartidos (Tricount)</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[9px]">Cuota / Persona:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {formatCurrency(tricountData.fairShare, settleCurrency, settings.decimals)}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[9px]">Total Compartido:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {formatCurrency(tricountData.totalShared, settleCurrency, settings.decimals)}
                          </span>
                        </div>
                      </div>

                      {/* Settlement Transfers Cards */}
                      {tricountData.transfers.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Liquidación (Quién le paga a quién):
                          </span>
                          {tricountData.transfers.map((t, idx) => (
                            <div
                              key={idx}
                              className="bg-indigo-50/90 border border-indigo-200 rounded-lg p-2 text-xs flex items-center justify-between"
                            >
                              <div className="flex items-center gap-1 font-bold text-indigo-950">
                                <span>{t.from}</span>
                                <ArrowRight className="w-3 h-3 text-indigo-500" />
                                <span>{t.to}</span>
                              </div>
                              <span className="font-mono font-black text-indigo-900">
                                ${formatNumber(t.inUSD, 2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Receipt Footer */}
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-200 text-center">
                    <span className="text-[9px] text-slate-400 font-medium">
                      Calculado con ProCalc
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Image */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Copiar imagen directamente al portapapeles"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : copiedImage ? (
                    <Check className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedImage ? '¡Copiada!' : 'Copiar Imagen'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareImage}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Compartir imagen por WhatsApp u otras apps"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartir</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isGenerating}
                  className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 active:scale-95 disabled:opacity-50"
                  title="Descargar imagen PNG"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar PNG</span>
                </button>
              </div>

              {/* Status & Feedback message */}
              {statusMessage && (
                <div
                  className={`w-full p-2.5 rounded-lg text-xs flex items-center gap-2 border font-medium ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : statusMessage.type === 'error'
                      ? 'bg-rose-50 text-rose-900 border-rose-200'
                      : 'bg-blue-50 text-blue-900 border-blue-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : statusMessage.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}
            </div>
          ) : activeTab === 'base64' ? (
            /* TAB 2: BASE64 */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span className="uppercase tracking-tight">Código BASE64 (Importación Rápida)</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {sheetBase64.length} caracteres
                  </span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs break-all max-h-48 overflow-y-auto border border-slate-800 select-all scrollbar-thin">
                  {sheetBase64}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyBase64}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  {copiedBase64 ? (
                    <Check className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedBase64 ? '¡BASE64 Copiado!' : 'Copiar BASE64'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareBase64}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartir BASE64</span>
                </button>
              </div>
            </div>
          ) : (
            /* TAB 3: JSON */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span className="uppercase tracking-tight">Estructura JSON Completa</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {sheetJsonString.length} caracteres
                  </span>
                </div>
                <pre className="p-3 bg-slate-900 rounded-xl text-cyan-300 font-mono text-xs whitespace-pre overflow-x-auto max-h-48 border border-slate-800 scrollbar-thin select-all">
                  {sheetJsonString}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  {copiedJson ? (
                    <Check className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedJson ? '¡JSON Copiado!' : 'Copiar JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareJson}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartir JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Descargar .JSON</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
