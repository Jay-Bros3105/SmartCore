import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { LOGO_DATA_URI } from './logoDataUri';
import type { ClosingStock, OpeningStock } from '../services/types';

/** Writes the PDF bytes to our own cache file then shares a `file://` URL.
 *  (Expo Go's expo-sharing REQUIRES scheme `file`, otherwise it throws
 *  "expected scheme to be 'file', got 'content'". The cache dir is an
 *  allowed path, so this also avoids "not allowed to read file under given URL".) */
export async function sharePdfBase64(
  base64: string,
  fileName: string,
  title: string
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'Sharing not available on this device.' };
    }
    const dest = `${FileSystem.cacheDirectory}${fileName}.pdf`;
    await FileSystem.writeAsStringAsync(dest, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const shareUri = dest.startsWith('file://') ? dest : `file://${dest}`;
    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      dialogTitle: title,
      UTI: 'com.adobe.pdf',
    });
    return { ok: true, message: 'PDF shared' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed to share PDF.' };
  }
}

/**
 * Tolea PDF ya sales report (Closing Stock) — inaonekana kama
 *  "history ya mauzo" kama alivyoeleza: kolomu kamili + logo + duka.
 *  Inatumika na admin (app + WhatsApp).
 */
export async function shareClosingSalesPdf(opts: {
  closing: ClosingStock;
  managerName?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const { closing, managerName } = opts;
    const logo = LOGO_DATA_URI;
    const logoHtml = logo
      ? `<img src="${logo}" alt="Logo" style="width:54px;height:54px;object-fit:contain;border-radius:8px;" />`
      : '';

    const rows = closing.items
      .map(
        (it, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(it.name)}</td>
        <td class="num">${it.current}</td>
        <td class="num">${it.sold}</td>
        <td class="num">${it.remaining}</td>
        <td class="num">${fmt(it.revenue)}</td>
      </tr>`
      )
      .join('');

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
  .status { display: inline-block; background: #e8f3ff; color: #1749c7; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; letter-spacing: .3px; }
  .line { height: 3px; background: #1749c7; width: 70px; border-radius: 2px; margin: 10px 0 16px; }
  .intro { color: #595959; font-size: 12.5px; margin-bottom: 16px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #10202E; color: #fff; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; padding: 9px 7px; text-align: left; }
  td { font-size: 12.5px; padding: 8px 7px; border-bottom: 1px solid #dce9f5; }
  tr:nth-child(even) td { background: #f6f8fb; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row td { background: #e8f3ff !important; font-weight: 800; border-top: 2px solid #2bb6c9; border-bottom: none; font-size: 13.5px; color: #1749c7; }
  .meta { color: #595959; font-size: 12px; line-height: 1.7; margin-top: 14px; }
  .footer { margin-top: 22px; font-size: 10px; color: #9aa7b3; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div>
      <div class="brand">NEO SMARTCORE</div>
      <div class="shop">${esc(closing.shopName)}</div>
      <div class="date">${esc(closing.date)} &nbsp;·&nbsp; <span class="status">${closing.status === 'approved' ? 'Approved' : 'Submitted'}</span></div>
    </div>
  </div>
  <div class="line"></div>
  <div class="intro">
    <b>Sales Report for ${esc(closing.date)}</b> — ${esc(closing.shopName)}<br/>
    Items opened in the morning, sold during the day, and remaining at close.
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Item</th>
        <th class="num">Opening</th>
        <th class="num">Sold Out</th>
        <th class="num">Remaining</th>
        <th class="num">Revenue (TSh)</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="6" style="text-align:center;color:#595959;padding:24px;">No items recorded.</td></tr>`}
      <tr class="total-row">
        <td colspan="5" class="num">TOTAL REVENUE</td>
        <td class="num">${fmt(closing.totalRevenue)}</td>
      </tr>
    </tbody>
  </table>
  <div class="meta">
    ${managerName ? `Prepared by: <b>${esc(managerName)}</b><br/>` : ''}
    Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })}
  </div>
  <div class="footer">Neo SmartCore · JSL FastLine Technologies — auto-generated sales report</div>
