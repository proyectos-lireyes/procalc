import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  Plane,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import {
  Sheet,
  ComputedRow,
  ComputedSheetTotals,
  RatesState,
  AppSettings,
  ExportImageScope,
} from '../types';
import { encodeSheetShare } from '../utils/shareImporter';
import { formatCurrency, formatNumber, convertCurrency, convertToVES } from '../utils/currency';
import { calculatePrepaidTripStats, formatPrepaidWhatsAppReport } from '../utils/tricountPrepaid';
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
  // All hooks declared unconditionally at the very top
  const [activeTab, setActiveTab] = useState<'image' | 'base64' | 'json'>('image');
  const [imageScope, setImageScope] = useState<ExportImageScope>(() => {
    if (sheet.tricountMode === 'prepaid') return 'planner';
    if (sheet.isTricountActive || sheet.tricountMode === 'postpaid') return 'tricount';
    return 'both';
  });
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedBase64, setCopiedBase64] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedWhatsAppText, setCopiedWhatsAppText] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeContributionsHistory, setIncludeContributionsHistory] = useState(false);
  const [includeMulticurrencyRemaining, setIncludeMulticurrencyRemaining] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  const members = sheet.members || [];
  const isTricountActive = Boolean(sheet.isTricountActive && members.length > 0);
  const settleCurrency = settings.displayCurrency;

  // Auto-select default tab when opening modal
  useEffect(() => {
    if (isOpen) {
      if (sheet.tricountMode === 'prepaid') {
        setImageScope('planner');
      } else if (sheet.isTricountActive || sheet.tricountMode === 'postpaid') {
        setImageScope('tricount');
      } else {
        setImageScope('both');
      }
    }
  }, [isOpen, sheet.id, sheet.isTricountActive, sheet.tricountMode]);

  const plannerCurrency = sheet.prepaidConfig?.targetCurrency || settings.displayCurrency;

  // Compute Prepaid Trip Stats if active or configured
  const prepaidData = useMemo(() => {
    return calculatePrepaidTripStats(members, sheet.prepaidConfig, rates, plannerCurrency);
  }, [members, sheet.prepaidConfig, rates, plannerCurrency]);

  // Compute Tripcount statistics
  const tricountData = useMemo(() => {
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
        const inVES = convertToVES(amt, settleCurrency, rates);
        const inUSD = convertCurrency(amt, settleCurrency, 'USD', rates);
        const inEUR = convertCurrency(amt, settleCurrency, 'EUR', rates);
        const inUSDT = convertCurrency(amt, settleCurrency, 'USDT', rates);

        transfers.push({
          from: d.name,
          to: c.name,
          amount: amt,
          inVES,
          inUSD,
          inEUR,
          inUSDT,
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
  }, [isTricountActive, members, computedRows, settleCurrency, rates]);

  if (!isOpen) return null;

  const nowFormatted = new Date().toLocaleString('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

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
        tricountMode: sheet.tricountMode,
        members: sheet.members,
        payer: sheet.payer,
        prepaidConfig: sheet.prepaidConfig,
        settledTransfers: sheet.settledTransfers,
        settledDebtors: sheet.settledDebtors,
        partialSettlements: sheet.partialSettlements,
        rows: sheet.rows,
        createdAt: sheet.createdAt,
      },
    },
    null,
    2
  );

  const reportFileName = `${sheet.title.replace(/\s+/g, '_')}_${imageScope}_reporte.png`;

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

  // Copy WhatsApp Text Report
  const handleCopyWhatsAppText = async () => {
    if (!prepaidData) return;
    const text = formatPrepaidWhatsAppReport(sheet.title, prepaidData, settings.decimals, {
      includeHistory: includeContributionsHistory,
      includeMulticurrencyRemaining: includeMulticurrencyRemaining,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsAppText(true);
      setStatusMessage({
        text: '¡Reporte en texto para WhatsApp copiado al portapapeles!',
        type: 'success',
      });
      setTimeout(() => setCopiedWhatsAppText(false), 2500);
    } catch (err) {
      console.error('Error copying text for WhatsApp', err);
      setStatusMessage({ text: 'Error al copiar el texto.', type: 'error' });
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
              {/* Selector de qué incluir en la imagen: Ambos | Planner | Tricount */}
              <div className="w-full bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between px-0.5">
                  <span>¿Qué deseas incluir en la imagen?</span>
                  <span className="text-[10px] text-slate-400 font-normal">Previsualización en vivo</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setImageScope('planner')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      imageScope === 'planner'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>📊 Planner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageScope('tricount')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      imageScope === 'tricount'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>👥 Tripcount</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageScope('both')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      imageScope === 'both'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>📑 Tabla Completa</span>
                  </button>
                </div>

                {/* Opciones adicionales para el Planner: Historial y Multimoneda */}
                {imageScope === 'planner' && (
                  <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200 text-[11px] flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIncludeContributionsHistory((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10.5px] border ${
                        includeContributionsHistory
                          ? 'bg-blue-100 text-blue-900 border-blue-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${includeContributionsHistory ? 'text-blue-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>Historial de abonos</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeMulticurrencyRemaining((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10.5px] border ${
                        includeMulticurrencyRemaining
                          ? 'bg-blue-100 text-blue-900 border-blue-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${includeMulticurrencyRemaining ? 'text-blue-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>Falta en 4 monedas</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Scrollable Container with Complete Report Canvas inside */}
              <div className="w-full bg-slate-100/80 p-2 sm:p-4 rounded-2xl border border-slate-200 overflow-y-auto max-h-[58vh] touch-pan-y overscroll-contain flex justify-center">
                <div
                  ref={receiptRef}
                  className="bg-white rounded-2xl shadow-md border border-slate-200/90 p-5 sm:p-6 w-full max-w-[420px] text-slate-800 font-sans space-y-4"
                  style={{ minWidth: '320px' }}
                >
                  {/* 1. Header del Comprobante */}
                  <div className="text-center space-y-1 pb-3 border-b border-slate-100">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200/80 text-[10.5px] font-bold tracking-tight">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      <span>
                        {imageScope === 'planner'
                          ? 'Planificación & Colecta'
                          : imageScope === 'tricount'
                          ? 'Liquidación Tripcount'
                          : 'Reporte de Cuentas'}
                      </span>
                    </div>

                    <h4 className="text-lg font-black text-slate-950 tracking-tight leading-snug pt-1">
                      {sheet.title}
                    </h4>

                    <p className="text-[10.5px] text-slate-400 font-mono">
                      {nowFormatted}
                    </p>
                  </div>

                  {/* 2. Barra de Tasas del Día (Compacta y Elegante) */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-[10.5px] font-mono flex items-center justify-between text-slate-700">
                    <div className="flex items-center gap-1 font-bold text-slate-500 uppercase text-[9px]">
                      <span>Tasas:</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span>
                        <strong className="text-slate-500 font-normal">USD</strong>{' '}
                        <strong className="text-slate-900 font-bold">{formatNumber(rates.USD?.rateToVES || 0, 2)}</strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        <strong className="text-slate-500 font-normal">USDT</strong>{' '}
                        <strong className="text-slate-900 font-bold">{formatNumber(rates.USDT?.rateToVES || 0, 2)}</strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        <strong className="text-slate-500 font-normal">EUR</strong>{' '}
                        <strong className="text-slate-900 font-bold">{formatNumber(rates.EUR?.rateToVES || 0, 2)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* 3. SECCIÓN PLANNER (Planificación & Colecta con Meta, Cuota p/p, Abonado, Falta y Desglose por Persona) */}
                  {(imageScope === 'planner' || imageScope === 'both') && prepaidData && (
                    <div className="space-y-3">
                      {/* 4 Métricas Clave */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <div className="bg-blue-950 text-white p-2.5 rounded-xl border border-blue-800 text-center">
                          <span className="text-blue-200 block text-[9px] font-bold uppercase">Meta Total</span>
                          <span className="font-mono font-black text-white text-sm block mt-0.5">
                            {formatCurrency(prepaidData.totalTargetInBase, plannerCurrency, 2)}
                          </span>
                        </div>
                        <div className="bg-blue-900 text-white p-2.5 rounded-xl border border-blue-800 text-center">
                          <span className="text-blue-200 block text-[9px] font-bold uppercase">Cuota p/p</span>
                          <span className="font-mono font-black text-blue-100 text-sm block mt-0.5">
                            {formatCurrency(prepaidData.totalTargetInBase / (members.length || 1), plannerCurrency, 2)}
                          </span>
                        </div>
                        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-emerald-700 block text-[9px] font-bold uppercase">Abonado</span>
                            <span className="text-[9px] font-extrabold px-1 rounded bg-emerald-400 text-slate-950">
                              {prepaidData.progressPercent.toFixed(1)}%
                            </span>
                          </div>
                          <span className="font-mono font-black text-emerald-800 text-sm block mt-0.5">
                            {formatCurrency(prepaidData.totalCollectedInBase, plannerCurrency, 2)}
                          </span>
                        </div>
                        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center">
                          <span className="text-amber-700 block text-[9px] font-bold uppercase">Falta por Reunir</span>
                          <span className="font-mono font-black text-amber-800 text-sm block mt-0.5">
                            {formatCurrency(prepaidData.totalRemainingInBase, plannerCurrency, 2)}
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progreso Global */}
                      <div className="space-y-1">
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200">
                          <div
                            className="bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, prepaidData.progressPercent))}%` }}
                          />
                        </div>
                      </div>

                      {/* Desglose Elegante por Participante */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Participantes y Cuotas ({prepaidData.membersStats.length})
                        </span>

                        <div className="space-y-1.5">
                          {prepaidData.membersStats.map((m, idx) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-xl border transition-colors space-y-1 ${
                                m.isCompleted
                                  ? 'bg-emerald-50/30 border-emerald-300'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                      m.isCompleted
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {m.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="font-bold text-slate-900 text-xs truncate">
                                    {m.name}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    ({m.contributionsCount} {m.contributionsCount === 1 ? 'abono' : 'abonos'})
                                  </span>
                                </div>

                                {m.isCompleted ? (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-800 font-black text-[9px] bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    ¡Listo! (100%)
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold font-mono text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                    Falta: {formatCurrency(m.remainingInBase, plannerCurrency, 2)}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
                                <span>
                                  Abonó: <strong className="text-emerald-700 font-bold">{formatCurrency(m.collectedInBase, plannerCurrency, 2)}</strong> / {formatCurrency(m.quotaInBase, plannerCurrency, 2)}
                                </span>
                                <span className="font-bold text-blue-700">{m.percent}%</span>
                              </div>

                              {/* Desglose Multimoneda de lo que le falta */}
                              {!m.isCompleted && includeMulticurrencyRemaining && (
                                <div className="grid grid-cols-2 gap-1 mt-1.5 pt-1.5 border-t border-slate-200/80 text-[9px] font-mono bg-white/90 rounded-lg p-1.5 border border-slate-200 shadow-2xs">
                                  <div className="flex items-center justify-between text-slate-600">
                                    <span className="font-bold text-slate-500">USD:</span>
                                    <span className="font-bold text-slate-900">${formatNumber(m.remainingInAllCurrencies.USD, 2)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-600">
                                    <span className="font-bold text-slate-500">VES:</span>
                                    <span className="font-bold text-emerald-700">Bs {formatNumber(m.remainingInAllCurrencies.VES, 2)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-600">
                                    <span className="font-bold text-slate-500">USDT:</span>
                                    <span className="font-bold text-amber-700">{formatNumber(m.remainingInAllCurrencies.USDT, 2)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-600">
                                    <span className="font-bold text-slate-500">EUR:</span>
                                    <span className="font-bold text-teal-700">€{formatNumber(m.remainingInAllCurrencies.EUR, 2)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Historial de Abonos Registrados (Opcional con un click) */}
                      {includeContributionsHistory && prepaidData.contributions.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Historial de Abonos Registrados ({prepaidData.contributions.length})
                          </span>
                          <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                            {prepaidData.contributions.map((c) => (
                              <div
                                key={c.id}
                                className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] flex items-center justify-between gap-1.5"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1 font-semibold text-slate-800">
                                    <span>{c.member}</span>
                                    {c.note && <span className="text-slate-400 italic truncate font-normal">"{c.note}"</span>}
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-mono block">
                                    {new Date(c.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-slate-900 shrink-0">
                                  {formatCurrency(c.amount, c.currency, 2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. SECCIÓN TABLA COMPLETA (Filas y Totales Multidivisa) */}
                  {imageScope === 'both' && (
                    <div className="space-y-3">
                      {/* Encabezado de la tabla */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Desglose de Gastos ({computedRows.length} {computedRows.length === 1 ? 'ítem' : 'ítems'})
                        </span>
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                <th className="py-1.5 px-2 w-6 text-center">#</th>
                                <th className="py-1.5 px-2">Descripción</th>
                                <th className="py-1.5 px-2 text-right">Monto</th>
                                <th className="py-1.5 px-2 text-right">Equiv. $</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {computedRows.map((row, i) => (
                                <tr key={row.id || i} className={i % 2 === 1 ? 'bg-slate-50/50' : ''}>
                                  <td className="py-2 px-2 font-mono font-bold text-slate-400 text-center text-[10px]">
                                    {i + 1}
                                  </td>
                                  <td className="py-2 px-2 text-[11px] text-slate-800 font-medium max-w-[140px] break-words">
                                    {row.concept.trim() || <span className="text-slate-300">—</span>}
                                    {row.payer && isTricountActive && (
                                      <span className="text-[9px] text-indigo-600 block font-semibold">
                                        (Pagó: {row.payer})
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 font-mono font-bold text-slate-900 text-right whitespace-nowrap text-[11px]">
                                    {formatCurrency(row.evaluatedValue, row.currency, settings.decimals)}
                                  </td>
                                  <td className="py-2 px-2 font-mono font-bold text-indigo-700 text-right whitespace-nowrap text-[11px]">
                                    ${formatNumber(row.equivalents.USD, 2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Tarjeta de Totales Multimoneda */}
                      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-3.5 shadow-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                            Total General a Pagar
                          </span>
                          <span className="font-mono text-[10px] text-indigo-300 font-semibold">
                            4 Monedas
                          </span>
                        </div>

                        {/* Principal: Bolívares */}
                        <div className="flex items-baseline justify-between pt-0.5">
                          <span className="text-xs font-bold text-indigo-100">Total Bs:</span>
                          <span className="text-lg font-black font-mono tracking-tight text-white">
                            Bs. {formatNumber(totals.netByCurrency.VES, 2)}
                          </span>
                        </div>

                        {/* Secundarios: $, USDT, EUR */}
                        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-white/10 font-mono text-[10.5px]">
                          <div className="bg-white/10 rounded-lg p-1.5 text-center">
                            <span className="text-[9px] text-indigo-200 block uppercase">Dólares</span>
                            <span className="font-bold text-white">${formatNumber(totals.netByCurrency.USD, 2)}</span>
                          </div>
                          <div className="bg-white/10 rounded-lg p-1.5 text-center">
                            <span className="text-[9px] text-indigo-200 block uppercase">USDT</span>
                            <span className="font-bold text-white">{formatNumber(totals.netByCurrency.USDT, 2)}</span>
                          </div>
                          <div className="bg-white/10 rounded-lg p-1.5 text-center">
                            <span className="text-[9px] text-indigo-200 block uppercase">Euros</span>
                            <span className="font-bold text-white">€{formatNumber(totals.netByCurrency.EUR, 2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. SECCIÓN TRIPCOUNT POSTPAGO (Gastos Compartidos & Liquidación) */}
                  {(imageScope === 'tricount' || imageScope === 'both') && tricountData && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-900 font-black text-xs uppercase tracking-tight">
                          <span className="p-1 rounded bg-emerald-600 text-white">
                            <Users className="w-3 h-3" />
                          </span>
                          <span>Liquidación Tripcount</span>
                        </div>
                        <span className="text-[10px] font-bold font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          {members.length} personas
                        </span>
                      </div>

                      {/* Métricas de cuota justa */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
                          <span className="text-slate-400 block text-[9px] font-bold uppercase">Cuota Justa / Persona</span>
                          <span className="font-mono font-black text-slate-900 text-xs sm:text-sm block mt-0.5">
                            {formatCurrency(tricountData.fairShare, settleCurrency, settings.decimals)}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
                          <span className="text-slate-400 block text-[9px] font-bold uppercase">Gasto Total Compartido</span>
                          <span className="font-mono font-black text-slate-900 text-xs sm:text-sm block mt-0.5">
                            {formatCurrency(tricountData.totalShared, settleCurrency, settings.decimals)}
                          </span>
                        </div>
                      </div>

                      {/* Resumen de quién pagó qué */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Aportes de Gastos por Persona
                        </span>
                        <div className="space-y-1">
                          {members.map((name) => {
                            const paid = tricountData.paidByPerson[name] || 0;
                            const bal = tricountData.balances[name] || 0;
                            return (
                              <div
                                key={name}
                                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs flex items-center justify-between"
                              >
                                <span className="font-bold text-slate-800">{name}</span>
                                <div className="text-right font-mono text-[11px]">
                                  <span className="text-slate-500 mr-2">Pagó: {formatCurrency(paid, settleCurrency, 2)}</span>
                                  {bal > 0.009 ? (
                                    <span className="text-emerald-700 font-bold">Le deben +{formatCurrency(bal, settleCurrency, 2)}</span>
                                  ) : bal < -0.009 ? (
                                    <span className="text-rose-700 font-bold">Debe -{formatCurrency(-bal, settleCurrency, 2)}</span>
                                  ) : (
                                    <span className="text-slate-500 font-bold">Al día</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Transferencias */}
                      {tricountData.transfers.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Transferencias para Saldar Cuentas
                          </span>

                          <div className="space-y-1.5">
                            {tricountData.transfers.map((t, idx) => {
                              const transferKey = `${t.from}->${t.to}`;
                              const isSettled = Boolean(
                                sheet.settledTransfers?.[transferKey] ||
                                sheet.settledDebtors?.[t.from]
                              );

                              return (
                                <div
                                  key={idx}
                                  className={`p-2.5 rounded-xl border space-y-1.5 transition-colors ${
                                    isSettled
                                      ? 'bg-emerald-50/40 border-emerald-300'
                                      : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between font-bold">
                                    <div className="flex items-center gap-1.5 min-w-0 text-xs">
                                      <span className={isSettled ? 'text-slate-400 line-through' : 'text-rose-700 font-bold'}>
                                        {t.from}
                                      </span>
                                      <span className="text-slate-400 text-[10px] font-normal">➔</span>
                                      <span className="text-emerald-800 font-bold">{t.to}</span>
                                    </div>

                                    {isSettled ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider shadow-2xs">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        Listo / Ya pagó
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold">
                                        Pendiente
                                      </span>
                                    )}
                                  </div>

                                  <div className="bg-white p-1.5 rounded-lg border border-slate-200/80 font-mono text-[10px] flex items-center justify-between px-2 font-bold">
                                    <span className="text-slate-900">${formatNumber(t.inUSD, 2)}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-emerald-700">Bs. {formatNumber(t.inVES, 2)}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-amber-700">{formatNumber(t.inUSDT, 2)} USDT</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-teal-700">€{formatNumber(t.inEUR, 2)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 6. Footer de Marca Elegante */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                    <span>ProCalc • Multidivisa</span>
                    <span>Reporte Oficial</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Image / Report */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
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
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Compartir imagen por WhatsApp u otras apps"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartir</span>
                </button>

                {imageScope === 'planner' && (
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppText}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Copiar texto listo para pegar en WhatsApp"
                  >
                    {copiedWhatsAppText ? (
                      <Check className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                    <span>{copiedWhatsAppText ? '¡Copiado!' : 'Texto WhatsApp'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isGenerating}
                  className={`${imageScope === 'planner' ? 'col-span-1' : 'col-span-2 sm:col-span-1'} flex items-center justify-center gap-1.5 py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 active:scale-95 disabled:opacity-50`}
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
