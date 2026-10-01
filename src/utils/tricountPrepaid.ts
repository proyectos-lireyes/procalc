import {
  Currency,
  RatesState,
  TricountPrepaidConfig,
  TricountContribution,
} from '../types';
import {
  convertCurrency,
  convertToVES,
  convertFromVES,
  formatCurrency,
  formatNumber,
} from './currency';

export interface MemberPrepaidStat {
  name: string;
  quotaInBase: number;
  quotaInTarget: number;
  collectedInBase: number;
  remainingInBase: number;
  surplusInBase: number;
  percent: number;
  isCompleted: boolean;
  contributionsCount: number;
  remainingInAllCurrencies: Record<Currency, number>;
  collectedInAllCurrencies: Record<Currency, number>;
}

export interface PrepaidTripStats {
  targetAmount: number;
  targetCurrency: Currency;
  totalTargetInBase: number;
  totalCollectedInBase: number;
  totalRemainingInBase: number;
  progressPercent: number;
  isGoalReached: boolean;
  activeMembersCount: number;
  baseCurrency: Currency;
  amountsInAllCurrencies: {
    target: Record<Currency, number>;
    collected: Record<Currency, number>;
    remaining: Record<Currency, number>;
  };
  membersStats: MemberPrepaidStat[];
  contributions: Array<
    TricountContribution & {
      amountInBase: number;
    }
  >;
}

export function resolveMemberForContribution(
  contribMember: string | undefined,
  activeMembers: string[]
): string {
  if (!activeMembers || activeMembers.length === 0) return 'Yo';
  const cClean = (contribMember || '').trim().toLowerCase();
  if (!cClean) return activeMembers[0];
  const matched = activeMembers.find((m) => m.trim().toLowerCase() === cClean);
  return matched || activeMembers[0];
}

export function createDefaultPrepaidConfig(
  targetAmount = 500,
  targetCurrency: Currency = 'USD'
): TricountPrepaidConfig {
  return {
    targetAmount,
    targetCurrency,
    customQuotas: {},
    contributions: [],
  };
}

