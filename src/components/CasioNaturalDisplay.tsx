import React, { useEffect, useRef } from 'react';
import { MathNode, CursorPosition, getExactFraction } from '../utils/naturalMathAST';

export type ResultDisplayFormat = 'auto' | 'fraction' | 'decimal' | 'mixed';

interface CasioNaturalDisplayProps {
  nodes: MathNode[];
  cursor: CursorPosition;
  onSlotClick: (slotId: string, index: number) => void;
  // Status flags
  isShiftActive: boolean;
  isAlphaActive: boolean;
  isMemoryActive: boolean;
  isStoActive: boolean;
  angleUnit: 'deg' | 'rad' | 'gra';
  hasHistory: boolean;
  onToggleAngleUnit?: () => void;
  onOpenHistory?: () => void;
  // Result
  evaluatedValue: number | null;
  errorMessage?: string;
  resultFormat: ResultDisplayFormat;
}

export const CasioNaturalDisplay: React.FC<CasioNaturalDisplayProps> = ({
  nodes,
  cursor,
  onSlotClick,
  isShiftActive,
  isAlphaActive,
  isMemoryActive,
  isStoActive,
  angleUnit,
  hasHistory,
  onToggleAngleUnit,
  onOpenHistory,
  evaluatedValue,
  errorMessage,
  resultFormat,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll expression into view as user types
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [nodes, cursor]);

  // Modern crisp cursor
  const renderCursor = () => (
    <span className="inline-block w-[2px] h-[1.25em] bg-indigo-600 mx-[0.5px] animate-pulse align-middle" />
  );

  // Dotted placeholder slot box
  const renderEmptySlot = (slotId: string, isSlotActive: boolean) => (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onSlotClick(slotId, 0);
      }}
      className={`inline-flex items-center justify-center min-w-[14px] h-[18px] px-1 border border-dashed rounded-xs cursor-pointer align-middle transition-all ${
        isSlotActive
          ? 'border-indigo-600 bg-indigo-50/80 shadow-2xs ring-1 ring-indigo-500/30'
          : 'border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30'
      }`}
    >
      {isSlotActive && renderCursor()}
    </span>
  );

  // Recursive Slot Renderer
  const renderSlotList = (list: MathNode[], slotId: string): React.ReactNode => {
    const isCurrentSlot = cursor.slotId === slotId;

    if (list.length === 0) {
      return renderEmptySlot(slotId, isCurrentSlot);
    }

    return (
      <span
        className="inline-flex items-center flex-wrap cursor-text"
        onClick={(e) => {
          e.stopPropagation();
          onSlotClick(slotId, list.length);
        }}
      >
        {list.map((node, idx) => {
          const showCursorBefore = isCurrentSlot && cursor.index === idx;

          let nodeContent: React.ReactNode = null;

          if (node.type === 'char') {
            nodeContent = (
              <span
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSlotClick(slotId, idx + 1);
                }}
                className={`font-mono text-base font-bold text-slate-900 select-none ${
                  node.value === ' ' ? 'w-2 inline-block' : ''
                }`}
              >
                {node.value}
              </span>
            );
          } else if (node.type === 'fraction') {
            // Real 2-story fraction with horizontal bar
            nodeContent = (
              <span
                key={node.id}
                className="inline-flex flex-col items-center justify-center mx-1 my-0.5 align-middle"
              >
                {/* Numerator */}
                <span className="px-1 text-xs sm:text-sm font-mono font-bold flex items-center justify-center text-slate-900">
                  {renderSlotList(node.num, `${node.id}:num`)}
                </span>
                {/* Fraction Line */}
                <span className="w-full h-[1.5px] bg-slate-800 my-[2px] block rounded-full" />
                {/* Denominator */}
                <span className="px-1 text-xs sm:text-sm font-mono font-bold flex items-center justify-center text-slate-900">
                  {renderSlotList(node.den, `${node.id}:den`)}
                </span>
              </span>
            );
          } else if (node.type === 'mixed_fraction') {
            // Whole number followed by 2-story fraction
            nodeContent = (
              <span key={node.id} className="inline-flex items-center mx-1 align-middle">
                <span className="text-sm sm:text-base font-mono font-bold mr-1 text-slate-900">
                  {renderSlotList(node.whole, `${node.id}:whole`)}
                </span>
                <span className="inline-flex flex-col items-center justify-center">
                  <span className="px-1 text-xs sm:text-sm font-mono font-bold text-slate-900">
                    {renderSlotList(node.num, `${node.id}:num`)}
                  </span>
                  <span className="w-full h-[1.5px] bg-slate-800 my-[2px] block rounded-full" />
                  <span className="px-1 text-xs sm:text-sm font-mono font-bold text-slate-900">
                    {renderSlotList(node.den, `${node.id}:den`)}
                  </span>
                </span>
              </span>
            );
          } else if (node.type === 'sqrt') {
            // Square Root with radical and horizontal overbar
            nodeContent = (
              <span key={node.id} className="inline-flex items-center mx-1 align-middle text-slate-900">
                <span className="text-lg sm:text-xl font-serif font-bold leading-none select-none text-slate-800">
                  √
                </span>
                <span className="border-t-[2px] border-slate-800 pt-[1px] px-1 inline-flex items-center">
                  {renderSlotList(node.inner, `${node.id}:inner`)}
                </span>
              </span>
            );
          } else if (node.type === 'nth_root') {
            // Nth root
            nodeContent = (
              <span key={node.id} className="inline-flex items-center mx-1 align-middle text-slate-900">
                <sup className="text-[10px] font-mono font-bold -mr-0.5 self-start text-slate-700">
                  {renderSlotList(node.root, `${node.id}:root`)}
                </sup>
                <span className="text-lg sm:text-xl font-serif font-bold leading-none select-none text-slate-800">
                  √
                </span>
                <span className="border-t-[2px] border-slate-800 pt-[1px] px-1 inline-flex items-center">
                  {renderSlotList(node.inner, `${node.id}:inner`)}
                </span>
              </span>
            );
          } else if (node.type === 'power') {
            // Superscript exponent
            nodeContent = (
              <sup
                key={node.id}
                className="text-[10px] sm:text-xs font-mono font-bold -translate-y-1.5 inline-flex items-center mx-0.5 text-slate-800"
              >
                {renderSlotList(node.exp, `${node.id}:exp`)}
              </sup>
            );
          } else if (node.type === 'integral') {
            // Integral: Clean representation where limits are sub/superscripts on the ∫ symbol,
            // and the integrand expression is in clean parentheses with dx. NO DIVISION!
            const showLimits = node.upper.length > 0 || node.lower.length > 0 || cursor.slotId.includes(`${node.id}:`);

            nodeContent = (
              <span key={node.id} className="inline-flex items-center mx-1.5 align-middle">
                {/* Integral symbol with upper/lower limits on its right notches */}
                <span className="relative inline-flex flex-col items-center justify-between h-[38px] py-0.5 select-none">
                  {/* Upper limit */}
                  <span className="text-[10px] font-mono font-bold leading-none self-end pl-0.5 min-w-[8px] text-slate-700">
                    {renderSlotList(node.upper, `${node.id}:upper`)}
                  </span>
                  {/* Large integral glyph */}
                  <span className="text-2xl font-serif font-black select-none leading-none -my-1 text-slate-800">
                    ∫
                  </span>
                  {/* Lower limit */}
                  <span className="text-[10px] font-mono font-bold leading-none self-end pl-0.5 min-w-[8px] text-slate-700">
                    {renderSlotList(node.lower, `${node.id}:lower`)}
                  </span>
                </span>

                {/* Integrand expression: clean slot in parentheses followed by dx */}
                <span className="inline-flex items-center ml-1">
                  <span className="font-mono text-slate-400 select-none text-base font-bold">(</span>
                  <span className="px-0.5">{renderSlotList(node.expr, `${node.id}:expr`)}</span>
                  <span className="font-mono text-slate-400 select-none text-base font-bold">)</span>
                  <span className="ml-1 font-mono text-xs font-bold text-indigo-700 select-none">dx</span>
                </span>
              </span>
            );
          } else if (node.type === 'derivative') {
            // Derivative: Clean representation. An operator prefix d/dx followed by expression brackets.
            // NO FRACTION OR DIVISION IN THE EXPRESSION!
            nodeContent = (
              <span key={node.id} className="inline-flex items-center mx-1.5 align-middle">
                {/* Operator symbol badge */}
                <span className="inline-flex flex-col items-center justify-center mr-1 select-none">
                  <span className="text-[11px] font-mono font-black text-indigo-700 leading-none">d</span>
                  <span className="w-3.5 h-[1.5px] bg-indigo-700 my-[1px] block rounded-full" />
                  <span className="text-[11px] font-mono font-black text-indigo-700 leading-none">dx</span>
                </span>

                {/* Target Expression inside clean brackets */}
                <span className="font-mono text-slate-400 font-bold select-none text-base">[</span>
                <span className="px-0.5">{renderSlotList(node.expr, `${node.id}:expr`)}</span>
                <span className="font-mono text-slate-400 font-bold select-none text-base">]</span>

                {/* Evaluated at x = x0 */}
                <span className="font-mono text-xs font-bold text-slate-500 select-none ml-1.5 mr-0.5">
                  |x=
                </span>
                <span className="min-w-[12px]">{renderSlotList(node.at, `${node.id}:at`)}</span>
              </span>
            );
          } else if (node.type === 'summation') {
            nodeContent = (
              <span key={node.id} className="inline-flex items-center mx-1 align-middle">
                <span className="inline-flex flex-col items-center">
                  <span className="text-[10px] font-mono font-bold text-slate-700">
                    {renderSlotList(node.end, `${node.id}:end`)}
                  </span>
                  <span className="text-xl font-serif font-bold select-none leading-tight text-slate-800">Σ</span>
                  <span className="text-[10px] font-mono font-bold text-slate-700 flex items-center">
                    x={renderSlotList(node.start, `${node.id}:start`)}
                  </span>
                </span>
                <span className="inline-flex items-center ml-1">
                  <span className="font-mono text-slate-400 font-bold text-sm">(</span>
                  {renderSlotList(node.expr, `${node.id}:expr`)}
                  <span className="font-mono text-slate-400 font-bold text-sm">)</span>
                </span>
              </span>
            );
          } else if (node.type === 'log_base') {
            nodeContent = (
              <span key={node.id} className="inline-flex items-center mx-0.5 align-middle text-xs font-mono font-bold">
                <span className="select-none text-slate-700">log</span>
                <sub className="text-[10px] -translate-y-0.5 text-slate-600">
                  {renderSlotList(node.base, `${node.id}:base`)}
                </sub>
                <span className="select-none text-slate-400 mx-0.5">(</span>
                {renderSlotList(node.arg, `${node.id}:arg`)}
                <span className="select-none text-slate-400 mx-0.5">)</span>
              </span>
            );
          } else if (node.type === 'abs') {
            nodeContent = (
              <span key={node.id} className="inline-flex items-center mx-0.5 align-middle">
                <span className="font-bold select-none mx-0.5 text-slate-400">|</span>
                {renderSlotList(node.inner, `${node.id}:inner`)}
                <span className="font-bold select-none mx-0.5 text-slate-400">|</span>
              </span>
            );
          }

          return (
            <React.Fragment key={node.id}>
              {showCursorBefore && renderCursor()}
              {nodeContent}
            </React.Fragment>
          );
        })}
        {isCurrentSlot && cursor.index === list.length && renderCursor()}
      </span>
    );
  };

  // Render bottom-right result with clean typography
  const renderResult = () => {
    if (errorMessage) {
      return (
        <span className="font-mono font-bold text-xs sm:text-sm text-rose-600 tracking-wide animate-pulse">
          {errorMessage}
        </span>
      );
    }

    if (evaluatedValue === null || isNaN(evaluatedValue)) {
      return null;
    }

    // Exact fraction check
    const frac = getExactFraction(evaluatedValue);

    // Format: Fraction
    if ((resultFormat === 'fraction' || resultFormat === 'auto') && frac && frac.d > 1) {
      const isNegative = frac.n < 0;
      const absN = Math.abs(frac.n);

      return (
        <div className="inline-flex items-center justify-end font-mono font-extrabold text-base sm:text-xl text-slate-900">
          {isNegative && <span className="mr-1 text-base select-none">-</span>}
          <div className="inline-flex flex-col items-center justify-center">
            <span className="text-xs sm:text-sm px-1.5">{absN}</span>
            <span className="w-full h-[1.5px] bg-slate-900 my-[1px] block rounded-full" />
            <span className="text-xs sm:text-sm px-1.5">{frac.d}</span>
          </div>
        </div>
      );
    }

    // Format: Mixed Fraction (e.g. 1 1/4)
    if (resultFormat === 'mixed' && frac && frac.d > 1 && Math.abs(frac.n) > frac.d) {
      const isNegative = frac.n < 0;
      const whole = Math.floor(Math.abs(frac.n) / frac.d);
      const rem = Math.abs(frac.n) % frac.d;

      return (
        <div className="inline-flex items-center justify-end font-mono font-extrabold text-base sm:text-xl text-slate-900">
          {isNegative && <span className="mr-0.5 text-base select-none">-</span>}
          <span className="mr-1.5 text-sm sm:text-base">{whole}</span>
          <div className="inline-flex flex-col items-center justify-center">
            <span className="text-xs sm:text-sm px-1">{rem}</span>
            <span className="w-full h-[1.5px] bg-slate-900 my-[1px] block rounded-full" />
            <span className="text-xs sm:text-sm px-1">{frac.d}</span>
          </div>
        </div>
      );
    }

    // Format: Standard Decimal
    let formattedDecimal = '';
    if (Math.abs(evaluatedValue) < 1e-9 && Math.abs(evaluatedValue) > 0) {
      formattedDecimal = evaluatedValue.toExponential(4);
    } else if (Math.abs(evaluatedValue) >= 1e10) {
      formattedDecimal = evaluatedValue.toExponential(5);
    } else {
      formattedDecimal = Number.isInteger(evaluatedValue)
        ? evaluatedValue.toString()
        : parseFloat(evaluatedValue.toFixed(9)).toString();
    }

    return (
      <span className="font-mono font-black text-2xl sm:text-3xl md:text-4xl tracking-tight text-slate-900">
        {formattedDecimal}
      </span>
    );
  };

  return (
    <div className="relative w-full h-full flex-1 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-slate-900 flex flex-col justify-between overflow-hidden p-2 sm:p-3 select-none min-h-0">
      {/* 1. TOP STATUS INDICATOR BAR (Light, Clean Badges) */}
      <div className="flex items-center justify-between text-[11px] font-mono font-bold pb-1 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* [S] Shift Indicator */}
          {isShiftActive && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[10px] animate-fade-in shadow-2xs">
              SHIFT
            </span>
          )}

          {/* [A] Alpha Indicator */}
          {isAlphaActive && (
            <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-extrabold text-[10px] animate-fade-in shadow-2xs">
              ALPHA
            </span>
          )}

          {/* [M] Memory Indicator */}
          {isMemoryActive && (
            <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 font-extrabold text-[10px]">
              M
            </span>
          )}

          {/* [STO] Store Indicator */}
          {isStoActive && (
            <span className="px-1.5 py-0.5 rounded-md bg-cyan-100 text-cyan-800 border border-cyan-200 font-extrabold text-[10px]">
              STO
            </span>
          )}

          {/* Angle Unit: DEG / RAD / GRA (Clickable toggle) */}
          <button
            type="button"
            onClick={onToggleAngleUnit}
            className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold text-[10px] cursor-pointer transition-colors active:scale-95 shadow-2xs"
            title="Clic para cambiar entre DEG / RAD / GRA"
          >
            {angleUnit.toUpperCase()}
          </button>

          {/* Natural Math Indicator */}
          <span className="text-[10px] font-bold text-slate-400">
            Escritura Natural
          </span>
        </div>

        {/* Right Status */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
          {hasHistory ? (
            <button
              type="button"
              onClick={onOpenHistory}
              className="text-slate-500 hover:text-indigo-600 cursor-pointer flex items-center gap-1 transition-colors"
              title="Ver historial de cálculos (o mantén presionado '=')"
            >
              <span>▲▼ Historial</span>
            </button>
          ) : (
            <span className="text-slate-300">Pantalla Natural</span>
          )}
        </div>
      </div>

      {/* 2. NATURAL DISPLAY EQUATION CANVAS */}
      <div
        ref={scrollRef}
        onClick={() => onSlotClick('root', nodes.length)}
        className="flex-1 flex items-center overflow-x-auto overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-slate-200 min-h-[50px] text-base sm:text-lg md:text-xl font-mono"
      >
        <div className="flex items-center gap-0.5 whitespace-nowrap min-w-full">
          {nodes.length === 0 ? (
            <span className="text-slate-400 text-sm font-mono flex items-center gap-1">
              {renderCursor()}
              <span className="text-xs text-slate-400">0</span>
            </span>
          ) : (
            renderSlotList(nodes, 'root')
          )}
        </div>
      </div>

      {/* 3. BOTTOM-RIGHT EVALUATED RESULT AREA */}
      <div className="flex items-baseline justify-end pt-1.5 border-t border-slate-100 shrink-0">
        {renderResult()}
      </div>
    </div>
  );
};
