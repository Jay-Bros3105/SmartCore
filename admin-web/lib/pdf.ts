'use client';

/**
 * Uzalishaji wa PDF — Orodha ya Bidhaa za Duka.
 * - Logo (Neo SmartCore) katikati, kisha jina la duka.
 * - Table: Bidhaa | Bei (Times New Roman).
 */

export type PdfLabels = {
  product: string;
  price: string;
  generated: string;
  total: string;
};

export async function downloadShopPdf(opts: {
  shopName: string;
  subtitle: string;
  products: { name: string; price: number }[];
  labels: PdfLabels;
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const rightX = pageW - margin;

  doc.setFont('times', 'normal');
  doc.setTextColor(25);

  // Logo katikati (kama iko / inafika)
  const logoSize = 66;
  let y = margin;
  try {
    const logo = await loadImageDataUrl('/NeoSmartCore_Icon.png');
    doc.addImage(logo, 'PNG', (pageW - logoSize) / 2, y, logoSize, logoSize);
    y += logoSize + 18;
  } catch {
    y += 6;
  }

  // Jina la duka
  doc.setFont('times', 'bold');
  doc.setFontSize(21);
  doc.text(opts.shopName, pageW / 2, y, { align: 'center' });
  y += 16;

  if (opts.subtitle) {
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(80);
    doc.text(opts.subtitle, pageW / 2, y, { align: 'center' });
    doc.setTextColor(25);
    y += 22;
  }

  // Mstari wa kujitenga
  doc.setLineWidth(1);
  doc.line(margin, y, rightX, y);
  y += 18;

  // Header ya table
  const rows = [...opts.products].sort((a, b) => a.name.localeCompare(b.name));
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text(opts.labels.product, margin, y);
  doc.text(opts.labels.price, rightX, y, { align: 'right' });
  y += 6;
  doc.setLineWidth(0.6);
  doc.line(margin, y, rightX, y);
  y += 20;

  // Rows
  doc.setFont('times', 'normal');
  doc.setFontSize(11.5);
  for (const row of rows) {
    if (y > pageH - 60) {
      doc.addPage();
      y = margin + 10;
    }
    const name = row.name.length > 48 ? `${row.name.slice(0, 47)}…` : row.name;
    doc.text(name, margin, y);
    doc.text(`TSh ${row.price.toLocaleString('en-US')}`, rightX, y, { align: 'right' });
    y += 20;
  }

  // Jumla ya bei
  const total = rows.reduce((a, r) => a + r.price, 0);
  y += 8;
  doc.setLineWidth(0.8);
  doc.line(margin, y, rightX, y);
  y += 20;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text(opts.labels.total, margin, y);
  doc.setFont('times', 'normal');
  doc.text(`TSh ${total.toLocaleString('en-US')}`, rightX, y, { align: 'right' });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(115);
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  doc.text(
    `${opts.labels.generated}: ${dateStr}  ·  Neo SmartCore`,
    pageW / 2,
    pageH - 34,
    { align: 'center' }
  );

  const file = `${opts.shopName.replace(/[^A-Za-z0-9\-_ ]/g, '').trim().replace(/\s+/g, '_')}_Bidhaa.pdf`;
  doc.save(file);
}

async function loadImageDataUrl(src: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('image load failed'));
  });
  const width = img.naturalWidth || 200;
  const height = img.naturalHeight || 200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas context');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}