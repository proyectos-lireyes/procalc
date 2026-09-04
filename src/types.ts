export type Currency = 'USD' | 'EUR' | 'USDT' | 'VES';

export interface CurrencyRateInfo {
  code: Currency;
  name: string;
  symbol: string;
  rateToVES: number; // How many VES is 1 unit of this currency
  sourceName: string;
  lastUpdated: string;
  change24h?: number;
}

export type RatesState = Record<Currency, CurrencyRateInfo>;

export interface VariableItem {
  id: string;
  name: string;
  expression: string;
  value: number;
  description: string;
}

export interface SheetRow {
  id: string;
  concept: string;
  expression: string; // e.g., "80", "+95", "-20", "50 * (1 + iva)"
  currency: Currency;
  payer?: string; // person who paid
  participants?: string[]; // who shares this expense (empty = all)
  note?: string;
}

export interface Sheet {
  id: string;
  title: string;
  description?: string;
  isTricountActive?: boolean; // Whether tricount shared expenses is enabled for this account
  members?: string[]; // names of participants in this sheet
  rows: SheetRow[];
  variables: VariableItem[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  displayCurrency: Currency;
  paymentCurrency: Currency;
  decimals: number;
  useCustomRates: boolean;
  customRates: Record<Currency, number>;
  autoRefresh: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  sheetTitle: string;
  action: string;
  summaryInCurrencies: Record<Currency, number>;
  rowsCount: number;
}

export interface ComputedRow {
  id: string;
  concept: string;
  expression: string;
  currency: Currency;
  payer?: string;
  participants?: string[];
  evaluatedValue: number; // Value in original currency (can be positive or negative)
  isExpense: boolean;
  isValid: boolean;
  errorMessage?: string;
  equivalents: Record<Currency, number>; // value converted to each currency
}

export interface ComputedSheetTotals {
  netByCurrency: Record<Currency, number>;
  incomesByCurrency: Record<Currency, number>;
  expensesByCurrency: Record<Currency, number>;
  validRowsCount: number;
  hasErrors: boolean;
}