export function calculatePrepaidTripStats(
  members: string[],
  config: TricountPrepaidConfig | undefined,
  rates: RatesState,
  baseCurrency?: Currency
): PrepaidTripStats {
  const targetAmount = config?.targetAmount ?? 500;
  const targetCurrency = config?.targetCurrency ?? 'USD';
  const effectiveBaseCurrency = baseCurrency || targetCurrency;
  const contributions = config?.contributions ?? [];
  const customQuotas = config?.customQuotas ?? {};

  const activeMembers = members.length > 0 ? members : ['Yo'];
  const memberCount = activeMembers.length;

  // Convert target to effectiveBaseCurrency
  const totalTargetInBase = convertCurrency(targetAmount, targetCurrency, effectiveBaseCurrency, rates);

  // Default equal quota in targetCurrency
  const defaultQuotaInTarget = memberCount > 0 ? targetAmount / memberCount : 0;

  // Contributions sorted latest first
  const contributionsWithBase = contributions.map((c) => ({
    ...c,
    amountInBase: convertCurrency(c.amount, c.currency, effectiveBaseCurrency, rates),
  }));

  // Aggregate collected per member
  const collectedByMember: Record<string, number> = {};
  const countByMember: Record<string, number> = {};
  activeMembers.forEach((m) => {
    collectedByMember[m] = 0;
    countByMember[m] = 0;
  });

  contributions.forEach((c) => {
    const memberName = resolveMemberForContribution(c.member, activeMembers);
    const inBase = convertCurrency(c.amount, c.currency, effectiveBaseCurrency, rates);
    collectedByMember[memberName] = (collectedByMember[memberName] || 0) + inBase;
    countByMember[memberName] = (countByMember[memberName] || 0) + 1;
  });

  // Calculate stats per member
  const membersStats: MemberPrepaidStat[] = activeMembers.map((name) => {
    const customQ = customQuotas[name];
    const quotaInTarget = typeof customQ === 'number' && customQ >= 0 ? customQ : defaultQuotaInTarget;
    const quotaInBase = convertCurrency(quotaInTarget, targetCurrency, effectiveBaseCurrency, rates);

    const collectedInBase = collectedByMember[name] || 0;
    const remainingInBase = Math.max(0, quotaInBase - collectedInBase);
    const surplusInBase = Math.max(0, collectedInBase - quotaInBase);

    const percent =
      quotaInBase > 0
        ? Math.min(100, Math.round((collectedInBase / quotaInBase) * 100))
        : collectedInBase > 0
        ? 100
        : 0;

    const isCompleted = remainingInBase <= 0.009;

    // Remaining in all 4 currencies
    const remainingInVES = convertToVES(remainingInBase, effectiveBaseCurrency, rates);
    const remainingInAllCurrencies: Record<Currency, number> = {
      USD: convertFromVES(remainingInVES, 'USD', rates),
      VES: remainingInVES,
      USDT: convertFromVES(remainingInVES, 'USDT', rates),
      EUR: convertFromVES(remainingInVES, 'EUR', rates),
    };

    // Collected in all 4 currencies
    const collectedInVES = convertToVES(collectedInBase, effectiveBaseCurrency, rates);
    const collectedInAllCurrencies: Record<Currency, number> = {
      USD: convertFromVES(collectedInVES, 'USD', rates),
      VES: collectedInVES,
      USDT: convertFromVES(collectedInVES, 'USDT', rates),
      EUR: convertFromVES(collectedInVES, 'EUR', rates),
    };

    return {
      name,
      quotaInBase,
      quotaInTarget,
      collectedInBase,
      remainingInBase,
      surplusInBase,
      percent,
      isCompleted,
      contributionsCount: countByMember[name] || 0,
      remainingInAllCurrencies,
      collectedInAllCurrencies,
    };
  });

  const totalCollectedInBase = Object.values(collectedByMember).reduce((acc, v) => acc + v, 0);
  const totalRemainingInBase = Math.max(0, totalTargetInBase - totalCollectedInBase);
  const progressPercent =
    totalTargetInBase > 0
      ? Math.min(100, Math.max(0, (totalCollectedInBase / totalTargetInBase) * 100))
      : 0;
  const isGoalReached = totalRemainingInBase <= 0.009;

  // Convert grand totals to all 4 currencies
  const targetInVES = convertToVES(totalTargetInBase, effectiveBaseCurrency, rates);
  const collectedInVES = convertToVES(totalCollectedInBase, effectiveBaseCurrency, rates);
  const remainingInVES = convertToVES(totalRemainingInBase, effectiveBaseCurrency, rates);

  const amountsInAllCurrencies = {
    target: {
      USD: convertFromVES(targetInVES, 'USD', rates),
      VES: targetInVES,
      USDT: convertFromVES(targetInVES, 'USDT', rates),
      EUR: convertFromVES(targetInVES, 'EUR', rates),
    },
    collected: {
      USD: convertFromVES(collectedInVES, 'USD', rates),
      VES: collectedInVES,
      USDT: convertFromVES(collectedInVES, 'USDT', rates),
      EUR: convertFromVES(collectedInVES, 'EUR', rates),
    },
    remaining: {
      USD: convertFromVES(remainingInVES, 'USD', rates),
      VES: remainingInVES,
      USDT: convertFromVES(remainingInVES, 'USDT', rates),
      EUR: convertFromVES(remainingInVES, 'EUR', rates),
    },
  };

  return {
    targetAmount,
    targetCurrency,
    totalTargetInBase,
    totalCollectedInBase,
    totalRemainingInBase,
    progressPercent,
    isGoalReached,
    activeMembersCount: memberCount,
    baseCurrency: effectiveBaseCurrency,
    amountsInAllCurrencies,
    membersStats,
    contributions: contributionsWithBase.sort((a, b) => b.date - a.date),
  };
}

export interface FormatPrepaidReportOptions {
  includeHistory?: boolean;
  includeMulticurrencyRemaining?: boolean;
}

/**
 * Formats a clean, readable text report ready for WhatsApp / sharing
 */
