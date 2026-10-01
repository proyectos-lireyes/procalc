import { Sheet, Currency, TricountMode, TricountPrepaidConfig } from '../types';
import { TapeRow } from '../components/TapeCalculatorModal';

export interface CalcSharePayload {
  type: 'calculator_account';
  v: 1;
  name: string;
  rows: Array<{
    description: string;
    expression: string;
  }>;
  createdAt?: number;
}

export interface SheetSharePayload {
  type: 'spreadsheet_sheet';
  v: 1;
  title: string;
  rows: Array<{
    concept: string;
    expression: string;
    currency: Currency;
    payer?: string;
  }>;
  members?: string[];
  isTricountActive?: boolean;
  tricountMode?: TricountMode;
  prepaidConfig?: TricountPrepaidConfig;
  settledTransfers?: Record<string, boolean>;
  settledDebtors?: Record<string, boolean>;
  partialSettlements?: Record<string, number>;
  createdAt?: number;
}

export type ParsedShareData =
  | { type: 'calculator_account'; payload: CalcSharePayload }
  | { type: 'spreadsheet_sheet'; payload: SheetSharePayload };

export function safeBtoa(str: string): string {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
  } catch (e) {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

export function safeAtob(b64: string): string {
  try {
    return decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (e) {
    return decodeURIComponent(escape(atob(b64)));
  }
}

/**
 * Encodes a tape calculator account into a compact share tag [CALC_DATA:v1:...]
 */
export function encodeCalcAccountShare(name: string, rows: TapeRow[]): string {
  const payload: CalcSharePayload = {
    type: 'calculator_account',
    v: 1,
    name: name.trim() || 'Cuenta',
    rows: rows.map((r) => ({
      description: r.description || '',
      expression: r.expression || '',
    })),
    createdAt: Date.now(),
  };

  const json = JSON.stringify(payload);
  const base64 = safeBtoa(json);
  return `[CALC_DATA:v1:${base64}]`;
}

/**
 * Returns raw base64 string for calculator account
 */
export function getCalcAccountBase64(name: string, rows: TapeRow[]): string {
  const payload: CalcSharePayload = {
    type: 'calculator_account',
    v: 1,
    name: name.trim() || 'Cuenta',
    rows: rows.map((r) => ({
      description: r.description || '',
      expression: r.expression || '',
    })),
    createdAt: Date.now(),
  };

  return safeBtoa(JSON.stringify(payload));
}

/**
 * Encodes a spreadsheet sheet into a compact share tag [SHEET_DATA:v1:...]
 */
export function encodeSheetShare(sheet: Sheet): string {
  const payload: SheetSharePayload = {
    type: 'spreadsheet_sheet',
    v: 1,
    title: sheet.title.trim() || 'Cuenta',
    rows: sheet.rows.map((r) => ({
      concept: r.concept || '',
      expression: r.expression || '0',
      currency: r.currency || 'USD',
      payer: r.payer,
    })),
    members: sheet.members,
    isTricountActive: sheet.isTricountActive,
    tricountMode: sheet.tricountMode,
    prepaidConfig: sheet.prepaidConfig,
    settledTransfers: sheet.settledTransfers,
    settledDebtors: sheet.settledDebtors,
    partialSettlements: sheet.partialSettlements,
    createdAt: sheet.createdAt || Date.now(),
  };

  const json = JSON.stringify(payload);
  const base64 = safeBtoa(json);
  return `[SHEET_DATA:v1:${base64}]`;
}

/**
 * Returns raw base64 string for spreadsheet sheet
 */
export function getSheetBase64(sheet: Sheet): string {
  const payload: SheetSharePayload = {
    type: 'spreadsheet_sheet',
    v: 1,
    title: sheet.title.trim() || 'Cuenta',
    rows: sheet.rows.map((r) => ({
      concept: r.concept || '',
      expression: r.expression || '0',
      currency: r.currency || 'USD',
      payer: r.payer,
    })),
    members: sheet.members,
    isTricountActive: sheet.isTricountActive,
    tricountMode: sheet.tricountMode,
    prepaidConfig: sheet.prepaidConfig,
    settledTransfers: sheet.settledTransfers,
    settledDebtors: sheet.settledDebtors,
    partialSettlements: sheet.partialSettlements,
    createdAt: sheet.createdAt || Date.now(),
  };

  return safeBtoa(JSON.stringify(payload));
}

/**
 * Decodes pasted text or clipboard content into either a calculator account or sheet
 * Supports:
 * - [CALC_DATA:v1:...]
 * - [SHEET_DATA:v1:...]
 * - Raw Base64 string
 * - Raw JSON string
 * - Formatted text lines
 */
export function parseSharedText(rawText: string): ParsedShareData | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const trimmed = rawText.trim();

  // 1. Try JSON parsing directly
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      if (data.type === 'calculator_account' || (data.account && Array.isArray(data.account.rows))) {
        const rows = data.rows || data.account.rows;
        return {
          type: 'calculator_account',
          payload: {
            type: 'calculator_account',
            v: 1,
            name: data.name || data.account?.name || 'Cuenta Importada',
            rows: rows.map((r: any) => ({
              description: String(r.description || ''),
              expression: String(r.expression || ''),
            })),
            createdAt: data.createdAt || Date.now(),
          },
        };
      }
      if (data.type === 'spreadsheet_sheet' || data.type === 'sheet_export' || (data.sheet && Array.isArray(data.sheet.rows))) {
        const sheetObj = data.sheet || data;
        return {
          type: 'spreadsheet_sheet',
          payload: {
            type: 'spreadsheet_sheet',
            v: 1,
            title: sheetObj.title || 'Cuenta Importada',
            rows: (sheetObj.rows || []).map((r: any) => ({
              concept: String(r.concept || ''),
              expression: String(r.expression || '0'),
              currency: (['USD', 'VES', 'EUR', 'USDT'].includes(r.currency) ? r.currency : 'USD') as Currency,
              payer: r.payer ? String(r.payer) : undefined,
            })),
            members: Array.isArray(sheetObj.members) ? sheetObj.members.map(String) : undefined,
            isTricountActive: Boolean(sheetObj.isTricountActive),
            tricountMode: sheetObj.tricountMode,
            prepaidConfig: sheetObj.prepaidConfig,
            settledTransfers: sheetObj.settledTransfers,
            settledDebtors: sheetObj.settledDebtors,
            partialSettlements: sheetObj.partialSettlements,
            createdAt: sheetObj.createdAt || Date.now(),
          },
        };
      }
    } catch {
      // Not pure JSON, continue
    }
  }

  // 2. Try finding [CALC_DATA:v1:...]
  const calcMatch = trimmed.match(/\[CALC_DATA:v1:([A-Za-z0-9+/=_-]+)\]/);
  if (calcMatch && calcMatch[1]) {
    try {
      const json = safeAtob(calcMatch[1]);
      const data = JSON.parse(json);
      if (data && Array.isArray(data.rows)) {
        return {
          type: 'calculator_account',
          payload: {
            type: 'calculator_account',
            v: 1,
            name: data.name || 'Cuenta Importada',
            rows: data.rows.map((r: any) => ({
              description: String(r.description || ''),
              expression: String(r.expression || ''),
            })),
            createdAt: data.createdAt || Date.now(),
          },
        };
      }
    } catch (e) {
      console.error('Error decoding CALC_DATA', e);
    }
  }

  // 3. Try finding [SHEET_DATA:v1:...]
  const sheetMatch = trimmed.match(/\[SHEET_DATA:v1:([A-Za-z0-9+/=_-]+)\]/);
  if (sheetMatch && sheetMatch[1]) {
    try {
      const json = safeAtob(sheetMatch[1]);
      const data = JSON.parse(json);
      if (data && Array.isArray(data.rows)) {
        return {
          type: 'spreadsheet_sheet',
          payload: {
            type: 'spreadsheet_sheet',
            v: 1,
            title: data.title || 'Cuenta Importada',
            rows: data.rows.map((r: any) => ({
              concept: String(r.concept || ''),
              expression: String(r.expression || '0'),
              currency: (['USD', 'VES', 'EUR', 'USDT'].includes(r.currency) ? r.currency : 'USD') as Currency,
              payer: r.payer ? String(r.payer) : undefined,
            })),
            members: Array.isArray(data.members) ? data.members.map(String) : undefined,
            isTricountActive: Boolean(data.isTricountActive),
            tricountMode: data.tricountMode,
            prepaidConfig: data.prepaidConfig,
            settledTransfers: data.settledTransfers,
            settledDebtors: data.settledDebtors,
            partialSettlements: data.partialSettlements,
            createdAt: data.createdAt || Date.now(),
          },
        };
      }
    } catch (e) {
      console.error('Error decoding SHEET_DATA', e);
    }
  }

  // 4. Try raw Base64 without tags
  if (/^[A-Za-z0-9+/=_-]{20,}$/.test(trimmed)) {
    try {
      const json = safeAtob(trimmed);
      if (json.startsWith('{') && json.endsWith('}')) {
        const data = JSON.parse(json);
        if (data.type === 'calculator_account' || Array.isArray(data.rows)) {
          return {
            type: 'calculator_account',
            payload: {
              type: 'calculator_account',
              v: 1,
              name: data.name || 'Cuenta Importada',
              rows: (data.rows || []).map((r: any) => ({
                description: String(r.description || ''),
                expression: String(r.expression || ''),
              })),
              createdAt: data.createdAt || Date.now(),
            },
          };
        }
        if (data.type === 'spreadsheet_sheet') {
          return {
            type: 'spreadsheet_sheet',
            payload: {
              type: 'spreadsheet_sheet',
              v: 1,
              title: data.title || 'Cuenta Importada',
              rows: (data.rows || []).map((r: any) => ({
                concept: String(r.concept || ''),
                expression: String(r.expression || '0'),
                currency: (['USD', 'VES', 'EUR', 'USDT'].includes(r.currency) ? r.currency : 'USD') as Currency,
                payer: r.payer ? String(r.payer) : undefined,
              })),
              members: Array.isArray(data.members) ? data.members.map(String) : undefined,
              isTricountActive: Boolean(data.isTricountActive),
              tricountMode: data.tricountMode,
              prepaidConfig: data.prepaidConfig,
              settledTransfers: data.settledTransfers,
              settledDebtors: data.settledDebtors,
              partialSettlements: data.partialSettlements,
              createdAt: data.createdAt || Date.now(),
            },
          };
        }
      }
    } catch {
      // Not valid base64 json
    }
  }

  // 5. Fallback: Parse plain text lines
  const lines = trimmed.split('\n');
  const extractedRows: Array<{ description: string; expression: string }> = [];
  let detectedTitle = '';

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;

    const titleMatch = l.match(/(?:CALCULADORA|REPORTE)\s+DE\s+CUENTA:\s*([^\n*]+)/i);
    if (titleMatch && titleMatch[1]) {
      detectedTitle = titleMatch[1].replace(/[*_#]/g, '').trim();
    }

    const rowMatch = l.match(/^(?:\d+[\.\)]|\-|\*|•)?\s*([0-9\+\-\*\/\.\,\s\^\%\(\)]+?)(?:\s*\[([^\]]+)\]|\s*\(([^\)]+)\))?(?:\s*=\s*[\d\.\,]+)?$/);
    if (rowMatch) {
      const expr = rowMatch[1]?.trim();
      const desc = (rowMatch[2] || rowMatch[3] || '').trim();
      if (expr && (/\d/.test(expr) || /[+\-*/]/.test(expr))) {
        extractedRows.push({
          description: desc,
          expression: expr,
        });
      }
    }
  }

  if (extractedRows.length > 0) {
    return {
      type: 'calculator_account',
      payload: {
        type: 'calculator_account',
        v: 1,
        name: detectedTitle || 'Cuenta Importada',
        rows: extractedRows,
        createdAt: Date.now(),
      },
    };
  }

  return null;
}