</body>
</html>`;

    const base64res = await Print.printToFileAsync({
      html,
      base64: true,
    });
    if (base64res?.base64) {
      return await sharePdfBase64(base64res.base64, `sales-${closing.date}`, `Sales Report — ${closing.shopName} — ${closing.date}`);
    }
    return { ok: false, message: 'printToFileAsync did not return base64 output.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed to create PDF.' };
  }
}

/** PDF ya Opening Stock — iliyothibitishwa na msimamizi. */
export async function shareOpeningStockPdf(opts: {
  opening: Pick<OpeningStock, 'shopName' | 'date' | 'items' | 'total' | 'status'>;
  managerName?: string;
  extraLine?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const { opening, managerName, extraLine } = opts;
    const logo = LOGO_DATA_URI;
    const logoHtml = logo
      ? `<img src="${logo}" alt="Logo" style="width:54px;height:54px;object-fit:contain;border-radius:8px;" />`
      : '';

    const rows = opening.items
      .map(
        (it, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(it.name)}</td>
        <td class="num">${it.qty}</td>
        <td class="num">${fmt(it.qty * it.price)}</td>
      </tr>`
      )
      .join('');

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
  .line { height: 3px; background: #1749c7; width: 70px; border-radius: 2px; margin: 10px 0 16px; }
  .intro { color: #595959; font-size: 12.5px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #10202E; color: #fff; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; padding: 9px 7px; text-align: left; }
  td { font-size: 12.5px; padding: 8px 7px; border-bottom: 1px solid #dce9f5; }
  tr:nth-child(even) td { background: #f6f8fb; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row td { background: #e8f3ff !important; font-weight: 800; border-top: 2px solid #2bb6c9; border-bottom: none; font-size: 13.5px; color: #1749c7; }
  .meta { color: #595959; font-size: 12px; line-height: 1.7; margin-top: 14px; }
  .footer { margin-top: 22px; font-size: 10px; color: #9aa7b3; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div>
      <div class="brand">NEO SMARTCORE</div>
      <div class="shop">${esc(opening.shopName)}</div>
      <div class="date">${esc(opening.date)} ${extraLine ? `— ${esc(extraLine)}` : ''}</div>
    </div>
  </div>
  <div class="line"></div>
  <div class="intro"><b>Opening Stock — ${esc(opening.date)}</b></div>
  <table>
    <thead>
      <tr><th style="width:30px">#</th><th>Item</th><th class="num">Quantity</th><th class="num">Total Price (TSh)</th></tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="4" style="text-align:center;color:#595959;padding:24px;">No items.</td></tr>`}
      <tr class="total-row"><td colspan="3" class="num">GRAND TOTAL</td><td class="num">${fmt(opening.total)}</td></tr>
    </tbody>
  </table>
  <div class="meta">
    ${managerName ? `Prepared by: <b>${esc(managerName)}</b><br/>` : ''}
    Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })}
  </div>
  <div class="footer">Neo SmartCore · JSL FastLine Technologies — auto-generated stock report</div>
</body>
</html>`;

    const base64res = await Print.printToFileAsync({
      html,
      base64: true,
    });
    if (base64res?.base64) {
      return await sharePdfBase64(base64res.base64, `opening-${opening.date}`, `Opening Stock — ${opening.shopName}`);
    }
    return { ok: false, message: 'printToFileAsync did not return base64 output.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed to create PDF.' };
  }
}

/** @deprecated Use shareClosingSalesPdf or shareOpeningStockPdf. */
export async function shareStockPdf(opts: {
  kind: 'OPENING STOCK' | 'CLOSING STOCK';
  stock: Pick<OpeningStock, 'shopName' | 'date' | 'items' | 'total'> & { status: string };
  managerName?: string;
  extraLine?: string;
}): Promise<{ ok: boolean; message: string }> {
  return shareOpeningStockPdf({
    opening: { ...opts.stock, status: opts.stock.status as OpeningStock['status'] },
    managerName: opts.managerName,
    extraLine: opts.extraLine,
  });
}

function fmt(n: number): string {
  return `TSh ${Number(n || 0).toLocaleString('en-US')}`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}