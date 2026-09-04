import React, { useState } from 'react';
import {
  X,
  ArrowRightLeft,
  Percent,
  Copy,
  Check,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Currency, RatesState } from '../types';
import {
  ALL_CURRENCIES,
  CURRENCY_CONFIG,
  convertCurrency,
  formatCurrency,
  formatNumber,
} from '../utils/currency';
import { evaluateExpression } from '../utils/mathEvaluator';

interface QuickConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: RatesState;
  onInsertToSheet?: (amount: string, currency: Currency) => void;
  isInline?: boolean;
}

type ConverterTab = 'direct' | 'ruleOfThree';

export const QuickConverterModal: React.FC<QuickConverterModalProps> = ({
  isOpen,
  onClose,
  rates,
  onInsertToSheet,
  isInline = false,
}) => {
  const [activeTab, setActiveTab] = useState<ConverterTab>('direct');

  // Direct Converter State
  const [inputExpr, setInputExpr] = useState<string>('100');
  const [fromCurrency, setFromCurrency] = useState<Currency>('USD');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Rule of Three State: 3 editable boxes (A, B, C) and 1 result box (X)
  const [ruleA, setRuleA] = useState<string>('100');
  const [ruleB, setRuleB] = useState<string>('20');
  const [ruleC, setRuleC] = useState<string>('250');
  const [isInverse, setIsInverse] = useState<boolean>(false);
  const [copiedRuleResult, setCopiedRuleResult] = useState(false);

  if (!isOpen) return null;

  // Direct Conversion Evaluation
  const evalResult = evaluateExpression(inputExpr);
  const amount = evalResult.isValid ? evalResult.value : 0;

  // Rule of Three Evaluation:
  // Directa: Si A -> B, entonces C -> X = (B * C) / A
  // Inversa: Si A -> B, entonces C -> X = (A * B) / C
  const evalA = evaluateExpression(ruleA);
  const evalB = evaluateExpression(ruleB);
  const evalC = evaluateExpression(ruleC);

  const valA = evalA.isValid ? evalA.value : 0;
  const valB = evalB.isValid ? evalB.value : 0;
  const valC = evalC.isValid ? evalC.value : 0;

  let ruleResult = 0;
  let isRuleValid = false;

  if (evalA.isValid && evalB.isValid && evalC.isValid) {
    if (isInverse && valC !== 0) {
      ruleResult = (valA * valB) / valC;
      isRuleValid = true;
    } else if (!isInverse && valA !== 0) {
      ruleResult = (valB * valC) / valA;
      isRuleValid = true;
    }
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isInline) {
    return (
      <div
        id="quick-converter-view"
        className="bg-white border border-slate-200 rounded-xl shadow-sm w-full max-w-2xl mx-auto flex flex-col text-slate-800 overflow-hidden min-h-[500px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <ArrowRightLeft className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Conversor y Regla de 3</h3>
              <p className="text-[11px] text-slate-500">
                Matriz multimoneda en tiempo real y cálculo proporcional
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex gap-2">
          <button
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'direct'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Conversión Directa</span>
          </button>
          <button
            onClick={() => setActiveTab('ruleOfThree')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ruleOfThree'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Regla de Tres</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'direct' ? (
            <>
              {/* Amount Input and Currency Buttons */}
              <div className="space-y-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Monto o fórmula a convertir:
                  </label>
                  <input
                    type="text"
                    value={inputExpr}
                    onChange={(e) => setInputExpr(e.target.value)}
                    placeholder="ej: 100, 50*2, (15+5)*1.16"
                    className="w-full px-3 py-2 text-base font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />
                  {!evalResult.isValid && (
                    <p className="text-[11px] text-rose-500 font-medium mt-1">Expresión inválida</p>
                  )}
                </div>

                {/* 4 Currency Selection Buttons */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Moneda de origen (toca para calcular):
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ALL_CURRENCIES.map((curr) => {
                      const isSelected = fromCurrency === curr;
                      return (
                        <button
                          key={curr}
                          type="button"
                          onClick={() => setFromCurrency(curr)}
                          className={`py-2 px-2 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 border ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs ring-2 ring-blue-300'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className="font-mono text-sm font-extrabold">{CURRENCY_CONFIG[curr].symbol}</span>
                          <span className="text-[10px] font-sans opacity-90">{curr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Conversion Matrix (All 4 Currencies) */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700">Equivalencias Calculadas</span>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_CURRENCIES.map((targetCurr) => {
                    const converted = convertCurrency(amount, fromCurrency, targetCurr, rates);
                    const isBase = targetCurr === fromCurrency;
                    const formatted = formatCurrency(converted, targetCurr, 2);

                    return (
                      <div
                        key={targetCurr}
                        className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                          isBase
                            ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400'
                            : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">
                            {CURRENCY_CONFIG[targetCurr].name} {isBase && '(Base)'}
                          </span>
                          <button
                            onClick={() => handleCopy(formatted, targetCurr)}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
                            title="Copiar monto"
                          >
                            {copiedKey === targetCurr ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <span className="text-base sm:text-lg font-mono font-bold text-slate-900 mt-1 truncate">
                          {formatted}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Rule of Three Mode */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Proporcionalidad</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-[11px]">
                    <button
                      onClick={() => setIsInverse(false)}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        !isInverse ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Directa
                    </button>
                    <button
                      onClick={() => setIsInverse(true)}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        isInverse ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Inversa
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-slate-500">Si este valor (A):</span>
                      <input
                        type="text"
                        value={ruleA}
                        onChange={(e) => setRuleA(e.target.value)}
                        className="w-full bg-white px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-4" />
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-slate-500">Corresponde a (B):</span>
                      <input
                        type="text"
                        value={ruleB}
                        onChange={(e) => setRuleB(e.target.value)}
                        className="w-full bg-white px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-slate-500">Entonces este valor (C):</span>
                      <input
                        type="text"
                        value={ruleC}
                        onChange={(e) => setRuleC(e.target.value)}
                        className="w-full bg-white px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-4" />
                    <div className="flex-1 bg-blue-50 border border-blue-200 rounded p-1.5 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-blue-900">Resultado (X):</span>
                      <span className="text-sm font-mono font-bold text-blue-900 truncate">
                        {isRuleValid ? formatNumber(ruleResult, 2) : '---'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        id="quick-converter-modal"
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col my-auto text-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <ArrowRightLeft className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Conversor y Regla de 3</h3>
              <p className="text-[11px] text-slate-500">
                Matriz 2x2 en 4 monedas y regla de tres directa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1.5 shrink-0">
          <button
            id="tab-direct-converter"
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'direct'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Conversor 4 Monedas</span>
          </button>
          <button
            id="tab-rule-of-three"
            onClick={() => setActiveTab('ruleOfThree')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ruleOfThree'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Regla de Tres</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3.5">
          {/* TAB 1: Direct 4-Currency Conversion */}
          {activeTab === 'direct' && (
            <div className="space-y-3">
              {/* Single Input for amount or formula */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Monto o fórmula:
                </label>
                <input
                  id="quick-converter-input"
                  type="text"
                  value={inputExpr}
                  onChange={(e) => setInputExpr(e.target.value)}
                  placeholder="100, 150*1.16, 250/2"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-base font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
                {!evalResult.isValid && (
                  <span className="text-[11px] text-rose-600 font-mono block">
                    {evalResult.error || 'Expresión matemática inválida'}
                  </span>
                )}
              </div>

              {/* Currency Selector Buttons: $, Bs, USDT, € */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Moneda base:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ALL_CURRENCIES.map((c) => {
                    const cfg = CURRENCY_CONFIG[c];
                    const isSel = c === fromCurrency;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFromCurrency(c)}
                        className={`py-1.5 px-2 rounded-md border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          isSel
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-mono">{cfg.symbol}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2x2 Matrix for the 4 currencies */}
              <div className="pt-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Conversión (Matriz 2x2):
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {ALL_CURRENCIES.map((curr) => {
                    const cfg = CURRENCY_CONFIG[curr];
                    const isSource = curr === fromCurrency;
                    const converted = convertCurrency(amount, fromCurrency, curr, rates);
                    const formatted = formatCurrency(converted, curr, 2);

                    return (
                      <div
                        key={curr}
                        className={`p-2.5 rounded-lg border flex flex-col justify-between transition-all ${
                          isSource
                            ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-1 font-bold text-slate-800">
                            <span>{cfg.flag}</span>
                            <span className="font-mono">{cfg.symbol}</span>
                          </span>
                          {isSource ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-200 text-blue-800 font-bold uppercase">
                              Base
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCopy(formatted, curr)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                              title="Copiar monto"
                            >
                              {copiedKey === curr ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        <div
                          className={`font-mono text-sm sm:text-base font-extrabold truncate ${
                            isSource ? 'text-blue-900' : 'text-slate-900'
                          }`}
                        >
                          {formatted}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Regla de Tres General (Proporcionalidad Directa e Inversa) */}
          {activeTab === 'ruleOfThree' && (
            <div className="space-y-3">
              {/* Type Switcher: Directa vs Inversa */}
              <div className="flex items-center justify-between bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsInverse(false)}
                  className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer text-center ${
                    !isInverse
                      ? 'bg-white text-emerald-800 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Directa (A ↑ = B ↑)
                </button>
                <button
                  type="button"
                  onClick={() => setIsInverse(true)}
                  className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer text-center ${
                    isInverse
                      ? 'bg-white text-emerald-800 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Inversa (A ↑ = B ↓)
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                {/* Fila 1: Si A es B */}
                <div className="grid grid-cols-2 gap-2.5 items-center">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Si este valor (A):
                    </label>
                    <input
                      type="text"
                      value={ruleA}
                      onChange={(e) => setRuleA(e.target.value)}
                      placeholder="100"
                      className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      equivale a (B):
                    </label>
                    <input
                      type="text"
                      value={ruleB}
                      onChange={(e) => setRuleB(e.target.value)}
                      placeholder="20"
                      className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200/70 px-2 py-0.5 rounded">
                    entonces
                  </span>
                </div>

                {/* Fila 2: Para C es Resultado X */}
                <div className="grid grid-cols-2 gap-2.5 items-center">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      para este valor (C):
                    </label>
                    <input
                      type="text"
                      value={ruleC}
                      onChange={(e) => setRuleC(e.target.value)}
                      placeholder="250"
                      className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-emerald-800 block">
                        Resultado (X):
                      </label>
                      {isRuleValid && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(ruleResult.toString());
                            setCopiedRuleResult(true);
                            setTimeout(() => setCopiedRuleResult(false), 2000);
                          }}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer"
                          title="Copiar resultado"
                        >
                          {copiedRuleResult ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedRuleResult ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      )}
                    </div>
                    <div className="w-full bg-emerald-50 border border-emerald-300 rounded-md px-2.5 py-1.5 text-sm font-mono font-extrabold text-emerald-900 truncate">
                      {isRuleValid ? formatNumber(ruleResult, 4) : '---'}
                    </div>
                  </div>
                </div>

                {/* Fórmula Explicativa */}
                <div className="text-[11px] text-slate-500 font-mono text-center pt-1 border-t border-slate-200/60">
                  {isInverse ? 'Fórmula Inversa: X = (A · B) / C' : 'Fórmula Directa: X = (B · C) / A'}
                </div>
              </div>

              {/* Botón para insertar a la fila activa si es válido */}
              {isRuleValid && onInsertToSheet && (
                <button
                  type="button"
                  onClick={() => {
                    onInsertToSheet(ruleResult.toString(), fromCurrency);
                    onClose();
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Insertar resultado ({formatNumber(ruleResult, 2)}) en la fila</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
