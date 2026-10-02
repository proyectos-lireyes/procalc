import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Download,
  ClipboardPaste,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Calculator,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  parseSharedText,
  ParsedShareData,
  CalcSharePayload,
  SheetSharePayload,
} from '../utils/shareImporter';
import { readClipboardTextMedia } from '../utils/mediaShare';

interface ImportSharedModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: 'calculator' | 'sheets';
  onImportCalcAccount?: (data: CalcSharePayload, mode: 'new' | 'replace') => void;
  onImportSheet?: (data: SheetSharePayload, mode: 'new' | 'replace') => void;
}

export const ImportSharedModal: React.FC<ImportSharedModalProps> = ({
  isOpen,
  onClose,
  context,
  onImportCalcAccount,
  onImportSheet,
}) => {
  const [inputText, setInputText] = useState('');
  const [pastedStatus, setPastedStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputText('');
      setPastedStatus(null);
    }
  }, [isOpen]);

  const parsed = useMemo<ParsedShareData | null>(() => {
    return parseSharedText(inputText);
  }, [inputText]);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await readClipboardTextMedia();
      if (text && text.trim()) {
        setInputText(text.trim());
        setPastedStatus('¡Texto pegado con éxito!');
        setTimeout(() => setPastedStatus(null), 2500);
        return;
      }
    } catch (e) {
      console.warn('Clipboard read error:', e);
    }

    // Fallback: If clipboard read could not be accessed, focus and select textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    setPastedStatus('Portapapeles no accesible. Deja presionado el recuadro y toca Pegar.');
    setTimeout(() => setPastedStatus(null), 4000);
  };

  const handleExecuteImport = (mode: 'new' | 'replace') => {
    if (!parsed) return;

    if (parsed.type === 'calculator_account') {
      if (onImportCalcAccount) {
        onImportCalcAccount(parsed.payload, mode);
        onClose();
      } else if (onImportSheet) {
        // Adapt calculator account into spreadsheet sheet if in sheets view
        const adaptedSheet: SheetSharePayload = {
          type: 'spreadsheet_sheet',
          v: 1,
          title: parsed.payload.name,
          rows: parsed.payload.rows.map((r) => ({
            concept: r.description,
            expression: r.expression,
            currency: 'USD',
          })),
          createdAt: parsed.payload.createdAt,
        };
        onImportSheet(adaptedSheet, mode);
        onClose();
      }
    } else if (parsed.type === 'spreadsheet_sheet') {
      if (onImportSheet) {
        onImportSheet(parsed.payload, mode);
        onClose();
      } else if (onImportCalcAccount) {
        // Adapt spreadsheet sheet into calculator account if in calculator view
        const adaptedCalc: CalcSharePayload = {
          type: 'calculator_account',
          v: 1,
          name: parsed.payload.title,
          rows: parsed.payload.rows.map((r) => ({
            description: r.concept,
            expression: r.expression,
          })),
          createdAt: parsed.payload.createdAt,
        };
        onImportCalcAccount(adaptedCalc, mode);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in select-none">
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col max-h-[92vh] overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Download className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Importar Información Compartida
              </h3>
              <p className="text-xs text-slate-500">
                Pega el mensaje que te enviaron para verlo exactamente igual
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          {/* Paste area */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Mensaje o texto recibido:
              </label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200 shadow-2xs active:scale-95"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Pegar del portapapeles</span>
              </button>
            </div>

            <textarea
              ref={textareaRef}
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pega aquí todo el texto recibido por WhatsApp (incluyendo el código o desglose)..."
              className="w-full p-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900 resize-none"
            />
            {pastedStatus && (
              <span className="text-[11px] font-semibold text-emerald-600">
                {pastedStatus}
              </span>
            )}
          </div>

          {/* Detection Status Preview */}
          {parsed ? (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 sm:p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    {parsed.type === 'calculator_account' ? (
                      <Calculator className="w-4 h-4" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                  </span>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                      {parsed.type === 'calculator_account'
                        ? 'Cuenta de Calculadora detectada'
                        : 'Hoja de Cuentas detectada'}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900">
                      «{parsed.type === 'calculator_account' ? parsed.payload.name : parsed.payload.title}»
                    </h4>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold bg-white text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  {parsed.payload.rows.length} {parsed.payload.rows.length === 1 ? 'fila' : 'filas'}
                </span>
              </div>

              {/* Rows Mini-preview */}
              <div className="bg-white rounded-lg border border-emerald-200/80 max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs">
                {parsed.payload.rows.map((r: any, idx: number) => {
                  const desc = r.description || r.concept || 'Sin descripción';
                  const expr = r.expression || '0';
                  return (
                    <div key={idx} className="px-3 py-1.5 flex items-center justify-between gap-2">
                      <span className="text-slate-400 font-mono w-5 shrink-0 text-center font-bold">
                        {idx + 1}.
                      </span>
                      <span className="text-slate-700 truncate flex-1 font-medium">
                        {desc}
                      </span>
                      <span className="text-indigo-700 font-mono font-bold shrink-0 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {expr}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : inputText.trim().length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No se reconocieron datos válidos en el texto.</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Asegúrate de copiar el mensaje completo generado con el botón «Compartir» de la app o filas con formato «1. 100 [Concepto]».
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-500 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Copia el mensaje de WhatsApp que te compartieron y pulsa el botón de arriba para detectarlo automáticamente.
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {parsed && (
            <>
              <button
                type="button"
                onClick={() => handleExecuteImport('replace')}
                className="px-3 py-2 rounded-xl border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-bold transition-colors cursor-pointer"
                title="Reemplaza las filas de la cuenta u hoja actual"
              >
                Reemplazar en actual
              </button>

              <button
                type="button"
                onClick={() => handleExecuteImport('new')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
                title="Crea una nueva pestaña con los datos importados"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Importar como nueva</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
