import * as Print from 'expo-print';
import { sharePdfBase64 } from './stockPdf';
import { LOGO_DATA_URI } from './logoDataUri';
import type { CashReconciliation } from '../services/types';

/** PDF ya HESABU YA SIKU (Cash Reconciliation) — ripoti kuu inayounganisha
 *  opening, mauzo, malipo ya siku (Expenses + Stock Receiving + Stock Requests)
 *  na variance. Inashtuliwa kwenye Cash Reconciliation. */
export async function shareOverallReportPdf(opts: {
  rec: CashReconciliation;
  moneyOutLabel?: string;
  managerName?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const { rec, managerName } = opts;
    const logo = LOGO_DATA_URI;
    const logoHtml = logo
      ? `<img src="${logo}" alt="Logo" style="width:54px;height:54px;object-fit:contain;border-radius:8px;" />`
      : '';

    const fmt = (n: number) => `TSh ${Number(n || 0).toLocaleString('en-US')}`;
    const esc = (s: string) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const statusBadge =
      rec.status === 'approved'
        ? '<span class="status">Approved</span>'
        : '<span class="status pending">Submitted</span>';

    const varianceText =
      rec.variance === 0
        ? 'Cash Matches — No variance'
        : rec.variance < 0
          ? `Shortage of cash ${fmt(Math.abs(rec.variance))}`
          : `Overage of cash ${fmt(Math.abs(rec.variance))}`;

    const adjustmentRow =
      rec.adminAdjustment !== undefined && rec.adminAdjustment !== 0
        ? `<tr><td>Admin adjustment</td><td class="num">${rec.adminAdjustment > 0 ? '+' : '−'} ${fmt(Math.abs(rec.adminAdjustment))}</td></tr>`
        : '';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 32px 28px 36px; }
  body {
    font-family: 'Times New Roman', Times, 'Noto Serif', Georgia, serif;
    color: #10202E;
    padding: 0;
    line-height: 1.5;
  }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; }
  .brand { font-size: 15px; letter-spacing: 1px; font-weight: 700; color: #1749c7; }
  .shop { font-size: 20px; font-weight: 800; color: #10202E; }
  .date { color: #595959; font-size: 13px; }
  .status { display: inline-block; background: #e8f3ff; color: #1749c7; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
  .status.pending { background: #fff3d6; color: #a67c00; }
  .line { height: 3px; background: #1749c7; width: 70px; border-radius: 2px; margin: 10px 0 16px; }
  .intro { color: #595959; font-size: 12.5px; margin-bottom: 16px; line-height: 1.6; }
  .sum-title { font-size: 13px; font-weight: 800; color: #1749c7; text-transform: uppercase; letter-spacing: .4px; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #10202E; color: #fff; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; padding: 9px 7px; text-align: left; }
  td { font-size: 12.5px; padding: 8px 7px; border-bottom: 1px solid #dce9f5; }
  tr:nth-child(even) td { background: #f6f8fb; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row td { background: #e8f3ff !important; font-weight: 800; border-top: 2px solid #2bb6c9; border-bottom: none; font-size: 13.5px; color: #1749c7; }
  .warn-row td { background: #fff3d6 !important; font-weight: 800; border-top: 2px solid #c9a227; }
  .meta { color: #595959; font-size: 12px; line-height: 1.7; margin-top: 14px; }
  .footer { margin-top: 22px; font-size: 10px; color: #9aa7b3; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div>
      <div class="brand">NEO SMARTCORE</div>
      <div class="shop">${esc(rec.shopName)}</div>
      <div class="date">${esc(rec.date)} &nbsp;·&nbsp; ${statusBadge}</div>
    </div>
  </div>
  <div class="line"></div>
  <div class="intro">
    <b>Full Day Report — ${esc(rec.date)}</b><br/>
    Alifungua na stock ya ${fmt(rec.openingStockValue)}; alipokea stock ya ${fmt(rec.receivingTotal)} ambayo
    huenda iliongeza pesa; na alifunga siku na stock ya ${fmt(rec.salesRevenue)} (sales). Expected cash ni
    Sales − Expenses. Pesa iliyokabidhiwa kwa admin inalinganishwa na hic expected cash.
  </div>

  <div class="sum-title">Stock &amp; Cash Movement</div>
  <table>
    <tr><td>Opening stock value (goods in hand)</td><td class="num">${fmt(rec.openingStockValue)}</td></tr>
    <tr><td>Stock received (may have added money to till)</td><td class="num">${fmt(rec.receivingTotal)}</td></tr>
    <tr><td>Stock closed (sales revenue)</td><td class="num">+ ${fmt(rec.salesRevenue)}</td></tr>
    <tr><td>Expenses (money out from till)</td><td class="num">− ${fmt(rec.expensesTotal)}</td></tr>
    <tr class="total-row"><td>EXPECTED CASH</td><td class="num">${fmt(rec.expectedCash)}</td></tr>
  </table>

  <div class="sum-title">Cash Handed Over &amp; Comment</div>
  <table>
    <tr><td>Cash handed over to admin</td><td class="num">${fmt(rec.countedCash)}</td></tr>
    ${adjustmentRow}
    <tr class="${rec.variance === 0 ? 'total-row' : 'warn-row'}">
      <td>${esc(varianceText)}</td>
      <td class="num">${rec.variance === 0 ? fmt(0) : `${rec.variance < 0 ? '−' : '+'} ${fmt(Math.abs(rec.variance))}`}</td>
    </tr>
  </table>

  <div class="meta">
    ${managerName ? `Prepared by: <b>${esc(managerName)}</b><br/>` : ''}
    ${rec.note ? `Note: <b>${esc(rec.note)}</b><br/>` : ''}
    Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })}
  </div>
  <div class="footer">Neo SmartCore · JSL FastLine Technologies — auto-generated day accounting report</div>
</body>
</html>`;

    const base64res = await Print.printToFileAsync({
      html,
      base64: true,
    });
    if (base64res?.base64) {
      return await sharePdfBase64(
        base64res.base64,
        `day-accounting-${rec.date}`,
        `Day Accounting — ${rec.shopName} — ${rec.date}`
      );
    }
    return { ok: false, message: 'printToFileAsync did not return base64 output.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed to create PDF.' };
  }
}