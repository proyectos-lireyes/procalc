import { jsPDF } from 'jspdf';
import {
  Sheet,
  ComputedRow,
  ComputedSheetTotals,
  RatesState,
  AppSettings,
  Currency,
} from '../types';
import { formatCurrency, formatNumber, convertCurrency } from './currency';
import {
  calculatePrepaidTripStats,
  calculatePostpaidStats,
  getSheetPlanners,
  getActivePlanner,
} from './tricountPrepaid';
import { captureElementToPng, downloadImageMedia, shareImageMedia } from './mediaShare';

export interface ReportExportOptions {
  includePlanners?: boolean;
  includeTripcountRows?: boolean;
  includeParticipantsBreakdown?: boolean;
  includeSettlement?: boolean;
  includeHistory?: boolean;
  includeFullTable?: boolean;
  selectedCurrencies?: Currency[];
}

/**
 * Generates and downloads a multi-page or single-page PDF of the rendered report canvas
 */
export async function generatePdfFromCanvas(
  element: HTMLElement,
  fileName: string,
  title: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const captured = await captureElementToPng(element);
    if (!captured) {
      return { success: false, error: 'No se pudo generar la imagen para el PDF.' };
    }

    const img = new Image();
    img.src = captured.dataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const imgWidthPx = img.width;
    const imgHeightPx = img.height;

    // PDF Page format: Standard A4 in mm (210 x 297)
    const pdfPageWidth = 210;
    const pdfPageHeight = 297;
    const margin = 10;
    const contentWidth = pdfPageWidth - margin * 2;
    const scaledHeight = (imgHeightPx * contentWidth) / imgWidthPx;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    // If height fits on one A4 page, place directly
    if (scaledHeight <= pdfPageHeight - margin * 2) {
      doc.addImage(captured.dataUrl, 'PNG', margin, margin, contentWidth, scaledHeight, undefined, 'FAST');
    } else {
      // Split across multiple pages
      let positionY = 0;
      let remainingHeight = scaledHeight;
      const pageUsableHeight = pdfPageHeight - margin * 2;

      while (remainingHeight > 0) {
        if (positionY > 0) {
          doc.addPage('a4', 'portrait');
        }

        // Clip source image slice onto current page
        doc.addImage(
          captured.dataUrl,
          'PNG',
          margin,
          margin - positionY,
          contentWidth,
          scaledHeight,
          undefined,
          'FAST'
        );

        positionY += pageUsableHeight;
        remainingHeight -= pageUsableHeight;
      }
    }

    doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
    return { success: true };
  } catch (err: any) {
    console.error('generatePdfFromCanvas failed:', err);
    return { success: false, error: err?.message || 'Error al generar el documento PDF.' };
  }
}

/**
 * Builds and downloads a standalone, beautifully styled, printable HTML document report
 */
