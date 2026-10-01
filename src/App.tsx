/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calculator,
  Settings,
  ArrowRightLeft,
  Table,
  Archive,
  Atom,
} from 'lucide-react';
import {
  Currency,
  RatesState,
  Sheet,
  SheetRow,
  VariableItem,
  AppSettings,
  HistoryItem,
  ComputedRow,
  ComputedSheetTotals,
  TricountMode,
  TricountPrepaidConfig,
  TricountGroup,
} from './types';
import { DEFAULT_RATES, convertToVES, convertFromVES, formatCurrency, CURRENCY_CONFIG } from './utils/currency';
import { evaluateExpression } from './utils/mathEvaluator';
import { parseVariableDeclaration } from './utils/variableParser';
import { fetchLiveRates, getStoredRates, saveRatesToStorage } from './services/ratesService';
import { RatesTicker } from './components/RatesTicker';
import { SpreadsheetTable } from './components/SpreadsheetTable';
import { SettingsModal } from './components/SettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { ExportReportModal } from './components/ExportReportModal';
import { QuickConverterModal } from './components/QuickConverterModal';
import { TapeCalculatorModal } from './components/TapeCalculatorModal';
import { ModernScientificCalculator } from './components/ModernScientificCalculator';
import { ClosedSheetsModal } from './components/ClosedSheetsModal';
import { TricountGroupsModal } from './components/TricountGroupsModal';
import { checkGitHubRelease, AppReleaseInfo, DEFAULT_GITHUB_REPO } from './services/updateService';
import { SheetSharePayload } from './utils/shareImporter';

const STORAGE_SHEETS_KEY = 'multicurrency_sheets_v3';
const STORAGE_CLOSED_SHEETS_KEY = 'multicurrency_closed_sheets_v3';
const STORAGE_SETTINGS_KEY = 'multicurrency_settings_v3';
const STORAGE_HISTORY_KEY = 'multicurrency_history_v3';
const STORAGE_TRICOUNT_GROUPS_KEY = 'procalc_tricount_groups_v1';

const DEFAULT_TRICOUNT_GROUPS: TricountGroup[] = [
  {
    id: 'group_general',
    name: 'Grupo Amigos Principal',
    members: ['Yo', 'Carlos', 'Ana', 'María'],
    description: 'Grupo general para salidas y gastos compartidos',
    createdAt: Date.now(),
  },
  {
    id: 'group_viaje',
    name: 'Viaje y Vacaciones',
    members: ['Yo', 'Amigo 1', 'Amigo 2', 'Amigo 3'],
    description: 'Fondo para viajes y paseos',
    createdAt: Date.now(),
  },
];

