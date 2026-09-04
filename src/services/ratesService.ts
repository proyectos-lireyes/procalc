import { RatesState, Currency } from '../types';
import { DEFAULT_RATES } from '../utils/currency';

const STORAGE_KEY = 'multicurrency_rates_cache_v2';
const LAST_FETCH_KEY = 'multicurrency_last_fetch_v2';

interface DolarApiResponseItem {
  moneda: string;
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

export interface FetchRatesResult {
  rates: RatesState;
  isOffline: boolean;
  isCached: boolean;
  lastUpdated: string;
  error?: string;
}

/**
 * Load cached rates from localStorage or fall back to default rates
 */
export function getStoredRates(): RatesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.USD && parsed.EUR && parsed.USDT && parsed.VES) {
        return parsed as RatesState;
      }
    }
  } catch (e) {
    console.error('Error reading rates from localStorage', e);
  }
  return DEFAULT_RATES;
}

/**
 * Save rates to localStorage
 */
export function saveRatesToStorage(rates: RatesState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
    localStorage.setItem(LAST_FETCH_KEY, new Date().toISOString());
  } catch (e) {
    console.error('Error saving rates to localStorage', e);
  }
}

/**
 * Fetch live rates from DolarAPI
 * User specification:
 * https://ve.dolarapi.com/v1/dolares:
 *   - "moneda": "USD", "fuente": "oficial" -> USD ($)
 *   - "moneda": "USD", "fuente": "paralelo" -> USDT
 * https://ve.dolarapi.com/v1/euros:
 *   - "moneda": "EUR", "fuente": "oficial" -> EUR (€)
 */
export async function fetchLiveRates(): Promise<FetchRatesResult> {
  const cached = getStoredRates();
  
  if (!navigator.onLine) {
    return {
      rates: cached,
      isOffline: true,
      isCached: true,
      lastUpdated: cached.USD.lastUpdated || new Date().toISOString(),
      error: 'Sin conexión a internet. Mostrando tasas guardadas en modo offline.',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const [dolaresRes, eurosRes] = await Promise.all([
      fetch('https://ve.dolarapi.com/v1/dolares', { signal: controller.signal }),
      fetch('https://ve.dolarapi.com/v1/euros', { signal: controller.signal }),
    ]);

    clearTimeout(timeoutId);

    if (!dolaresRes.ok || !eurosRes.ok) {
      throw new Error(`Error en API: dolares(${dolaresRes.status}), euros(${eurosRes.status})`);
    }

    const dolaresData: DolarApiResponseItem[] = await dolaresRes.json();
    const eurosData: DolarApiResponseItem[] = await eurosRes.json();

    // 1. USD: moneda === "USD" && fuente === "oficial"
    const usdOfficial = dolaresData.find(
      (item) => item.moneda === 'USD' && item.fuente === 'oficial'
    );
    // 2. USDT: moneda === "USD" && fuente === "paralelo"
    const usdtParalelo = dolaresData.find(
      (item) => item.moneda === 'USD' && item.fuente === 'paralelo'
    );
    // 3. EUR: moneda === "EUR" && fuente === "oficial"
    const eurOfficial = eurosData.find(
      (item) => item.moneda === 'EUR' && item.fuente === 'oficial'
    );

    const nowIso = new Date().toISOString();

    const newRates: RatesState = {
      USD: {
        code: 'USD',
        name: 'Dólar Oficial (BCV)',
        symbol: '$',
        rateToVES: usdOfficial?.promedio ?? cached.USD.rateToVES,
        sourceName: 'BCV Oficial',
        lastUpdated: usdOfficial?.fechaActualizacion ?? nowIso,
      },
      USDT: {
        code: 'USDT',
        name: 'Dólar Paralelo / USDT',
        symbol: '₮',
        rateToVES: usdtParalelo?.promedio ?? cached.USDT.rateToVES,
        sourceName: 'Mercado Paralelo',
        lastUpdated: usdtParalelo?.fechaActualizacion ?? nowIso,
      },
      EUR: {
        code: 'EUR',
        name: 'Euro Oficial (BCV)',
        symbol: '€',
        rateToVES: eurOfficial?.promedio ?? cached.EUR.rateToVES,
        sourceName: 'BCV Oficial',
        lastUpdated: eurOfficial?.fechaActualizacion ?? nowIso,
      },
      VES: {
        code: 'VES',
        name: 'Bolívares (Bs.)',
        symbol: 'Bs.',
        rateToVES: 1.0,
        sourceName: 'Moneda Base',
        lastUpdated: nowIso,
      },
    };

    saveRatesToStorage(newRates);

    return {
      rates: newRates,
      isOffline: false,
      isCached: false,
      lastUpdated: nowIso,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'No se pudo conectar a la API de tasas.';
    console.warn('Fallo al consultar DolarAPI, usando caché local:', errorMsg);

    return {
      rates: cached,
      isOffline: !navigator.onLine,
      isCached: true,
      lastUpdated: cached.USD.lastUpdated || new Date().toISOString(),
      error: `Usando tasas guardadas sin conexión (${errorMsg})`,
    };
  }
}