export function generateHtmlReport(
  sheet: Sheet,
  computedRows: ComputedRow[],
  totals: ComputedSheetTotals,
  rates: RatesState,
  settings: AppSettings,
  options: ReportExportOptions = {}
): string {
  const {
    includePlanners = true,
    includeTripcountRows = true,
    includeParticipantsBreakdown = true,
    includeSettlement = true,
    includeHistory = true,
    includeFullTable = true,
    selectedCurrencies = ['USD', 'VES', 'USDT', 'EUR'],
  } = options;

  const members = sheet.members && sheet.members.length > 0 ? sheet.members : ['Yo'];
  const settleCurrency = settings.displayCurrency;
  const sheetPlanners = getSheetPlanners(sheet);
  const activePlanner = getActivePlanner(sheet);

  const postpaidStats = calculatePostpaidStats(members, computedRows, settleCurrency, rates);

  // Calculate Consolidated Account Grand Total: Sum of all Planners + Tripcount
  let totalPlannersTargetInBase = 0;
  let totalPlannersCollectedInBase = 0;
  let totalPlannersRemainingInBase = 0;

  sheetPlanners.forEach((p) => {
    const pCurrency = p.targetCurrency || settings.displayCurrency;
    const pStats = calculatePrepaidTripStats(members, p, rates, pCurrency);
    totalPlannersTargetInBase += pStats.totalTargetInBase;
    totalPlannersCollectedInBase += pStats.totalCollectedInBase;
    totalPlannersRemainingInBase += pStats.totalRemainingInBase;
  });

  const grandTotalConsolidated = totalPlannersTargetInBase + postpaidStats.totalSharedExpense;

  const nowFormatted = new Date().toLocaleString('es-VE', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Cuenta - ${sheet.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0f172a;
      background-color: #f8fafc;
      padding: 24px;
      line-height: 1.5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 900;
      color: #020617;
      letter-spacing: -0.5px;
    }
    .header .subtitle {
      font-size: 13px;
      font-weight: 700;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      display: inline-block;
      padding: 4px 12px;
      border-radius: 8px;
      margin-top: 6px;
    }
    .header .date {
      font-size: 11px;
      color: #64748b;
      margin-top: 6px;
      font-family: 'JetBrains Mono', monospace;
    }
    .rates-bar {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      justify-content: space-between;
      margin-bottom: 24px;
      color: #334155;
    }
    .rates-bar strong { color: #0f172a; }
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .card .label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      display: block;
      margin-bottom: 2px;
    }
    .card .value {
      font-size: 15px;
      font-weight: 900;
      font-family: 'JetBrains Mono', monospace;
      color: #0f172a;
    }
    .card.highlight-blue {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .card.highlight-green {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .card.highlight-amber {
      background: #fffbeb;
      border-color: #fde68a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 8px;
    }
    th {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 10px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .text-right { text-align: right; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
    }
    .badge-green { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-blue { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .badge-rose { background: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3; }
    .transfer-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 8px;
    }
    .transfer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 700;
    }
    .currencies-row {
      display: flex;
      gap: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
    }
    .currency-pill {
      flex: 1;
      padding: 4px 6px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      text-align: center;
      background: #f8fafc;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>${sheet.title}</h1>
      <div class="subtitle">Reporte Oficial de Cuentas y Liquidación</div>
      <div class="date">Generado el ${nowFormatted}</div>
    </div>

    <!-- Rates Bar -->
    <div class="rates-bar">
      <span><strong>Tasas Oficiales:</strong></span>
      <span>USD: <strong>${formatNumber(rates.USD?.rateToVES || 0, 2)} Bs</strong></span>
      <span>USDT: <strong>${formatNumber(rates.USDT?.rateToVES || 0, 2)} Bs</strong></span>
      <span>EUR: <strong>${formatNumber(rates.EUR?.rateToVES || 0, 2)} Bs</strong></span>
    </div>

    <!-- Consolidated Account Summary -->
    <div class="section">
      <div class="section-title">
        <span>Resumen General de la Cuenta</span>
        <span class="badge badge-blue">Suma Planners + Tripcount</span>
      </div>
      <div class="grid-3">
        <div class="card highlight-blue">
          <span class="label">Gasto Total Cuenta</span>
          <span class="value">${formatCurrency(grandTotalConsolidated, settleCurrency, 2)}</span>
        </div>
        <div class="card highlight-green">
          <span class="label">Planners / Colecta</span>
          <span class="value">${formatCurrency(totalPlannersTargetInBase, settleCurrency, 2)}</span>
        </div>
        <div class="card highlight-amber">
          <span class="label">Tripcount Gastos</span>
          <span class="value">${formatCurrency(postpaidStats.totalSharedExpense, settleCurrency, 2)}</span>
        </div>
      </div>
    </div>

    ${
      includePlanners && sheetPlanners.length > 0
        ? `
    <!-- Planners Section -->
    <div class="section">
      <div class="section-title">
        <span>Planners y Metas (${sheetPlanners.length})</span>
      </div>
      ${sheetPlanners
        .map((p) => {
          const pCurrency = p.targetCurrency || settings.displayCurrency;
          const pStats = calculatePrepaidTripStats(members, p, rates, pCurrency);
          return `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 13px; color: #1e3a8a;">Planner: ${p.name || 'General'}</strong>
              <span class="badge ${pStats.isGoalReached ? 'badge-green' : 'badge-amber'}">
                ${pStats.progressPercent.toFixed(1)}% Recaudado
              </span>
            </div>
            <div class="grid-4" style="margin-bottom: 10px;">
              <div class="card">
                <span class="label">Meta</span>
                <span class="value" style="font-size: 13px;">${formatCurrency(pStats.totalTargetInBase, pCurrency, 2)}</span>
              </div>
              <div class="card">
                <span class="label">Cuota p/p</span>
                <span class="value" style="font-size: 13px;">${formatCurrency(pStats.totalTargetInBase / (members.length || 1), pCurrency, 2)}</span>
              </div>
              <div class="card">
                <span class="label">Abonado</span>
                <span class="value" style="font-size: 13px; color: #166534;">${formatCurrency(pStats.totalCollectedInBase, pCurrency, 2)}</span>
              </div>
              <div class="card">
                <span class="label">Falta</span>
                <span class="value" style="font-size: 13px; color: ${pStats.isGoalReached ? '#166534' : '#92400e'};">
                  ${pStats.isGoalReached ? '¡Completo!' : formatCurrency(pStats.totalRemainingInBase, pCurrency, 2)}
                </span>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Cuota</th>
                  <th>Abonado</th>
                  <th>Estado / Falta</th>
                </tr>
              </thead>
              <tbody>
                ${pStats.membersStats
                  .map(
                    (m) => `
                  <tr>
                    <td><strong>${m.name}</strong></td>
                    <td class="font-mono">${formatCurrency(m.quotaInBase, pCurrency, 2)}</td>
                    <td class="font-mono" style="color: #166534;">${formatCurrency(m.collectedInBase, pCurrency, 2)}</td>
                    <td>
                      ${
                        m.isCompleted
                          ? '<span class="badge badge-green">¡Al día! (100%)</span>'
                          : `<span class="badge badge-amber font-mono">Falta: ${formatCurrency(m.remainingInBase, pCurrency, 2)}</span>`
                      }
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `;
        })
        .join('')}
    </div>
    `
        : ''
    }

    ${
      includeTripcountRows && computedRows.length > 0
        ? `
    <!-- Tripcount Shared Expenses Section -->
    <div class="section">
      <div class="section-title">
        <span>Tripcount • Gastos Pagados (${computedRows.length})</span>
        <span class="badge badge-green">Cuota p/p: ${formatCurrency(postpaidStats.fairShare, settleCurrency, 2)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>Concepto</th>
            <th>Pagó</th>
            <th class="text-right">Monto Original</th>
            <th class="text-right">Equiv. (${settleCurrency})</th>
          </tr>
        </thead>
        <tbody>
          ${computedRows
            .map(
              (r, idx) => `
            <tr>
              <td class="font-mono" style="color: #94a3b8;">${idx + 1}</td>
              <td>
                <strong>${r.concept || '(Sin descripción)'}</strong>
                ${
                  r.participants && r.participants.length < members.length
                    ? `<span style="font-size: 10px; color: #b45309; display: block;">(${r.participants.length} de ${members.length} participantes)</span>`
                    : ''
                }
              </td>
              <td><span class="badge badge-blue">${r.payer || members[0]}</span></td>
              <td class="font-mono text-right">${formatCurrency(r.evaluatedValue, r.currency, 2)}</td>
              <td class="font-mono text-right" style="font-weight: 700;">${formatCurrency(r.equivalents[settleCurrency], settleCurrency, 2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    ${
      includeParticipantsBreakdown
        ? `
    <!-- Participant Breakdown -->
    <div class="section">
      <div class="section-title">
        <span>Detalle de Consumo por Participante</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
        ${members
          .map((m) => {
            const consumed = postpaidStats.consumedByPerson[m] || 0;
            const paid = postpaidStats.paidByPerson[m] || 0;
            const bal = postpaidStats.balances[m] || 0;
            return `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <strong>${m}</strong>
                <span class="badge ${bal >= -0.01 ? 'badge-green' : 'badge-rose'}">
                  ${bal > 0.01 ? `+${formatCurrency(bal, settleCurrency, 2)}` : bal < -0.01 ? `Debe ${formatCurrency(Math.abs(bal), settleCurrency, 2)}` : 'Al día'}
                </span>
              </div>
              <div style="font-size: 11px; color: #64748b;" class="font-mono">
                Pagó: <strong>${formatCurrency(paid, settleCurrency, 2)}</strong> | Consumo: <strong>${formatCurrency(consumed, settleCurrency, 2)}</strong>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
    `
        : ''
    }

    ${
      includeSettlement
        ? `
    <!-- Settlement Transfers Section -->
    <div class="section">
      <div class="section-title">
        <span>Liquidación • ¿Quién le debe a quién?</span>
        <span class="badge badge-green">${postpaidStats.transfers.length} transferencias</span>
      </div>
      ${
        postpaidStats.transfers.length === 0
          ? '<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; text-align: center; color: #166534; font-weight: 700;">🎉 ¡Todos están al día! Nadie se debe nada.</div>'
          : postpaidStats.transfers
              .map((t) => {
                const transferKey = `${t.from}->${t.to}`;
                const isSettled = Boolean(sheet.settledTransfers?.[transferKey] || sheet.settledDebtors?.[t.from]);
                return `
              <div class="transfer-box" style="${isSettled ? 'background: #f0fdf4; border-color: #bbf7d0;' : ''}">
                <div class="transfer-header">
                  <div>
                    <span class="badge badge-rose">${t.from}</span>
                    <span style="color: #64748b; font-weight: 500; margin: 0 4px;">le paga a</span>
                    <span class="badge badge-green">${t.to}</span>
                  </div>
                  <span class="badge ${isSettled ? 'badge-green' : 'badge-amber'}">
                    ${isSettled ? '✓ Ya pagó / Liquidado' : 'Pendiente'}
                  </span>
                </div>
                <div class="currencies-row">
                  ${selectedCurrencies
                    .map((cur) => {
                      const amt = t.amountsInAllCurrencies?.[cur] ?? convertCurrency(t.amount, settleCurrency, cur, rates);
                      return `
                      <div class="currency-pill">
                        <span style="font-size: 8px; color: #64748b; display: block; font-weight: 700;">${cur}</span>
                        <strong>${formatCurrency(amt, cur, 2)}</strong>
                      </div>
                    `;
                    })
                    .join('')}
                </div>
              </div>
            `;
              })
              .join('')
      }
    </div>
    `
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      <div>ProCalc • Reporte Oficial Multidivisa</div>
      <div style="margin-top: 4px;">Documento generado automáticamente • Todos los derechos reservados</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Downloads the HTML report as a standalone file or opens in a new tab for printing
 */
export function downloadHtmlReport(
  sheet: Sheet,
  computedRows: ComputedRow[],
  totals: ComputedSheetTotals,
  rates: RatesState,
  settings: AppSettings,
  options: ReportExportOptions = {},
  fileName: string
): void {
  const htmlContent = generateHtmlReport(sheet, computedRows, totals, rates, settings, options);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
