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
} from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import { TapeRow } from './TapeCalculatorModal';
import { encodeCalcAccountShare } from '../utils/shareImporter';
import { formatNumber } from '../utils/currency';

export interface TapeRowItem {
  id: string;
  description: string;
  expression: string;
  evaluatedValue: number;
  subtotal: number;
  lineNum: number;
  isValid: boolean;
  isMathOp?: boolean;
}

interface ShareTapeAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountName: string;
  rows: TapeRowItem[] | TapeRow[];
  grandTotal: number;
  shareCode?: string;
}

export const ShareTapeAccountModal: React.FC<ShareTapeAccountModalProps> = ({
  isOpen,
  onClose,
  accountName,
  rows,
  grandTotal,
}) => {
  // Exactly 3 tabs with 'image' as the 1st one
  const [activeTab, setActiveTab] = useState<'image' | 'base64' | 'json'>('image');
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedBase64, setCopiedBase64] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const validRows = rows.filter((r) => r.expression.trim() || r.description.trim());

  const dateStr = new Date().toLocaleDateString('es-VE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Base64 Payload
  const base64Code = encodeCalcAccountShare(
    accountName,
    validRows.map((r) => ({
      id: (r as any).id || '',
      description: r.description,
      expression: r.expression,
    }))
  );

  // JSON Structure
  const rawJsonData = JSON.stringify(
    {
      app: 'ProCalc',
      version: '2.0',
      type: 'calculator_account',
      name: accountName,
      grandTotal,
      exportedAt: new Date().toISOString(),
      rows: validRows.map((r) => ({
        description: r.description,
        expression: r.expression,
        subtotal: (r as any).subtotal,
      })),
    },
    null,
    2
  );

  // Generate Image Blob capturing full height
  const handleGenerateImage = async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;
    setIsGenerating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const elem = receiptRef.current;
      const blob = await toBlob(elem, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        width: elem.offsetWidth || elem.scrollWidth,
        height: elem.offsetHeight || elem.scrollHeight,
      });
      return blob;
    } catch (err) {
      console.error('Error generating image', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Image to Clipboard
  const handleCopyImage = async () => {
    try {
      const blob = await handleGenerateImage();
      if (!blob) return;

      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
      } else {
        handleDownloadImage();
      }
    } catch (err) {
      console.error('Clipboard image copy failed, triggering share/download', err);
      handleShareImage();
    }
  };

  // Share Image via Web Share API
  const handleShareImage = async () => {
    try {
      const blob = await handleGenerateImage();
      if (!blob) return;

      const file = new File([blob], `${accountName.replace(/\s+/g, '_')}_cuenta.png`, {
        type: 'image/png',
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: accountName,
          text: `Comprobante de cuenta: ${accountName} (Total: $${formatNumber(grandTotal, 2)})`,
        });
      } else {
        handleDownloadImage();
      }
    } catch (err) {
      console.warn('Share image aborted or unsupported', err);
      handleDownloadImage();
    }
  };

  // Download Image
  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    setIsGenerating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const elem = receiptRef.current;
      const dataUrl = await toPng(elem, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        width: elem.offsetWidth || elem.scrollWidth,
        height: elem.offsetHeight || elem.scrollHeight,
      });
      const link = document.createElement('a');
      link.download = `${accountName.replace(/\s+/g, '_')}_cuenta.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error downloading image', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Base64
  const handleCopyBase64 = async () => {
    try {
      await navigator.clipboard.writeText(base64Code);
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
          title: `Cuenta: ${accountName}`,
          text: base64Code,
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
      await navigator.clipboard.writeText(rawJsonData);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    } catch (err) {
      console.error('Error copying JSON', err);
    }
  };

  // Share JSON
  const handleShareJson = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `JSON: ${accountName}`,
          text: rawJsonData,
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
      const blob = new Blob([rawJsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${accountName.replace(/\s+/g, '_')}_cuenta.json`;
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
                Compartir Cuenta: {accountName}
              </h3>
              <p className="text-[11px] text-slate-500">
                {validRows.length} registros • Total: ${formatNumber(grandTotal, 2)}
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
              {/* Scrollable Container with Complete Receipt Canvas inside */}
              <div className="w-full flex justify-center bg-slate-100 p-2 sm:p-3 rounded-xl border border-slate-200 overflow-y-auto max-h-[55vh] scrollbar-thin">
                <div
                  ref={receiptRef}
                  className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 w-full max-w-[380px] text-slate-800 font-sans h-auto"
                  style={{ minWidth: '320px' }}
                >
                  {/* Receipt Header */}
                  <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                    <div className="inline-block px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] font-black uppercase tracking-wider mb-1 border border-indigo-100">
                      Comprobante de Cuenta
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                      {accountName}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {dateStr}
                    </span>
                  </div>

                  {/* Complete Rows Table: # | Descripción | Monto | Subtotal */}
                  <div className="space-y-1.5 text-xs">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          <th className="py-1 px-1 w-6 text-center">#</th>
                          <th className="py-1 px-1.5">Descripción</th>
                          <th className="py-1 px-1.5 text-right">Monto</th>
                          <th className="py-1 px-1.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validRows.map((r, i) => (
                          <tr key={(r as any).id || i} className="text-[11px]">
                            <td className="py-1.5 px-1 font-mono font-bold text-slate-400 text-center">
                              {i + 1}
                            </td>
                            <td className="py-1.5 px-1.5 font-medium text-slate-700 max-w-[120px] break-words">
                              {r.description.trim() || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-1.5 px-1.5 font-mono font-bold text-slate-900 text-right whitespace-nowrap">
                              {r.expression.trim()}
                            </td>
                            <td className="py-1.5 px-1.5 font-mono font-bold text-indigo-700 text-right whitespace-nowrap">
                              ${formatNumber((r as any).subtotal || (r as any).evaluatedValue || 0, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total Bar */}
                  <div className="mt-4 pt-3 border-t-2 border-slate-900 flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900 uppercase tracking-tight">
                      Total General:
                    </span>
                    <span className="font-mono font-black text-lg text-indigo-900">
                      ${formatNumber(grandTotal, 2)}
                    </span>
                  </div>

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
            </div>
          ) : activeTab === 'base64' ? (
            /* TAB 2: BASE64 */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span className="uppercase tracking-tight">Código BASE64 (Importación Rápida)</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {base64Code.length} caracteres
                  </span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs break-all max-h-48 overflow-y-auto border border-slate-800 select-all scrollbar-thin">
                  {base64Code}
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
                    {rawJsonData.length} caracteres
                  </span>
                </div>
                <pre className="p-3 bg-slate-900 rounded-xl text-cyan-300 font-mono text-xs whitespace-pre overflow-x-auto max-h-48 border border-slate-800 scrollbar-thin select-all">
                  {rawJsonData}
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