export function formatPrepaidWhatsAppReport(
  sheetTitle: string,
  stats: PrepaidTripStats,
  decimals = 2,
  options: FormatPrepaidReportOptions = { includeHistory: false, includeMulticurrencyRemaining: true }
): string {
  const curr = stats.baseCurrency;
  const includeHistory = options.includeHistory ?? false;
  const includeMulticurrencyRemaining = options.includeMulticurrencyRemaining ?? true;

  let text = `🏖️ *PLANIFICACIÓN DE VIAJE / FONDO COMÚN*\n`;
  text += `📂 *Cuenta:* ${sheetTitle}\n`;
  text += `🎯 *Meta total:* ${formatCurrency(stats.totalTargetInBase, curr, decimals)}\n`;
  text += `💰 *Recaudado:* ${formatCurrency(stats.totalCollectedInBase, curr, decimals)} (${stats.progressPercent.toFixed(1)}%)\n`;
  text += `⏳ *Falta por reunir:* ${formatCurrency(stats.totalRemainingInBase, curr, decimals)}\n`;
  if (!stats.isGoalReached && includeMulticurrencyRemaining) {
    text += `   📊 *En las 4 monedas:*\n`;
    text += `      • $ ${formatNumber(stats.amountsInAllCurrencies.remaining.USD, decimals)} USD\n`;
    text += `      • Bs ${formatNumber(stats.amountsInAllCurrencies.remaining.VES, decimals)} VES\n`;
    text += `      • ${formatNumber(stats.amountsInAllCurrencies.remaining.USDT, decimals)} USDT\n`;
    text += `      • € ${formatNumber(stats.amountsInAllCurrencies.remaining.EUR, decimals)} EUR\n`;
  }
  text += `👥 *Participantes:* ${stats.activeMembersCount}\n`;
  text += `───────────────────────────\n`;
  text += `📋 *ESTADO POR PARTICIPANTE:*\n\n`;

  stats.membersStats.forEach((m) => {
    if (m.isCompleted) {
      text += `✅ *${m.name}*: ¡Cuota Completa! 🎉\n`;
      text += `   • Aportó: ${formatCurrency(m.collectedInBase, curr, decimals)} de ${formatCurrency(m.quotaInBase, curr, decimals)} (100%)\n`;
      if (m.surplusInBase > 0.01) {
        text += `   • (Abonó ${formatCurrency(m.surplusInBase, curr, decimals)} extra a favor)\n`;
      }
    } else {
      text += `⏳ *${m.name}*: Debe abonar aún\n`;
      text += `   • Ha pagado: ${formatCurrency(m.collectedInBase, curr, decimals)} de ${formatCurrency(m.quotaInBase, curr, decimals)} (${m.percent}%)\n`;
      if (includeMulticurrencyRemaining) {
        text += `   👉 *FALTA:*\n`;
        text += `      • $ ${formatNumber(m.remainingInAllCurrencies.USD, decimals)} (Dólares)\n`;
        text += `      • Bs ${formatNumber(m.remainingInAllCurrencies.VES, decimals)} (Bolívares)\n`;
        text += `      • ${formatNumber(m.remainingInAllCurrencies.USDT, decimals)} (USDT)\n`;
        text += `      • € ${formatNumber(m.remainingInAllCurrencies.EUR, decimals)} (Euros)\n`;
      } else {
        text += `   👉 *Falta:* ${formatCurrency(m.remainingInBase, curr, decimals)}\n`;
      }
    }
    text += `\n`;
  });

  if (includeHistory && stats.contributions.length > 0) {
    text += `───────────────────────────\n`;
    text += `📝 *HISTORIAL DE ABONOS REGISTRADOS:*\n`;
    stats.contributions.forEach((c) => {
      const dateStr = new Date(c.date).toLocaleDateString('es-VE', {
        day: '2-digit',
        month: '2-digit',
      });
      const noteStr = c.note ? ` - "${c.note}"` : '';
      text += `• ${dateStr} | *${c.member}*: ${formatCurrency(c.amount, c.currency, decimals)}${noteStr}\n`;
    });
    text += `───────────────────────────\n`;
  } else {
    text += `───────────────────────────\n`;
  }

  text += `_Calculado con ProCalc_`;
  return text;
}