const INITIAL_SHEET: Sheet = {
  id: 'sheet_principal',
  title: 'Cuenta 1',
  description: 'Hoja de cálculos multimoneda',
  isTricountActive: false,
  members: ['Yo', 'Amigo 1'],
  variables: [],
  rows: [
    {
      id: 'row_1',
      concept: '',
      expression: '',
      currency: 'USD',
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const INITIAL_SETTINGS: AppSettings = {
  displayCurrency: 'USD',
  paymentCurrency: 'VES',
  decimals: 2,
  useCustomRates: false,
  customRates: {
    USD: 804.81,
    EUR: 932.81,
    USDT: 960.34,
    VES: 1.0,
  },
  autoRefresh: true,
  githubRepo: 'proyectos-lireyes/procalc',
};

export default function App() {
  // 1. Rates state
  const [rates, setRates] = useState<RatesState>(getStoredRates());
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [isCached, setIsCached] = useState<boolean>(true);
  const [isLoadingRates, setIsLoadingRates] = useState<boolean>(false);
  const [ratesLastUpdated, setRatesLastUpdated] = useState<string>(new Date().toISOString());

  // 2. Settings state
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.githubRepo || parsed.githubRepo.includes('lissandro545')) {
          parsed.githubRepo = 'proyectos-lireyes/procalc';
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_SETTINGS;
  });

  // 3. Sheets state
  const [sheets, setSheets] = useState<Sheet[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SHEETS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [INITIAL_SHEET];
  });

  const [activeSheetId, setActiveSheetId] = useState<string>(() => {
    return sheets[0]?.id || INITIAL_SHEET.id;
  });

  // Closed/Archived Sheets State (allows user to re-open any closed account)
  const [closedSheets, setClosedSheets] = useState<Sheet[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CLOSED_SHEETS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // 4. History state
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // 5. Active Row ID for keypad/variable insertion
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  // 6. Active Main Tab View (Basic calc, Scientific calc, Sheets, Converter)
  const [activeTab, setActiveTab] = useState<'basic' | 'scientific' | 'sheets' | 'converter'>('basic');

  // 7. Modal states
  const [isScientificOpen, setIsScientificOpen] = useState(false);
  const [isVariablesOpen, setIsVariablesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isQuickConverterOpen, setIsQuickConverterOpen] = useState(false);
  const [isTricountOpen, setIsTricountOpen] = useState(false);
  const [isTapeCalcOpen, setIsTapeCalcOpen] = useState(false);
  const [isClosedSheetsOpen, setIsClosedSheetsOpen] = useState(false);
  const [isTricountGroupsOpen, setIsTricountGroupsOpen] = useState(false);

  // Tricount Groups (general reusable groups across accounts)
  const [tricountGroups, setTricountGroups] = useState<TricountGroup[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_TRICOUNT_GROUPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_TRICOUNT_GROUPS;
  });

  // Save Tricount Groups to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TRICOUNT_GROUPS_KEY, JSON.stringify(tricountGroups));
    } catch (e) {
      console.error('Error saving tricount groups', e);
    }
  }, [tricountGroups]);

  // Update check states (startup verification & notification dot)
  const [hasUpdateNotification, setHasUpdateNotification] = useState<boolean>(false);
  const [startupReleaseInfo, setStartupReleaseInfo] = useState<AppReleaseInfo | null>(null);

  // Auto-comprobación de nueva versión al iniciar la aplicación
  useEffect(() => {
    let isMounted = true;
    const checkUpdateSilently = async () => {
      try {
        const repo = settings.githubRepo || DEFAULT_GITHUB_REPO;
        const info = await checkGitHubRelease(repo);
        if (isMounted && info.hasUpdate) {
          setHasUpdateNotification(true);
          setStartupReleaseInfo(info);
        }
      } catch (err) {
        // En arranque, omitir errores de red o temporales silenciosamente
        console.warn('Chequeo automático de actualización:', err);
      }
    };

    const timer = setTimeout(() => {
      checkUpdateSilently();
    }, 1200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [settings.githubRepo]);

  // Save sheets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SHEETS_KEY, JSON.stringify(sheets));
    } catch (e) {
      console.error('Error saving sheets', e);
    }
  }, [sheets]);

  // Save closed sheets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CLOSED_SHEETS_KEY, JSON.stringify(closedSheets));
    } catch (e) {
      console.error('Error saving closed sheets', e);
    }
  }, [closedSheets]);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings', e);
    }
  }, [settings]);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Error saving history', e);
    }
  }, [history]);

  // Load live rates on initial mount and setup offline/online listeners
  const loadRates = useCallback(async () => {
    setIsLoadingRates(true);
    try {
      const res = await fetchLiveRates();
      setRates(res.rates);
      setIsOffline(res.isOffline);
      setIsCached(res.isCached);
      setRatesLastUpdated(res.lastUpdated);
    } catch (e) {
      console.error('Error loading rates', e);
      setIsOffline(true);
    } finally {
      setIsLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    // Sync only once at app startup
    loadRates();

    const handleOnline = () => {
      setIsOffline(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadRates]);

  // Active sheet reference
  const currentSheet = useMemo(() => {
    return sheets.find((s) => s.id === activeSheetId) || sheets[0] || INITIAL_SHEET;
  }, [sheets, activeSheetId]);

  // Effective rates (taking into account custom rates if enabled)
  const effectiveRates = useMemo<RatesState>(() => {
    if (!settings.useCustomRates) {
      return rates;
    }
    return {
      USD: {
        ...rates.USD,
        rateToVES: settings.customRates.USD || rates.USD.rateToVES,
      },
      EUR: {
        ...rates.EUR,
        rateToVES: settings.customRates.EUR || rates.EUR.rateToVES,
      },
      USDT: {
        ...rates.USDT,
        rateToVES: settings.customRates.USDT || rates.USDT.rateToVES,
      },
      VES: {
        ...rates.VES,
        rateToVES: 1.0,
      },
    };
  }, [rates, settings.useCustomRates, settings.customRates]);

  // Map of current sheet's variables
  const variablesMap = useMemo(() => {
    const map: Record<string, number> = {};
    currentSheet.variables.forEach((v) => {
      map[v.name] = v.value;
    });
    return map;
  }, [currentSheet.variables]);

  // Compute each row in real-time with sequential top-down variable scoping
  const computedRows = useMemo<ComputedRow[]>(() => {
    const dynamicVars: Record<string, number> = { ...variablesMap };
    let runningSum = 0;
    let prevRowVal = 0;

    return currentSheet.rows.map((row, index) => {
      // 1. Check if row concept has a variable declaration like `@tasa = "120"` or `@iva = 0.16`
      const varDecl = parseVariableDeclaration(row.concept, dynamicVars);
      if (varDecl) {
        dynamicVars[varDecl.name] = varDecl.evaluatedValue;
        dynamicVars[varDecl.name.toLowerCase()] = varDecl.evaluatedValue;
        dynamicVars['@' + varDecl.name.toLowerCase()] = varDecl.evaluatedValue;
      }

      // Row variables: dynamic variables + ans + sum + R1..Rn
      const rowVars: Record<string, number> = {
        ...dynamicVars,
        ans: prevRowVal,
        Ans: prevRowVal,
        ANS: prevRowVal,
        sum: runningSum,
        [`r${index}`]: prevRowVal,
        [`R${index}`]: prevRowVal,
      };

      // If row has variable declaration and expression is empty or '0', evaluate to declared value
      let exprToEval = row.expression;
      if (varDecl && (!exprToEval || exprToEval.trim() === '0')) {
        exprToEval = String(varDecl.evaluatedValue);
      }

      const evalRes = evaluateExpression(exprToEval || '0', rowVars);
      const evaluatedValue = evalRes.isValid ? evalRes.value : 0;
      const isExpense = evaluatedValue < 0;

      // Equivalent in VES
      const amountInVES = convertToVES(evaluatedValue, row.currency, effectiveRates);

      // If concept is an identifier without '=', also register as variable
      const cleanConcept = row.concept.trim();
      if (!varDecl && cleanConcept && /^[a-zA-Z_áéíóúÁÉÍÓÚñÑ][a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]*$/.test(cleanConcept)) {
        dynamicVars[cleanConcept] = evaluatedValue;
        dynamicVars[cleanConcept.toLowerCase()] = evaluatedValue;
        dynamicVars['@' + cleanConcept.toLowerCase()] = evaluatedValue;
      }

      // Also register R1, R2, ... (1-indexed)
      dynamicVars[`r${index + 1}`] = evaluatedValue;
      dynamicVars[`R${index + 1}`] = evaluatedValue;

      prevRowVal = evaluatedValue;
      runningSum += evaluatedValue;

      // Equivalents in all 4 currencies
      const equivalents: Record<Currency, number> = {
        USD: convertFromVES(amountInVES, 'USD', effectiveRates),
        EUR: convertFromVES(amountInVES, 'EUR', effectiveRates),
        USDT: convertFromVES(amountInVES, 'USDT', effectiveRates),
        VES: amountInVES,
      };

      return {
        id: row.id,
        concept: row.concept,
        expression: row.expression,
        currency: row.currency,
        payer: row.payer,
        participants: row.participants,
        evaluatedValue,
        isExpense,
        isValid: evalRes.isValid,
        errorMessage: evalRes.error,
        equivalents,
      };
    });
  }, [currentSheet.rows, variablesMap, effectiveRates]);

  // Compute sheet totals in all currencies simultaneously
  const totals = useMemo<ComputedSheetTotals>(() => {
    let totalVES = 0;
    let totalIncomesVES = 0;
    let totalExpensesVES = 0;
    let validCount = 0;
    let hasErrors = false;

    computedRows.forEach((row) => {
      if (row.isValid) {
        validCount++;
        const vesVal = row.equivalents.VES;
        totalVES += vesVal;
        if (vesVal > 0) {
          totalIncomesVES += vesVal;
        } else {
          totalExpensesVES += vesVal;
        }
      } else {
        hasErrors = true;
      }
    });

    return {
      netByCurrency: {
        USD: convertFromVES(totalVES, 'USD', effectiveRates),
        EUR: convertFromVES(totalVES, 'EUR', effectiveRates),
        USDT: convertFromVES(totalVES, 'USDT', effectiveRates),
        VES: totalVES,
      },
      incomesByCurrency: {
        USD: convertFromVES(totalIncomesVES, 'USD', effectiveRates),
        EUR: convertFromVES(totalIncomesVES, 'EUR', effectiveRates),
        USDT: convertFromVES(totalIncomesVES, 'USDT', effectiveRates),
        VES: totalIncomesVES,
      },
      expensesByCurrency: {
        USD: convertFromVES(totalExpensesVES, 'USD', effectiveRates),
        EUR: convertFromVES(totalExpensesVES, 'EUR', effectiveRates),
        USDT: convertFromVES(totalExpensesVES, 'USDT', effectiveRates),
        VES: totalExpensesVES,
      },
      validRowsCount: validCount,
      hasErrors,
    };
  }, [computedRows, effectiveRates]);

  // Record a history snapshot when total changes significantly (debounced)
  useEffect(() => {
    if (computedRows.length === 0) return;

    const timer = setTimeout(() => {
      const newHistoryItem: HistoryItem = {
        id: 'hist_' + Date.now(),
        timestamp: Date.now(),
        sheetTitle: currentSheet.title,
        action: 'Cálculo de Hoja',
        summaryInCurrencies: totals.netByCurrency,
        rowsCount: computedRows.length,
      };

      setHistory((prev) => {
        // Prevent duplicate logs within 2 minutes with same totals
        const latest = prev[0];
        if (
          latest &&
          latest.sheetTitle === newHistoryItem.sheetTitle &&
          Math.abs(latest.summaryInCurrencies.VES - newHistoryItem.summaryInCurrencies.VES) < 0.01 &&
          Date.now() - latest.timestamp < 120000
        ) {
          return prev;
        }
        return [newHistoryItem, ...prev.slice(0, 30)];
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [totals.netByCurrency, currentSheet.title, computedRows.length]);

  // Sheet Management Handlers
  const handleCreateSheet = () => {
    const newNumber = sheets.length + 1;
    const newSheet: Sheet = {
      id: 'sheet_' + Date.now(),
      title: `Cuenta ${newNumber}`,
      variables: [...currentSheet.variables],
      rows: [
        {
          id: 'row_' + Date.now(),
          concept: 'Registro inicial',
          expression: '0',
          currency: settings.displayCurrency,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSheets((prev) => [...prev, newSheet]);
    setActiveSheetId(newSheet.id);
  };

  const handleRenameSheet = (id: string, newTitle: string) => {
    setSheets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s))
    );
  };

  const handleDeleteSheet = (id: string) => {
    const target = sheets.find((s) => s.id === id);
    if (target) {
      // Archive to closedSheets so user can re-open it at any time!
      setClosedSheets((prev) => [target, ...prev.filter((cs) => cs.id !== target.id)]);
    }

    if (sheets.length <= 1) {
      const freshSheet: Sheet = {
        id: 'sheet_' + Date.now(),
        title: 'Cuenta 1',
        variables: [],
        rows: [
          {
            id: 'row_' + Date.now(),
            concept: '',
            expression: '0',
            currency: settings.displayCurrency,
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setSheets([freshSheet]);
      setActiveSheetId(freshSheet.id);
      return;
    }
    const remaining = sheets.filter((s) => s.id !== id);
    setSheets(remaining);
    if (activeSheetId === id) {
      setActiveSheetId(remaining[0].id);
    }
  };

  // Re-open / restore a closed sheet
  const handleReopenSheet = (id: string) => {
    const target = closedSheets.find((s) => s.id === id);
    if (!target) return;
    setClosedSheets((prev) => prev.filter((s) => s.id !== id));
    setSheets((prev) => [...prev, target]);
    setActiveSheetId(target.id);
  };

  // Import shared sheet
  const handleImportSheet = (data: SheetSharePayload, mode: 'new' | 'replace') => {
    const importedRows: SheetRow[] = data.rows.map((r, i) => ({
      id: 'row_' + Date.now() + '_' + i,
      concept: r.concept || '',
      expression: r.expression || '0',
      currency: r.currency || settings.displayCurrency,
      payer: r.payer,
    }));

    const rowsToSet =
      importedRows.length > 0
        ? importedRows
        : [
            {
              id: 'row_' + Date.now(),
              concept: '',
              expression: '0',
              currency: settings.displayCurrency,
            },
          ];

    if (mode === 'replace') {
      setSheets((prev) =>
        prev.map((s) =>
          s.id === activeSheetId
            ? {
                ...s,
                title: data.title || s.title,
                members: data.members || s.members,
                isTricountActive: data.isTricountActive ?? s.isTricountActive,
                tricountMode: data.tricountMode ?? s.tricountMode,
                prepaidConfig: data.prepaidConfig ?? s.prepaidConfig,
                settledTransfers: data.settledTransfers ?? s.settledTransfers,
                settledDebtors: data.settledDebtors ?? s.settledDebtors,
                partialSettlements: data.partialSettlements ?? s.partialSettlements,
                rows: rowsToSet,
                updatedAt: Date.now(),
              }
            : s
        )
      );
    } else {
      const newSheet: Sheet = {
        id: 'sheet_' + Date.now(),
        title: data.title || `Cuenta ${sheets.length + 1}`,
        members: data.members || ['Yo'],
        isTricountActive: data.isTricountActive ?? false,
        tricountMode: data.tricountMode,
        prepaidConfig: data.prepaidConfig,
        settledTransfers: data.settledTransfers,
        settledDebtors: data.settledDebtors,
        partialSettlements: data.partialSettlements,
        variables: [...currentSheet.variables],
        rows: rowsToSet,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setSheets((prev) => [...prev, newSheet]);
      setActiveSheetId(newSheet.id);
    }
  };

  const handlePermanentDeleteClosedSheet = (id: string) => {
    setClosedSheets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearAllClosedSheets = () => {
    setClosedSheets([]);
  };

  const handleDuplicateSheet = (id: string) => {
    const target = sheets.find((s) => s.id === id);
    if (!target) return;
    const duplicated: Sheet = {
      ...target,
      id: 'sheet_' + Date.now(),
      title: `${target.title} (Copia)`,
      rows: target.rows.map((r) => ({ ...r, id: 'row_' + Math.random().toString(36).substring(2, 8) })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSheets((prev) => [...prev, duplicated]);
    setActiveSheetId(duplicated.id);
  };

  // Row Management Handlers
  const handleUpdateRow = (rowId: string, updates: Partial<SheetRow>) => {
    setSheets((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheetId) return s;
        return {
          ...s,
          rows: s.rows.map((r) => (r.id === rowId ? { ...r, ...updates } : r)),
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleAddRow = (initialData?: Partial<SheetRow>, afterRowId?: string): string => {
    const newRow: SheetRow = {
      id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      concept: initialData?.concept ?? '',
      expression: initialData?.expression ?? '',
      currency: initialData?.currency ?? settings.displayCurrency,
    };

    setSheets((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheetId) return s;
        if (afterRowId) {
          const idx = s.rows.findIndex((r) => r.id === afterRowId);
          if (idx !== -1) {
            const nextRows = [...s.rows];
            nextRows.splice(idx + 1, 0, newRow);
            return {
              ...s,
              rows: nextRows,
              updatedAt: Date.now(),
            };
          }
        }
        return {
          ...s,
          rows: [...s.rows, newRow],
          updatedAt: Date.now(),
        };
      })
    );

    setActiveRowId(newRow.id);
    return newRow.id;
  };

  const handleDeleteRow = (rowId: string) => {
    setSheets((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheetId) return s;
        return {
          ...s,
          rows: s.rows.filter((r) => r.id !== rowId),
          updatedAt: Date.now(),
        };
      })
    );
    if (activeRowId === rowId) setActiveRowId(null);
  };

  const handleDuplicateRow = (rowId: string) => {
    const target = currentSheet.rows.find((r) => r.id === rowId);
    if (!target) return;
    const newRow: SheetRow = {
      ...target,
      id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      concept: `${target.concept} (Copia)`,
    };
    const targetIdx = currentSheet.rows.findIndex((r) => r.id === rowId);
    const newRows = [...currentSheet.rows];
    newRows.splice(targetIdx + 1, 0, newRow);

    setSheets((prev) =>
      prev.map((s) => (s.id === activeSheetId ? { ...s, rows: newRows, updatedAt: Date.now() } : s))
    );
  };

  const handleClearRows = () => {
    setSheets((prev) =>
      prev.map((s) =>
        s.id === activeSheetId
          ? {
              ...s,
              rows: [],
              settledTransfers: {},
              settledDebtors: {},
              partialSettlements: {},
              prepaidConfig: s.prepaidConfig
                ? {
                    ...s.prepaidConfig,
                    contributions: [],
                    customQuotas: {},
                  }
                : undefined,
              updatedAt: Date.now(),
            }
          : s
      )
    );
  };

  // Variable Handlers
  const handleSaveVariables = (newVars: VariableItem[]) => {
    setSheets((prev) =>
      prev.map((s) => (s.id === activeSheetId ? { ...s, variables: newVars, updatedAt: Date.now() } : s))
    );
  };

  // Tricount Handlers
  const handleUpdateSheetMembers = (members: string[]) => {
    setSheets((prev) =>
      prev.map((s) => (s.id === activeSheetId ? { ...s, members, updatedAt: Date.now() } : s))
    );
  };

  const handleToggleSheetTricount = (isActive: boolean) => {
    setSheets((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheetId) return s;
        const currentMembers = s.members && s.members.length > 0 ? s.members : ['Yo', 'Amigo 1'];
        return {
          ...s,
          isTricountActive: isActive,
          members: currentMembers,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleUpdateSheetTricountMode = (mode: TricountMode) => {
    setSheets((prev) =>
      prev.map((s) => (s.id === activeSheetId ? { ...s, tricountMode: mode, updatedAt: Date.now() } : s))
    );
  };

  const handleUpdateSheetPrepaidConfig = (config: TricountPrepaidConfig) => {
    setSheets((prev) =>
      prev.map((s) => (s.id === activeSheetId ? { ...s, prepaidConfig: config, updatedAt: Date.now() } : s))
    );
  };

  const handleUpdateRowPayer = (rowId: string, payer: string) => {
    handleUpdateRow(rowId, { payer });
  };

  // Tricount Group Handlers (general reusable groups)
  const handleCreateTricountGroup = (name: string, members: string[], description?: string) => {
    const newGroup: TricountGroup = {
      id: 'group_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim() || 'Nuevo Grupo',
      members: members.filter((m) => m.trim().length > 0),
      description: description?.trim() || undefined,
      createdAt: Date.now(),
    };
    setTricountGroups((prev) => [...prev, newGroup]);
  };

  const handleUpdateTricountGroup = (
    id: string,
    name: string,
    members: string[],
    description?: string
  ) => {
    const filteredMembers = members.filter((m) => m.trim().length > 0);
    setTricountGroups((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              name: name.trim() || g.name,
              members: filteredMembers,
              description: description?.trim() || undefined,
            }
          : g
      )
    );
    // If active sheet is linked to this group, keep its members in sync
    setSheets((prev) =>
      prev.map((s) => {
        if (s.tricountGroupId === id) {
          return {
            ...s,
            members: filteredMembers,
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );
  };

  const handleDeleteTricountGroup = (groupId: string) => {
    setTricountGroups((prev) => prev.filter((g) => g.id !== groupId));
    setSheets((prev) =>
      prev.map((s) => (s.tricountGroupId === groupId ? { ...s, tricountGroupId: undefined } : s))
    );
  };

  const handleAssociateTricountGroup = (groupId: string) => {
    const group = tricountGroups.find((g) => g.id === groupId);
    setSheets((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheetId) return s;
        if (!groupId) {
          return { ...s, tricountGroupId: undefined, updatedAt: Date.now() };
        }
        return {
          ...s,
          tricountGroupId: groupId,
          isTricountActive: true,
          members: group && group.members.length > 0 ? [...group.members] : s.members,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleUpdateSettledTransfers = (settledTransfers: Record<string, boolean>) => {
    setSheets((prev) =>
      prev.map((s) => (s.id === activeSheetId ? { ...s, settledTransfers, updatedAt: Date.now() } : s))
    );
  };

  const handleUpdateSettledDebtors = (settledDebtors: Record<string, boolean>) => {
    setSheets((prev) =>
      prev.map((s) => (s.id === activeSheetId ? { ...s, settledDebtors, updatedAt: Date.now() } : s))
    );
  };

  const handleUpdateSheetPartialSettlements = (partialSettlements: Record<string, number>) => {
    setSheets((prev) =>
      prev.map((s) => (s.id === activeSheetId ? { ...s, partialSettlements, updatedAt: Date.now() } : s))
    );
  };

  // Insertion into active row
  const handleInsertToActiveRow = (text: string) => {
    let targetRow = currentSheet.rows.find((r) => r.id === activeRowId);
    if (!targetRow) {
      if (currentSheet.rows.length > 0) {
        targetRow = currentSheet.rows[currentSheet.rows.length - 1];
        setActiveRowId(targetRow.id);
      } else {
        handleAddRow({ expression: text });
        return;
      }
    }

    if (targetRow) {
      const currentExpr = targetRow.expression === '0' ? '' : targetRow.expression;
      const updated = currentExpr ? `${currentExpr} + ${text}` : text;
      handleUpdateRow(targetRow.id, { expression: updated });
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-[#F8F9FA] text-slate-800 flex flex-col overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* 1. Compact Live Exchange Rates Bar with 3 Spans + 1 Consult/Hour Button */}
      <RatesTicker
        rates={effectiveRates}
        isOffline={isOffline}
        isCached={isCached}
        isCustomRatesActive={settings.useCustomRates}
        isLoading={isLoadingRates}
        lastUpdated={ratesLastUpdated}
        onRefresh={loadRates}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Main Workspace Area (Clean layout without redundant top nav) */}
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto p-1 sm:p-2 flex flex-col overflow-hidden">

        {/* VIEW 1: CALCULADORA BÁSICA (Cuentas y montos en línea con filas) */}
        {activeTab === 'basic' && (
          <div className="w-full flex-1 min-h-0 h-full flex flex-col overflow-hidden">
            <TapeCalculatorModal
              isOpen={true}
              isInline={true}
              onClose={() => {}}
              onInsertResult={(result) => {
                handleInsertToActiveRow(result);
                setActiveTab('sheets');
              }}
            />
          </div>
        )}

        {/* VIEW 2: CALCULADORA CIENTÍFICA (Natural Display, 0 scroll, funciones completas) */}
        {activeTab === 'scientific' && (
          <div className="w-full flex-1 min-h-0 h-full flex flex-col overflow-hidden">
            <ModernScientificCalculator
              onInsertResult={(result) => {
                handleInsertToActiveRow(result);
                setActiveTab('sheets');
              }}
              isInline={true}
            />
          </div>
        )}

        {/* VIEW 3: CALCU DE CUENTAS (Spreadsheet Table) */}
        {activeTab === 'sheets' && (
          <div className="w-full flex-1 min-h-0 h-full flex flex-col overflow-hidden">
            <SpreadsheetTable
              sheets={sheets}
              activeSheetId={activeSheetId}
              onSelectSheet={setActiveSheetId}
              onCreateSheet={handleCreateSheet}
              onRenameSheet={handleRenameSheet}
              onDeleteSheet={handleDeleteSheet}
              onDuplicateSheet={handleDuplicateSheet}
              sheet={currentSheet}
              computedRows={computedRows}
              totals={totals}
              rates={effectiveRates}
              settings={settings}
              onUpdateRow={handleUpdateRow}
              onAddRow={handleAddRow}
              onDeleteRow={handleDeleteRow}
              onDuplicateRow={handleDuplicateRow}
              onClearRows={handleClearRows}
              onOpenScientificKeypad={() => setActiveTab('scientific')}
              activeRowId={activeRowId}
              setActiveRowId={setActiveRowId}
              onOpenExportReport={() => setIsExportOpen(true)}
              onOpenTapeCalculator={() => setActiveTab('basic')}
              onOpenQuickConverter={() => setActiveTab('converter')}
              onInsertExpression={handleInsertToActiveRow}
              onUpdateSheetMembers={handleUpdateSheetMembers}
              onToggleSheetTricount={handleToggleSheetTricount}
              onUpdateSheetTricountMode={handleUpdateSheetTricountMode}
              onUpdatePrepaidConfig={handleUpdateSheetPrepaidConfig}
              onUpdateSettledTransfers={handleUpdateSettledTransfers}
              onUpdateSettledDebtors={handleUpdateSettledDebtors}
              onUpdatePartialSettlements={handleUpdateSheetPartialSettlements}
              tricountGroups={tricountGroups}
              onOpenTricountGroups={() => setIsTricountGroupsOpen(true)}
              onAssociateTricountGroup={handleAssociateTricountGroup}
              onCreateTricountGroup={(name, members, description) => handleCreateTricountGroup(name, members, description)}
              onUpdateTricountGroup={handleUpdateTricountGroup}
              onDeleteTricountGroup={handleDeleteTricountGroup}
              onOpenClosedSheets={() => setIsClosedSheetsOpen(true)}
              closedSheetsCount={closedSheets.length}
              onImportSheet={handleImportSheet}
            />
          </div>
        )}

        {/* VIEW 4: CONVERSOR RÁPIDO & REGLA DE 3 */}
        {activeTab === 'converter' && (
          <div className="w-full flex-1 min-h-0 h-full overflow-y-auto">
            <QuickConverterModal
              isOpen={true}
              isInline={true}
              onClose={() => {}}
              rates={effectiveRates}
              onInsertToSheet={(expr, curr) => {
                handleAddRow({ concept: 'Conversión rápida', expression: expr, currency: curr });
                setActiveTab('sheets');
              }}
            />
          </div>
        )}

      </main>

      {/* 3. Modals and Drawers */}
      <ClosedSheetsModal
        isOpen={isClosedSheetsOpen}
        onClose={() => setIsClosedSheetsOpen(false)}
        closedSheets={closedSheets}
        onReopenSheet={handleReopenSheet}
        onPermanentDeleteSheet={handlePermanentDeleteClosedSheet}
        onClearAllClosedSheets={handleClearAllClosedSheets}
        displayCurrency={settings.displayCurrency}
      />

      {/* Standalone TapeCalculator Modal when explicitly triggered as modal */}
      <TapeCalculatorModal
        isOpen={isTapeCalcOpen}
        onClose={() => setIsTapeCalcOpen(false)}
        onInsertResult={handleInsertToActiveRow}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        rates={rates}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
        onResetRatesToApi={() => {
          setSettings((prev) => ({
            ...prev,
            useCustomRates: false,
          }));
          loadRates();
        }}
        initialReleaseInfo={startupReleaseInfo}
        hasUpdateNotification={hasUpdateNotification}
        onOpenTricountGroups={() => setIsTricountGroupsOpen(true)}
        tricountGroupsCount={tricountGroups.length}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onClearHistory={() => setHistory([])}
      />

      <ExportReportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        sheet={currentSheet}
        computedRows={computedRows}
        totals={totals}
        rates={effectiveRates}
        settings={settings}
      />

      <QuickConverterModal
        isOpen={isQuickConverterOpen}
        onClose={() => setIsQuickConverterOpen(false)}
        rates={effectiveRates}
        onInsertToSheet={(expr, curr) => {
          handleAddRow({ concept: 'Conversión rápida', expression: expr, currency: curr });
        }}
      />

      <TricountGroupsModal
        isOpen={isTricountGroupsOpen}
        onClose={() => setIsTricountGroupsOpen(false)}
        groups={tricountGroups}
        currentSheet={currentSheet}
        onCreateGroup={handleCreateTricountGroup}
        onUpdateGroup={handleUpdateTricountGroup}
        onDeleteGroup={handleDeleteTricountGroup}
        onAssociateGroupToCurrentSheet={handleAssociateTricountGroup}
      />

      {/* 4. Slim, space-saving Bottom Navigation Bar (Docker) */}
      <nav aria-label="Navegación principal" className="bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 sm:px-4 py-1 flex items-center justify-around shadow-xs shrink-0 z-20">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex flex-col items-center justify-center py-0.5 px-2.5 rounded-lg cursor-pointer transition-colors ${
            activeTab === 'basic' ? 'text-indigo-600 font-bold bg-indigo-50/70' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Calculadora básica con filas y desglose de cuentas"
        >
          <Calculator className="w-4 h-4" />
          <span className="text-[10px] leading-tight">Básica</span>
        </button>

        <button
          onClick={() => setActiveTab('scientific')}
          className={`flex flex-col items-center justify-center py-0.5 px-2.5 rounded-lg cursor-pointer transition-colors ${
            activeTab === 'scientific' ? 'text-indigo-600 font-bold bg-indigo-50/70' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Calculadora científica con pantalla natural y funciones"
        >
          <Atom className="w-4 h-4" />
          <span className="text-[10px] leading-tight">Científica</span>
        </button>

        <button
          onClick={() => setActiveTab('sheets')}
          className={`flex flex-col items-center justify-center py-0.5 px-2.5 rounded-lg cursor-pointer transition-colors ${
            activeTab === 'sheets' ? 'text-blue-600 font-bold bg-blue-50/70' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Hojas de cuentas multimoneda"
        >
          <Table className="w-4 h-4" />
          <span className="text-[10px] leading-tight">Cuentas</span>
        </button>

        <button
          onClick={() => setActiveTab('converter')}
          className={`flex flex-col items-center justify-center py-0.5 px-2.5 rounded-lg cursor-pointer transition-colors ${
            activeTab === 'converter' ? 'text-emerald-600 font-bold bg-emerald-50/70' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Conversor rápido de divisas y regla de 3"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span className="text-[10px] leading-tight">Conversor</span>
        </button>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="relative flex flex-col items-center justify-center py-0.5 px-2.5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
          title={hasUpdateNotification ? 'Hay una nueva versión disponible' : 'Ajustes'}
        >
          <div className="relative">
            <Settings className="w-4 h-4" />
            {hasUpdateNotification && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-white"></span>
              </span>
            )}
          </div>
          <span className="text-[10px] leading-tight">Ajustes</span>
        </button>
      </nav>

    </div>
  );
}
