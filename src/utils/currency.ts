import { Currency, CurrencyRateInfo, RatesState } from '../types';

export const CURRENCY_CONFIG: Record<
  Currency,
  {
    code: Currency;
    name: string;
    symbol: string;
    prefix: string;
    description: string;
    badgeColor: string;
    textColor: string;
    borderColor: string;
    accentBg: string;
    flag: string;
  }
> = {
  USD: {
    code: 'USD',
    name: '$',
    symbol: '$',
    prefix: '$ ',
    description: 'Dólares ($)',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500',
    accentBg: 'bg-blue-600',
    flag: '💵',
  },
  EUR: {
    code: 'EUR',
    name: 'EUR',
    symbol: '€',
    prefix: '€ ',
    description: 'Euros (EUR)',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-500',
    accentBg: 'bg-emerald-600',
    flag: '💶',
  },
  USDT: {
    code: 'USDT',
    name: 'USDT',
    symbol: 'USDT',
    prefix: 'USDT ',
    description: 'Tether (USDT)',
    badgeColor: 'bg-orange-100 text-orange-700 border-orange-200',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-500',
    accentBg: 'bg-orange-500',
    flag: '🪙',
  },
  VES: {
    code: 'VES',
    name: 'Bs',
    symbol: 'Bs',
    prefix: 'Bs ',
    description: 'Bolívares (Bs)',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    textColor: 'text-slate-800',
    borderColor: 'border-slate-500',
    accentBg: 'bg-slate-800',
    flag: '🇻🇪',
  },
};

export const ALL_CURRENCIES: Currency[] = ['USD', 'EUR', 'USDT', 'VES'];

export const DEFAULT_RATES: RatesState = {
  USD: {
    code: 'USD',
    name: '$',
    symbol: '$',
    rateToVES: 804.81,
    sourceName: 'BCV Oficial',
    lastUpdated: new Date().toISOString(),
  },
  EUR: {
    code: 'EUR',
    name: 'EUR',
    symbol: 'EUR',
    rateToVES: 932.81,
    sourceName: 'BCV Oficial',
    lastUpdated: new Date().toISOString(),
  },
  USDT: {
    code: 'USDT',
    name: 'USDT',
    symbol: 'USDT',
    rateToVES: 960.34,
    sourceName: 'Paralelo / Cripto',
    lastUpdated: new Date().toISOString(),
  },
  VES: {
    code: 'VES',
    name: 'Bs',
    symbol: 'Bs',
    rateToVES: 1.0,
    sourceName: 'Base',
    lastUpdated: new Date().toISOString(),
  },
};

/**
 * Converts any amount in given currency to VES (Bolívares)
 */
export function convertToVES(
  amount: number,
  currency: Currency,
  rates: RatesState
): number {
  if (currency === 'VES') return amount;
  const rate = rates[currency]?.rateToVES || 1;
  return amount * rate;
}

/**
 * Converts an amount in VES to target currency
 */
export function convertFromVES(
  amountVES: number,
  toCurrency: Currency,
  rates: RatesState
): number {
  if (toCurrency === 'VES') return amountVES;
  const rate = rates[toCurrency]?.rateToVES || 1;
  if (rate === 0) return 0;
  return amountVES / rate;
}

/**
 * Converts an amount from source currency to target currency
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rates: RatesState
): number {
  if (fromCurrency === toCurrency) return amount;
  const inVES = convertToVES(amount, fromCurrency, rates);
  return convertFromVES(inVES, toCurrency, rates);
}

/**
 * Formats a currency number according to Spanish / Venezuelan standard (dot for thousands, comma for decimals)
 */
export function formatCurrency(
  amount: number,
  currency: Currency,
  decimals: number = 2
): string {
  if (isNaN(amount) || !isFinite(amount)) return '0.00';
  
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const formattedNumber = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(absAmount);

  const prefix = isNegative ? '-' : '';
  const config = CURRENCY_CONFIG[currency];

  if (currency === 'VES') {
    return `${prefix}Bs ${formattedNumber}`;
  } else if (currency === 'EUR') {
    return `${prefix}EUR ${formattedNumber}`;
  } else if (currency === 'USD') {
    return `${prefix}$ ${formattedNumber}`;
  } else if (currency === 'USDT') {
    return `${prefix}USDT ${formattedNumber}`;
  }

  return `${prefix}${config.name} ${formattedNumber}`;
}

/**
 * Formats a raw number without symbols
 */
export function formatNumber(amount: number, decimals: number = 2): string {
  if (isNaN(amount) || !isFinite(amount)) return '0,00';
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
