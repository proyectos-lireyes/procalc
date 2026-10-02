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
  FileText,
  Printer,
} from 'lucide-react';
import {
  Sheet,
  ComputedRow,
  ComputedSheetTotals,
  RatesState,
  AppSettings,
  ExportImageScope,
  Currency,
} from '../types';
import { encodeSheetShare } from '../utils/shareImporter';
import { formatCurrency, formatNumber, convertCurrency, convertToVES, CURRENCY_CONFIG } from '../utils/currency';
import {
  calculatePrepaidTripStats,
  formatPrepaidWhatsAppReport,
  calculatePostpaidStats,
  getSheetPlanners,
  getActivePlanner,
} from '../utils/tricountPrepaid';
import {
  captureElementToPng,
  copyImageMediaToClipboard,
  shareImageMedia,
  downloadImageMedia,
} from '../utils/mediaShare';
import {
  generatePdfFromCanvas,
  downloadHtmlReport,
} from '../utils/reportExporter';

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
  const [includePlanners, setIncludePlanners] = useState(true);
  const [includeFullTable, setIncludeFullTable] = useState(true);
  const [includeSettlement, setIncludeSettlement] = useState(true);
  const [includeContributionsHistory, setIncludeContributionsHistory] = useState(false);
  const [includeMulticurrencyRemaining, setIncludeMulticurrencyRemaining] = useState(true);
  const [includeTripcountRows, setIncludeTripcountRows] = useState(true);
  const [includeTripcountParticipantsBreakdown, setIncludeTripcountParticipantsBreakdown] = useState(false);
  const [includeTripcountHistory, setIncludeTripcountHistory] = useState(false);
  const [selectedCurrencies, setSelectedCurrencies] = useState<Currency[]>(['USD', 'VES', 'USDT', 'EUR']);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const toggleCurrency = (c: Currency) => {
    setSelectedCurrencies((prev) => {
      if (prev.includes(c)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter((item) => item !== c);
      } else {
        return [...prev, c];
      }
    });
  };

  const receiptRef = useRef<HTMLDivElement>(null);

  const members = sheet.members && sheet.members.length > 0 ? sheet.members : ['Yo'];
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

  const sheetPlanners = useMemo(() => getSheetPlanners(sheet), [sheet]);
  const defaultPlanner = useMemo(() => getActivePlanner(sheet), [sheet]);
  const [selectedPlannerId, setSelectedPlannerId] = useState<string>(
    sheet.activePlannerId || defaultPlanner.id || 'planner_default'
  );

  useEffect(() => {
    if (sheet.activePlannerId) {
      setSelectedPlannerId(sheet.activePlannerId);
    } else if (defaultPlanner.id) {
      setSelectedPlannerId(defaultPlanner.id);
    }
  }, [sheet.activePlannerId, defaultPlanner.id]);

  const activePlanner = useMemo(() => {
    return sheetPlanners.find((p) => p.id === selectedPlannerId) || defaultPlanner;
  }, [sheetPlanners, selectedPlannerId, defaultPlanner]);

  const plannerCurrency = activePlanner.targetCurrency || settings.displayCurrency;

  // Compute Prepaid Trip Stats if active or configured
  const prepaidData = useMemo(() => {
    return calculatePrepaidTripStats(members, activePlanner, rates, plannerCurrency);
  }, [members, activePlanner, rates, plannerCurrency]);

  // Compute Tripcount statistics taking row-level participant exemptions into account
  const postpaidStats = useMemo(() => {
    return calculatePostpaidStats(members, computedRows, settleCurrency, rates);
  }, [members, computedRows, settleCurrency, rates]);

  // Backward compatibility alias for template sections
  const tricountData = postpaidStats;

  // Sorted list for Planner Image Export:
  // "al compartir las imagenes, organiza por nombre alfabetico y pon primero los que deben y luego los que ya pagaron."
  const sortedPlannerMembers = useMemo(() => {
    if (!prepaidData) return [];
    const list = [...prepaidData.membersStats];
    list.sort((a, b) => {
      const aOwes = !a.isCompleted && a.remainingInBase > 0.009;
      const bOwes = !b.isCompleted && b.remainingInBase > 0.009;
      if (aOwes && !bOwes) return -1;
      if (!aOwes && bOwes) return 1;
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
    return list;
  }, [prepaidData]);

  // Sorted list for Tripcount Image Export:
  // First: members who owe (bal < -0.009) sorted alphabetically by name
  // Next: members who don't owe (bal >= -0.009) sorted alphabetically by name
  const sortedTripcountMembers = useMemo(() => {
    if (!postpaidStats) return [];
    const list = [...members];
    list.sort((a, b) => {
      const aBal = postpaidStats.balances[a] || 0;
      const bBal = postpaidStats.balances[b] || 0;
      const aOwes = aBal < -0.009;
      const bOwes = bBal < -0.009;
      if (aOwes && !bOwes) return -1;
      if (!aOwes && bOwes) return 1;
      return a.localeCompare(b, 'es', { sensitivity: 'base' });
    });
    return list;
  }, [members, postpaidStats]);

  // Sorted transfers for Tripcount Image Export:
  // First: pending transfers (alphabetical by debtor from, then creditor to)
  // Next: settled transfers (alphabetical by debtor from, then creditor to)
  const sortedTripcountTransfers = useMemo(() => {
    if (!postpaidStats) return [];
    const list = [...postpaidStats.transfers];
    list.sort((a, b) => {
      const aSettled = Boolean(
        sheet.settledTransfers?.[`${a.from}->${a.to}`] || sheet.settledDebtors?.[a.from]
      );
      const bSettled = Boolean(
        sheet.settledTransfers?.[`${b.from}->${b.to}`] || sheet.settledDebtors?.[b.from]
      );
      if (!aSettled && bSettled) return -1;
      if (aSettled && !bSettled) return 1;
      const cmpFrom = a.from.localeCompare(b.from, 'es', { sensitivity: 'base' });
      if (cmpFrom !== 0) return cmpFrom;
      return a.to.localeCompare(b.to, 'es', { sensitivity: 'base' });
    });
    return list;
  }, [postpaidStats, sheet.settledTransfers, sheet.settledDebtors]);

  // Consolidated Totals for the whole Account (Sum of all Planners + Tripcount)
  const consolidatedAccountTotals = useMemo(() => {
    let plannersTargetTotal = 0;
    let plannersCollectedTotal = 0;
    let plannersRemainingTotal = 0;

    sheetPlanners.forEach((p) => {
      const pCurr = p.targetCurrency || settings.displayCurrency;
      const stats = calculatePrepaidTripStats(members, p, rates, pCurr);
      const targetInSettle = convertCurrency(stats.totalTargetInBase, pCurr, settleCurrency, rates);
      const collectedInSettle = convertCurrency(stats.totalCollectedInBase, pCurr, settleCurrency, rates);
      const remainingInSettle = convertCurrency(stats.totalRemainingInBase, pCurr, settleCurrency, rates);

      plannersTargetTotal += targetInSettle;
      plannersCollectedTotal += collectedInSettle;
      plannersRemainingTotal += remainingInSettle;
    });

    const tripcountTotal = postpaidStats.totalSharedExpense;
    const grandTotal = plannersTargetTotal + tripcountTotal;

    return {
      grandTotal,
      plannersTargetTotal,
      plannersCollectedTotal,
      plannersRemainingTotal,
      tripcountTotal,
    };
  }, [sheetPlanners, members, rates, settings.displayCurrency, settleCurrency, postpaidStats]);

  if (!isOpen) return null;

  const nowFormatted = new Date().toLocaleString('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // 1. Base64
  const sheetBase64 = encodeSheetShare(sheet);

  // 2. Structured JSON (shares everything: group, planners, tripcount, abonos, pagos)
  const sheetJsonString = JSON.stringify(
    {
      app: 'ProCalc',
      version: '2.0',
      type: 'spreadsheet_sheet',
      exportedAt: new Date().toISOString(),
      sheet: {
        id: sheet.id,
        title: sheet.title,
        currency: (sheet as any).currency,
        isTricountActive: sheet.isTricountActive,
        tricountMode: sheet.tricountMode,
        tricountGroupId: sheet.tricountGroupId,
        members: sheet.members,
        payer: (sheet as any).payer,
        prepaidConfig: sheet.prepaidConfig,
        planners: sheet.planners,
        activePlannerId: sheet.activePlannerId,
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

  // Download PDF Report Document
  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const pdfFileName = `${sheet.title.replace(/\s+/g, '_')}_${imageScope}_reporte.pdf`;
      const res = await generatePdfFromCanvas(receiptRef.current, pdfFileName, sheet.title);
      if (res.success) {
        setStatusMessage({
          text: '¡Documento PDF descargado exitosamente!',
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: res.error || 'No se pudo generar el PDF.',
          type: 'error',
        });
      }
    } catch (err) {
      console.error('handleDownloadPdf failed:', err);
      setStatusMessage({ text: 'Error al generar el archivo PDF.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Download Standalone HTML Report
  const handleDownloadHtml = () => {
    try {
      const htmlFileName = `${sheet.title.replace(/\s+/g, '_')}_${imageScope}_reporte.html`;
      downloadHtmlReport(
        sheet,
        computedRows,
        totals,
        rates,
        settings,
        {
          includePlanners,
          includeTripcountRows,
          includeParticipantsBreakdown: includeTripcountParticipantsBreakdown,
          includeSettlement,
          includeHistory: includeTripcountHistory,
          includeFullTable,
          selectedCurrencies,
        },
        htmlFileName
      );
      setStatusMessage({
        text: '¡Reporte HTML descargado con éxito!',
        type: 'success',
      });
    } catch (err) {
      console.error('handleDownloadHtml failed:', err);
      setStatusMessage({ text: 'Error al exportar archivo HTML.', type: 'error' });
    }
  };

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

  // Copy WhatsApp Text Report (Supports both Planner and Tripcount Postpaid)
  const handleCopyWhatsAppText = async () => {
    let text = '';
    const isPlannerSelected =
      imageScope === 'planner' || (imageScope === 'both' && sheet.tricountMode === 'prepaid');

    if (isPlannerSelected && prepaidData) {
      text = formatPrepaidWhatsAppReport(
        sheet.title,
        prepaidData,
        settings.decimals,
        {
          includeHistory: includeContributionsHistory,
          includeMulticurrencyRemaining: includeMulticurrencyRemaining,
        },
        activePlanner.name
      );
    } else if (postpaidStats) {
      text = `👥 *TRIPCOUNT / GASTOS COMPARTIDOS*\n`;
      text += `📂 *Cuenta:* ${sheet.title}\n`;
      text += `💰 *Gasto Total Compartido:* ${formatCurrency(postpaidStats.totalSharedExpense, settleCurrency, settings.decimals)}\n`;
      text += `🤝 *Cuota por persona:* ${formatCurrency(postpaidStats.fairShare, settleCurrency, settings.decimals)}\n`;
      text += `───────────────────────────\n`;
      text += `📊 *PAGOS Y SALDOS (Primero los que deben):*\n\n`;

      sortedTripcountMembers.forEach((m) => {
        const paid = postpaidStats.paidByPerson[m] || 0;
        const bal = postpaidStats.balances[m] || 0;
        const status =
          bal > 0.01
            ? `(recibe +${formatCurrency(bal, settleCurrency, settings.decimals)})`
            : bal < -0.01
            ? `(debe ${formatCurrency(Math.abs(bal), settleCurrency, settings.decimals)})`
            : `(al día)`;
        text += `• *${m}*: pagó ${formatCurrency(paid, settleCurrency, settings.decimals)} ${status}\n`;
      });

      text += `\n───────────────────────────\n`;
      text += `💸 *LIQUIDACIÓN: ¿QUIÉN LE DEBE A QUIÉN?*\n`;
      if (sortedTripcountTransfers.length === 0) {
        text += `✅ ¡Todos están al día! Nadie se debe nada.\n`;
      } else {
        sortedTripcountTransfers.forEach((t) => {
          const transferKey = `${t.from}->${t.to}`;
          const isSettled = Boolean(sheet.settledTransfers?.[transferKey] || sheet.settledDebtors?.[t.from]);
          if (isSettled) {
            text += `\n✅ *[LISTO / YA PAGÓ]* *${t.from}* ➔ *${t.to}*: ${formatCurrency(t.amountsInAllCurrencies.USD, 'USD', settings.decimals)} (Liquidado)\n`;
          } else {
            text += `\n⏳ *[PENDIENTE]* *${t.from}* le paga a *${t.to}*:\n`;
            text += `   • ${formatCurrency(t.amountsInAllCurrencies.USD, 'USD', settings.decimals)} (Dólares)\n`;
            text += `   • ${formatCurrency(t.amountsInAllCurrencies.VES, 'VES', settings.decimals)} (Bolívares)\n`;
            text += `   • ${formatCurrency(t.amountsInAllCurrencies.USDT, 'USDT', settings.decimals)} (USDT)\n`;
            text += `   • ${formatCurrency(t.amountsInAllCurrencies.EUR, 'EUR', settings.decimals)} (Euros)\n`;
          }
        });
      }
      text += `\n───────────────────────────\n`;
      text += `_Calculado con ProCalc_`;
    }

    if (!text) return;

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

                {/* Opciones adicionales para Tripcount: Filas, Desglose por Persona e Historial */}
                {imageScope === 'tricount' && (
                  <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200 text-[11px] flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIncludeTripcountRows((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10.5px] border ${
                        includeTripcountRows
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${includeTripcountRows ? 'text-emerald-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>1. Pagos por fila</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeTripcountParticipantsBreakdown((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10.5px] border ${
                        includeTripcountParticipantsBreakdown
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${includeTripcountParticipantsBreakdown ? 'text-emerald-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>Gastos por persona</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeTripcountHistory((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10.5px] border ${
                        includeTripcountHistory
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${includeTripcountHistory ? 'text-emerald-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>3. Historial</span>
                    </button>
                  </div>
                )}

                {/* Opciones para Reporte Completo (Planners + Tripcount + Tabla) */}
                {imageScope === 'both' && (
                  <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200 text-[11px] flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIncludePlanners((prev) => !prev)}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10px] border ${
                        includePlanners
                          ? 'bg-blue-100 text-blue-900 border-blue-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${includePlanners ? 'text-blue-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>Planners ({sheetPlanners.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeTripcountRows((prev) => !prev)}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10px] border ${
                        includeTripcountRows
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${includeTripcountRows ? 'text-emerald-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>Gastos Tripcount</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeTripcountParticipantsBreakdown((prev) => !prev)}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10px] border ${
                        includeTripcountParticipantsBreakdown
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${includeTripcountParticipantsBreakdown ? 'text-emerald-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>Por persona</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeSettlement((prev) => !prev)}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10px] border ${
                        includeSettlement
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${includeSettlement ? 'text-emerald-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>Liquidación</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeFullTable((prev) => !prev)}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10px] border ${
                        includeFullTable
                          ? 'bg-indigo-100 text-indigo-900 border-indigo-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${includeFullTable ? 'text-indigo-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>Tabla Filas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeTripcountHistory((prev) => !prev)}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 text-[10px] border ${
                        includeTripcountHistory
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${includeTripcountHistory ? 'text-emerald-600 stroke-[3]' : 'opacity-20'}`} />
                      <span>Historial</span>
                    </button>
                  </div>
                )}

                {/* Selector de Monedas a incluir en la imagen */}
                <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200 text-[11px] flex-wrap">
                  <span className="text-[10px] font-bold text-slate-600 uppercase shrink-0">Monedas en imagen:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(['USD', 'VES', 'USDT', 'EUR'] as Currency[]).map((c) => {
                      const isChecked = selectedCurrencies.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleCurrency(c)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                            isChecked
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                              : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {c === 'USD' ? '$ USD' : c === 'VES' ? 'Bs VES' : c === 'USDT' ? '₮ USDT' : '€ EUR'}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedCurrencies(['USD', 'VES', 'USDT', 'EUR'])}
                      className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold text-indigo-700 hover:underline cursor-pointer"
                    >
                      (Todas 4)
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Container with Complete Report Canvas inside */}
              <div className="w-full bg-slate-100/80 p-2 sm:p-4 rounded-2xl border border-slate-200 overflow-y-auto max-h-[58vh] touch-pan-y overscroll-contain flex justify-center">
                <div
                  ref={receiptRef}
                  className="bg-white rounded-2xl shadow-md border border-slate-200/90 p-4 sm:p-5 w-full max-w-[600px] text-slate-800 font-sans space-y-3.5"
                  style={{ minWidth: '320px' }}
                >
                  {/* 1. Header del Comprobante */}
                  <div className="text-center space-y-1 pb-2.5 border-b border-slate-100">
                    <h4 className="text-xl font-black text-slate-950 tracking-tight leading-snug">
                      {sheet.title}
                    </h4>

                    {imageScope === 'planner' ? (
                      <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs">
                        <span>{activePlanner.name || 'General'}</span>
                      </div>
                    ) : imageScope === 'tricount' ? (
                      <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs">
                        <span>Tripcount</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-xs">
                        <span>Reporte de Cuentas</span>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 font-mono">
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
                          {selectedCurrencies.filter((c) => c !== plannerCurrency).length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-1 pt-1 border-t border-white/10 mt-1 text-[8.5px] font-mono text-blue-200">
                              {selectedCurrencies
                                .filter((c) => c !== plannerCurrency)
                                .map((c) => (
                                  <span key={c} className="bg-white/10 px-1 py-0.2 rounded">
                                    {formatCurrency(
                                      convertCurrency(prepaidData.totalTargetInBase, plannerCurrency, c, rates),
                                      c,
                                      2
                                    )}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>

                        <div className="bg-blue-900 text-white p-2.5 rounded-xl border border-blue-800 text-center">
                          <span className="text-blue-200 block text-[9px] font-bold uppercase">Cuota p/p</span>
                          <span className="font-mono font-black text-blue-100 text-sm block mt-0.5">
                            {formatCurrency(prepaidData.totalTargetInBase / (members.length || 1), plannerCurrency, 2)}
                          </span>
                          {selectedCurrencies.filter((c) => c !== plannerCurrency).length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-1 pt-1 border-t border-white/10 mt-1 text-[8.5px] font-mono text-blue-200">
                              {selectedCurrencies
                                .filter((c) => c !== plannerCurrency)
                                .map((c) => (
                                  <span key={c} className="bg-white/10 px-1 py-0.2 rounded">
                                    {formatCurrency(
                                      convertCurrency(
                                        prepaidData.totalTargetInBase / (members.length || 1),
                                        plannerCurrency,
                                        c,
                                        rates
                                      ),
                                      c,
                                      2
                                    )}
                                  </span>
                                ))}
                            </div>
                          )}
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
                          {selectedCurrencies.filter((c) => c !== plannerCurrency).length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-1 pt-1 border-t border-emerald-200/60 mt-1 text-[8.5px] font-mono text-emerald-800">
                              {selectedCurrencies
                                .filter((c) => c !== plannerCurrency)
                                .map((c) => (
                                  <span key={c} className="bg-emerald-100 px-1 py-0.2 rounded">
                                    {formatCurrency(
                                      convertCurrency(prepaidData.totalCollectedInBase, plannerCurrency, c, rates),
                                      c,
                                      2
                                    )}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>

                        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center">
                          <span className="text-amber-700 block text-[9px] font-bold uppercase">Falta por Reunir</span>
                          <span className="font-mono font-black text-amber-800 text-sm block mt-0.5">
                            {formatCurrency(prepaidData.totalRemainingInBase, plannerCurrency, 2)}
                          </span>
                          {selectedCurrencies.filter((c) => c !== plannerCurrency).length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-1 pt-1 border-t border-amber-200/60 mt-1 text-[8.5px] font-mono text-amber-800">
                              {selectedCurrencies
                                .filter((c) => c !== plannerCurrency)
                                .map((c) => (
                                  <span key={c} className="bg-amber-100 px-1 py-0.2 rounded">
                                    {formatCurrency(
                                      convertCurrency(prepaidData.totalRemainingInBase, plannerCurrency, c, rates),
                                      c,
                                      2
                                    )}
                                  </span>
                                ))}
                            </div>
                          )}
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

                      {/* Desglose Elegante por Participante (Primero los que deben, orden alfabético) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Participantes y Cuotas{activePlanner.name && activePlanner.name !== 'General' ? `: ${activePlanner.name}` : ''} ({sortedPlannerMembers.length})
                          </span>
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded-xs">
                            Pendientes primero
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {sortedPlannerMembers.map((m, idx) => (
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

                              {/* Desglose Multimoneda de lo que le falta en las monedas seleccionadas */}
                              {!m.isCompleted && includeMulticurrencyRemaining && selectedCurrencies.length > 0 && (
                                <div className="grid grid-cols-2 gap-1 mt-1.5 pt-1.5 border-t border-slate-200/80 text-[9px] font-mono bg-white/90 rounded-lg p-1.5 border border-slate-200 shadow-2xs">
                                  {selectedCurrencies.map((cur) => {
                                    const convAmt = convertCurrency(m.remainingInBase, plannerCurrency, cur, rates);
                                    return (
                                      <div key={cur} className="flex items-center justify-between text-slate-600 px-1 py-0.5 rounded bg-slate-50 border border-slate-100">
                                        <span className="font-bold text-slate-500">{cur}:</span>
                                        <span className="font-bold text-slate-900">
                                          {formatCurrency(convAmt, cur, 2)}
                                        </span>
                                      </div>
                                    );
                                  })}
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

                  {/* 4. SECCIÓN REPORTE CONSOLIDADO COMPLETO (Planners + Tripcount + Tabla) */}
                  {imageScope === 'both' && (
                    <div className="space-y-3.5">
                      {/* Banner de Gasto Total Consolidado de la Cuenta */}
                      <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-900 via-blue-950 to-slate-900 text-white shadow-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                            Gasto Total de la Cuenta (Planners + Tripcount)
                          </span>
                          <span className="font-mono text-[9.5px] text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                            Consolidado
                          </span>
                        </div>

                        {/* Principal Consolidado */}
                        <div className="flex items-baseline justify-between pt-0.5">
                          <span className="text-xs font-bold text-indigo-100">Total Consolidado:</span>
                          <span className="text-lg font-black font-mono tracking-tight text-white">
                            {formatCurrency(consolidatedAccountTotals.grandTotal, settleCurrency, 2)}
                          </span>
                        </div>

                        {/* Subtotales: Planners vs Tripcount */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/10 font-mono text-[10.5px]">
                          <div className="bg-white/10 rounded-lg p-2 text-center">
                            <span className="text-[8.5px] text-blue-200 block uppercase font-bold">Total Planners ({sheetPlanners.length})</span>
                            <span className="font-black text-white text-xs block mt-0.5">
                              {formatCurrency(consolidatedAccountTotals.plannersTargetTotal, settleCurrency, 2)}
                            </span>
                            <span className="text-[8px] text-emerald-300 block">
                              ({formatCurrency(consolidatedAccountTotals.plannersCollectedTotal, settleCurrency, 2)} abonado)
                            </span>
                          </div>

                          <div className="bg-white/10 rounded-lg p-2 text-center">
                            <span className="text-[8.5px] text-emerald-200 block uppercase font-bold">Total Tripcount</span>
                            <span className="font-black text-white text-xs block mt-0.5">
                              {formatCurrency(consolidatedAccountTotals.tripcountTotal, settleCurrency, 2)}
                            </span>
                            <span className="text-[8px] text-emerald-300 block">
                              ({members.length} participantes)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Desglose de Todos los Planners */}
                      {includePlanners && sheetPlanners.length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-slate-100">
                          <span className="text-[10.5px] font-bold text-slate-800 uppercase tracking-wider block">
                            Planners y Colectas ({sheetPlanners.length})
                          </span>

                          <div className="space-y-2">
                            {sheetPlanners.map((p) => {
                              const pCurr = p.targetCurrency || settings.displayCurrency;
                              const pStats = calculatePrepaidTripStats(members, p, rates, pCurr);

                              return (
                                <div key={p.id} className="p-2.5 rounded-xl border border-blue-200/80 bg-blue-50/40 space-y-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="p-1 rounded-md bg-blue-600 text-white">
                                        <Plane className="w-3 h-3" />
                                      </span>
                                      <strong className="font-bold text-slate-900 text-xs">
                                        Planner: {p.name || 'General'}
                                      </strong>
                                    </div>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${pStats.isGoalReached ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                      {pStats.progressPercent.toFixed(1)}% ({formatCurrency(pStats.totalCollectedInBase, pCurr, 2)})
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-3 gap-1 font-mono text-[9.5px] text-center bg-white p-1 rounded-lg border border-slate-200/80">
                                    <div>
                                      <span className="text-[7.5px] text-slate-400 block uppercase">Meta</span>
                                      <strong>{formatCurrency(pStats.totalTargetInBase, pCurr, 2)}</strong>
                                    </div>
                                    <div>
                                      <span className="text-[7.5px] text-slate-400 block uppercase">Cuota p/p</span>
                                      <strong>{formatCurrency(pStats.totalTargetInBase / (members.length || 1), pCurr, 2)}</strong>
                                    </div>
                                    <div>
                                      <span className="text-[7.5px] text-slate-400 block uppercase">Falta</span>
                                      <strong className={pStats.isGoalReached ? 'text-emerald-700' : 'text-amber-800'}>
                                        {pStats.isGoalReached ? '¡Listo!' : formatCurrency(pStats.totalRemainingInBase, pCurr, 2)}
                                      </strong>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Desglose de la Tabla de Gastos */}
                      {includeFullTable && computedRows.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                            Tabla de Gastos ({computedRows.length} ítems)
                          </span>
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                            <table className="w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[9.5px] font-bold text-slate-500 uppercase">
                                  <th className="py-1 px-2 w-6 text-center">#</th>
                                  <th className="py-1 px-2">Descripción</th>
                                  <th className="py-1 px-2 text-right">Monto</th>
                                  <th className="py-1 px-2 text-right">Equiv. {settleCurrency}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white text-[10.5px]">
                                {computedRows.map((row, i) => (
                                  <tr key={row.id || i} className={i % 2 === 1 ? 'bg-slate-50/50' : ''}>
                                    <td className="py-1.5 px-2 font-mono font-bold text-slate-400 text-center text-[9px]">
                                      {i + 1}
                                    </td>
                                    <td className="py-1.5 px-2 text-slate-800 font-medium max-w-[140px] break-words">
                                      {row.concept.trim() || <span className="text-slate-300">—</span>}
                                      {row.payer && (
                                        <span className="text-[8.5px] text-indigo-600 block font-semibold">
                                          (Pagó: {row.payer})
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2 font-mono font-bold text-slate-900 text-right whitespace-nowrap">
                                      {formatCurrency(row.evaluatedValue, row.currency, settings.decimals)}
                                    </td>
                                    <td className="py-1.5 px-2 font-mono font-bold text-indigo-700 text-right whitespace-nowrap">
                                      {formatCurrency(row.equivalents[settleCurrency], settleCurrency, settings.decimals)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. SECCIÓN TRIPCOUNT POSTPAGO (Gastos Compartidos & Liquidación) */}
                  {(imageScope === 'tricount' || imageScope === 'both') && postpaidStats && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      {/* Summary Banner - 3 Tarjetas en 1 Sola Línea */}
                      <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 border border-emerald-200 shadow-2xs space-y-1.5">
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase block">Gasto Total</span>
                            <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-900 block truncate mt-0.5">
                              {formatCurrency(postpaidStats.totalSharedExpense, settleCurrency, settings.decimals)}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase block">Cuota p/p</span>
                            <span className="text-xs sm:text-sm font-extrabold font-mono text-emerald-800 block truncate mt-0.5">
                              {formatCurrency(postpaidStats.fairShare, settleCurrency, settings.decimals)}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase block">Participantes</span>
                            <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-900 block truncate mt-0.5">
                              {members.length} {members.length === 1 ? 'persona' : 'personas'}
                            </span>
                          </div>
                        </div>

                        {/* Indicación de Moneda Base de Conversión */}
                        <div className="text-[9px] font-mono text-slate-400 text-center flex items-center justify-center gap-1">
                          <span>Base de liquidación:</span>
                          <strong className="text-slate-600 font-bold">{settleCurrency} ({CURRENCY_CONFIG[settleCurrency].name})</strong>
                          <span>• Conversión a tasas oficiales del comprobante</span>
                        </div>
                      </div>

                      {/* 1. ¿Quién pagó cada fila? (Detalle con moneda original y convertido) */}
                      {includeTripcountRows && computedRows.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                              1. ¿Quién pagó cada fila? ({computedRows.length})
                            </span>
                          </div>
                          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white overflow-hidden shadow-2xs">
                            {computedRows.map((row, idx) => {
                              const currentPayer = row.payer && members.includes(row.payer) ? row.payer : members[0];
                              const isCustomSplit =
                                row.participants &&
                                row.participants.length > 0 &&
                                row.participants.length < members.length;
                              const isDifferentCurrency = row.currency !== settleCurrency;

                              return (
                                <div key={row.id || idx} className="p-2 flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="font-mono text-slate-400 text-[10px] font-bold shrink-0">
                                      #{idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <span className="font-medium text-slate-800 truncate block">
                                        {row.concept || '(Sin descripción)'}
                                      </span>
                                      {isCustomSplit && (
                                        <span className="text-[8.5px] font-bold text-amber-700 block">
                                          ({row.participants!.length} de {members.length} pers.)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-right">
                                    <div>
                                      <span className="text-slate-900 font-bold block">
                                        {formatCurrency(row.equivalents[settleCurrency], settleCurrency, settings.decimals)}
                                      </span>
                                      {isDifferentCurrency && (
                                        <span className="text-[9px] text-slate-400 block font-normal">
                                          (Orig: {formatCurrency(row.evaluatedValue, row.currency, 2)})
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[9.5px]">
                                      Pagó: {currentPayer}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Desglose de Gastos por Persona (Quién está contado en qué gasto) */}
                      {includeTripcountParticipantsBreakdown && (
                        <div className="space-y-1.5 pt-1 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                            Detalle de Gastos por Participante
                          </span>
                          <div className="space-y-1.5">
                            {members.map((m) => {
                              const includedRows = computedRows.filter((r) => {
                                if (!r.isValid) return false;
                                return !r.participants || r.participants.length === 0 || r.participants.includes(m);
                              });
                              const consumed = postpaidStats.consumedByPerson[m] || 0;
                              const paid = postpaidStats.paidByPerson[m] || 0;

                              return (
                                <div key={m} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-1">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[9px] flex items-center justify-center">
                                        {m.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="font-bold text-slate-900 text-xs">{m}</span>
                                      <span className="text-[9.5px] text-slate-400 font-mono">
                                        ({includedRows.length} {includedRows.length === 1 ? 'gasto' : 'gastos'})
                                      </span>
                                    </div>
                                    <div className="text-right font-mono text-[10px]">
                                      <span className="text-slate-500">Consumo: </span>
                                      <strong className="text-slate-900 font-bold">{formatCurrency(consumed, settleCurrency, 2)}</strong>
                                    </div>
                                  </div>

                                  {/* Rows list for this participant */}
                                  <div className="space-y-0.5">
                                    {includedRows.map((r, rIdx) => {
                                      const rowParts = r.participants && r.participants.length > 0 ? r.participants : members;
                                      const share = Math.abs(r.equivalents[settleCurrency]) / (rowParts.length || 1);
                                      return (
                                        <div key={r.id || rIdx} className="flex items-center justify-between text-[10px] text-slate-600 pl-1 font-mono">
                                          <span className="truncate max-w-[200px] text-slate-700">
                                            • {r.concept || '(Gasto)'} <span className="text-slate-400">(Pagó: {r.payer || members[0]})</span>
                                          </span>
                                          <span className="font-semibold text-slate-900">
                                            {formatCurrency(share, settleCurrency, 2)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2. Liquidación • ¿Quién le debe a quién? (Tarjetas Anchas y Compactas con Monedas Seleccionadas) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider block">
                            2. Liquidación • ¿Quién le debe a quién?
                          </span>
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                            {postpaidStats.transfers.length} {postpaidStats.transfers.length === 1 ? 'transferencia' : 'transferencias'}
                          </span>
                        </div>

                        {postpaidStats.transfers.length === 0 ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-emerald-800 text-xs font-bold">
                            🎉 ¡Cuentas al día! Nadie se debe nada.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {sortedTripcountTransfers.map((t, idx) => {
                              const transferKey = `${t.from}->${t.to}`;
                              const isSettled = Boolean(
                                sheet.settledTransfers?.[transferKey] ||
                                sheet.settledDebtors?.[t.from]
                              );

                              return (
                                <div
                                  key={idx}
                                  className={`p-2 sm:p-2.5 rounded-xl border space-y-1.5 transition-colors ${
                                    isSettled
                                      ? 'bg-emerald-50/40 border-emerald-300'
                                      : 'bg-white border-slate-200 shadow-2xs'
                                  }`}
                                >
                                  {/* Encabezado Compacto de la Transferencia */}
                                  <div className="flex items-center justify-between font-bold flex-wrap gap-1">
                                    <div className="flex items-center gap-1.5 min-w-0 text-xs">
                                      <span
                                        className={`px-2 py-0.5 rounded-md border text-xs font-bold ${
                                          isSettled
                                            ? 'bg-slate-100 text-slate-400 line-through border-slate-200'
                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                        }`}
                                      >
                                        {t.from}
                                      </span>
                                      <span className="text-slate-400 text-[10.5px] font-normal">le debe pagar a</span>
                                      <span className="px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-bold">
                                        {t.to}
                                      </span>
                                    </div>

                                    {isSettled ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[8.5px] font-black uppercase tracking-wider shadow-2xs">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        Listo / Ya pagó
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[8.5px] font-bold">
                                        Pendiente
                                      </span>
                                    )}
                                  </div>

                                  {/* Cajas de Monedas en 1 Sola Línea Horizontal Dinámica (Compactas y Anchas) */}
                                  <div className="flex items-center gap-1 font-mono text-[9.5px] overflow-x-auto scrollbar-none">
                                    {selectedCurrencies.map((cur) => {
                                      const amt = t.amountsInAllCurrencies?.[cur] ?? convertCurrency(t.amount, settleCurrency, cur, rates);
                                      const isUsd = cur === 'USD';
                                      const isVes = cur === 'VES';
                                      const isUsdt = cur === 'USDT';
                                      const isEur = cur === 'EUR';

                                      const bgClass = isUsd
                                        ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                                        : isVes
                                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                                        : isUsdt
                                        ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-950';

                                      return (
                                        <div
                                          key={cur}
                                          className={`flex-1 min-w-[70px] p-1 rounded-lg border text-center ${bgClass}`}
                                        >
                                          <span className="text-[7.5px] font-bold uppercase block opacity-70">
                                            {cur}
                                          </span>
                                          <span className="font-black text-[10.5px] block truncate">
                                            {formatCurrency(amt, cur, 2)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 3. Historial de Abonos y Liquidaciones de Tripcount (Opcional en la imagen) */}
                      {includeTripcountHistory && (
                        <div className="space-y-1.5 pt-1 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                            3. Historial de Abonos y Liquidaciones de Tripcount
                          </span>
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                            {Object.keys(sheet.settledTransfers || {}).length === 0 &&
                            Object.keys(sheet.settledDebtors || {}).length === 0 &&
                            Object.keys(sheet.partialSettlements || {}).length === 0 ? (
                              <p className="text-slate-400 italic">No hay liquidaciones o abonos registrados aún.</p>
                            ) : (
                              <div className="space-y-1">
                                {Object.entries(sheet.settledTransfers || {}).map(([key, val]) =>
                                  val ? (
                                    <div key={key} className="flex items-center justify-between font-mono">
                                      <span>Liquidación: {key.replace('->', ' ➔ ')}</span>
                                      <span className="text-emerald-700 font-bold">Completada</span>
                                    </div>
                                  ) : null
                                )}
                                {Object.entries(sheet.partialSettlements || {}).map(([key, rawAmt]) => {
                                  const amt = Number(rawAmt) || 0;
                                  return amt > 0 ? (
                                    <div key={key} className="flex items-center justify-between font-mono">
                                      <span>Abono parcial: {key.replace('->', ' ➔ ')}</span>
                                      <span className="text-blue-700 font-bold">{formatCurrency(amt, settleCurrency, 2)}</span>
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            )}
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

              {/* Action Buttons for Image / Report / PDF / HTML */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 pt-1">
                {/* 1. Copiar Imagen */}
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Copiar imagen HD directamente al portapapeles"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : copiedImage ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span className="truncate">{copiedImage ? '¡Copiada!' : 'Copiar Imagen'}</span>
                </button>

                {/* 2. Compartir (WhatsApp / Apps) */}
                <button
                  type="button"
                  onClick={handleShareImage}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Compartir imagen por WhatsApp u otras apps"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="truncate">Compartir</span>
                </button>

                {/* 3. Descargar PNG HD */}
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 active:scale-95 disabled:opacity-50"
                  title="Descargar imagen PNG en alta definición"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span className="truncate">PNG (HD)</span>
                </button>

                {/* 4. Exportar Documento PDF */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Exportar a documento PDF multipágina o tamaño carta"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate">Exportar PDF</span>
                </button>

                {/* 5. Reporte HTML Interactivo / Imprimible */}
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Descargar reporte interactivo en formato HTML"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span className="truncate">Reporte HTML</span>
                </button>

                {/* 6. Texto para WhatsApp */}
                <button
                  type="button"
                  onClick={handleCopyWhatsAppText}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Copiar texto resumen formateado para WhatsApp"
                >
                  {copiedWhatsAppText ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5" />
                  )}
                  <span className="truncate">{copiedWhatsAppText ? '¡Copiado!' : 'WhatsApp'}</span>
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
