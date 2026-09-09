'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import { ArrowLeft, Download } from 'lucide-react';
import { getClosingReport, type ClosingReport } from '../../../lib/db';
import { isSessionAuthed } from '../../../lib/db';
import { useLang } from '../../../lib/i18n';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatHeadingDate(iso: string): string {
  if (!iso) return iso;
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (Number.isNaN(y) || m < 0 || m > 11 || Number.isNaN(d)) return iso;
  return `${MONTHS[m]} ${d}`;
}

function fmt(n: number): string {
  return `TSh ${Number(n || 0).toLocaleString('en-US')}`;
}

async function iconDataUri(): Promise<string> {
  try {
    const resp = await fetch('/NeoSmartCore_Icon.png');
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

export default function ClosingPreviewPage() {
  const router = useRouter();
  const { t } = useLang();
  const [id, setId] = useState<string | null>(null);
  const [closing, setClosing] = useState<ClosingReport | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSessionAuthed()) {
      router.replace('/login');
      return;
    }
    const q = new URLSearchParams(window.location.search).get('id');
    if (q) setId(q);
  }, [router]);

  const load = useCallback(async (cid: string) => {
    const c = await getClosingReport(cid);
    if (!c) {
      setNotFound(true);
      setClosing(null);
      return;
    }
    setClosing(c);
  }, []);

  useEffect(() => {
    if (id) load(id);
  }, [id, load]);

  const handleDownload = async () => {
    if (!closing || busy) return;
    setBusy(true);
    try {
      const logo = await iconDataUri();
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 16;

      if (logo) {
        try {
          doc.addImage(logo, 'PNG', margin, y - 2, 11, 11);
        } catch {
          /* icon haisomeki — endelea bila logo */
        }
      }

      doc.setFont('times', 'bold');
      doc.setFontSize(13);
      doc.text('NEO SMARTCORE', margin + (logo ? 14 : 0), y + 2);

      doc.setFontSize(22);
      doc.text(
        closing.shopName || '',
        margin + (logo ? 14 : 0),
        y + 10,
        { maxWidth: pageW - margin - (logo ? 14 : 0) }
      );

      doc.setFont('times', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(90);
      doc.text(
        `${closing.date} · ${closing.status === 'approved' ? 'Approved' : 'Submitted'}`,
        margin + (logo ? 14 : 0),
        y + 15
      );
      doc.setTextColor(16, 32, 46);

      y += 20;
      doc.setDrawColor(23, 73, 199);
      doc.setLineWidth(0.8);
      doc.line(margin, y, pageW - margin, y);
      y += 7;

      doc.setFont('times', 'bold');
      doc.setFontSize(13);
      doc.text(`Closing Stock Of ${formatHeadingDate(closing.date)}`, margin, y);
      y += 5;
      doc.setFont('times', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(90);
      doc.text(
        `${closing.shopName || ''} — items opened in the morning, sold during the day, and remaining at close.`,
        margin,
        y
      );
      doc.setTextColor(16, 32, 46);
      y += 6;

      const colX = [margin, margin + 16, margin + 70, margin + 104, margin + 140, pageW - margin - 34];
      const colW = [14, 52, 32, 34, 34, 34];
      const colNames = ['#', 'Item', 'Opening', 'Sold Out', 'Remaining', 'Revenue (TSh)'];

      const rowHeight = 7;
      let top = y + 4;
      const bottom = 285;

      const drawHeader = () => {
        doc.setFillColor(16, 32, 46);
        doc.rect(margin, top, pageW - margin * 2, rowHeight, 'F');
        doc.setFont('times', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255);
        colNames.forEach((name, i) => {
          const align = i === 0 || i === 1 ? 'left' : 'right';
          doc.text(name, colX[i] + (align === 'left' ? 2 : colW[i] - 2), top + 4.8, {
            align: align as 'left' | 'right',
          });
        });
        doc.setTextColor(16, 32, 46);
        doc.setFont('times', 'normal');
        top += rowHeight;
      };
      drawHeader();

      closing.items.forEach((it, i) => {
        if (top > bottom) {
          doc.addPage();
          top = 16;
          drawHeader();
        }
        if (i % 2 === 1) {
          doc.setFillColor(246, 248, 251);
          doc.rect(margin, top, pageW - margin * 2, rowHeight, 'F');
        }
        const row = [String(i + 1), it.name, String(it.current), String(it.sold), String(it.remaining), it.revenue.toLocaleString('en-US')];
        doc.setFontSize(9.5);
        row.forEach((val, c) => {
          const align = c === 0 || c === 1 ? 'left' : 'right';
          doc.text(val, colX[c] + (align === 'left' ? 2 : colW[c] - 2), top + 4.8, {
            align: align as 'left' | 'right',
          });
        });
        doc.setDrawColor(220, 233, 245);
        doc.setLineWidth(0.2);
        doc.line(margin, top + rowHeight, pageW - margin, top + rowHeight);
        top += rowHeight;
      });

      if (top > bottom) {
        doc.addPage();
        top = 20;
      }
      doc.setFillColor(232, 243, 255);
      doc.rect(margin, top, pageW - margin * 2, rowHeight, 'F');
      doc.setFont('times', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(23, 73, 199);
      doc.text('TOTAL REVENUE', colX[1], top + 4.8);
      doc.text(fmt(closing.totalRevenue ?? 0), pageW - margin - 2, top + 4.8, { align: 'right' });
      doc.setTextColor(16, 32, 46);
      top += rowHeight + 8;

      doc.setFont('times', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(90);
      if (closing.managerName) doc.text(`Prepared by: ${closing.managerName}`, margin, top);
      top += 6;
      doc.text(
        `Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })}`,
        margin,
        top
      );

      doc.setFontSize(8);
      doc.setTextColor(154, 167, 179);
      doc.text('Neo SmartCore · JSL FastLine Technologies — auto-generated sales report', pageW / 2, 292, {
        align: 'center',
      });

      doc.save(`Closing-Stock-${closing.shopName || 'Shop'}-${closing.date}.pdf`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not generate the PDF.');
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Closing report not found.
        <div style={{ marginTop: 16 }}>
          <a href="/closings" style={{ color: 'var(--accent)' }}>← {t('closings.all')}</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <a href="/closings" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={14} /> {t('closings.all')}
        </a>
        <button
          className="btn btn-primary"
          onClick={handleDownload}
          disabled={busy || !closing}
        >
          <Download size={14} /> {busy ? 'Preparing…' : t('closings.download')}
        </button>
      </div>

      {closing && (
        <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/NeoSmartCore_Icon.png"
              alt="Neo SmartCore"
              style={{ width: 54, height: 54, objectFit: 'contain' }}
            />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 1, color: '#1749c7' }}>
                NEO SMARTCORE
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, color: '#10202e' }}>
                {closing.shopName}
              </div>
              <div style={{ fontSize: 12, color: '#595959' }}>
                {closing.date} ·{' '}
                <span
                  className={`badge ${closing.status === 'approved' ? 'badge-ok' : 'badge-pending'}`}
                >
                  {closing.status === 'approved' ? t('closings.approved') : t('closings.pending')}
                </span>
              </div>
            </div>
          </div>

          <div style={{ height: 3, background: '#1749c7', width: 70, borderRadius: 2, margin: '14px 0 18px' }} />

          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#10202e', marginBottom: 4 }}>
            Closing Stock Of {formatHeadingDate(closing.date)}
          </h2>
          <div style={{ fontSize: 12, color: '#595959', marginBottom: 12 }}>
            {closing.shopName} — items opened in the morning, sold during the day, and remaining at close.
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Opening</th>
                  <th style={{ textAlign: 'right' }}>Sold Out</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th style={{ textAlign: 'right' }}>Revenue (TSh)</th>
                </tr>
              </thead>
              <tbody>
                {closing.items.map((it, i) => (
                  <tr key={`${it.name}-${i}`}>
                    <td>{i + 1}</td>
                    <td><strong>{it.name}</strong></td>
                    <td style={{ textAlign: 'right' }}>{it.current}</td>
                    <td style={{ textAlign: 'right' }}>{it.sold}</td>
                    <td style={{ textAlign: 'right' }}>{it.remaining}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(it.revenue)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#e8f3ff', fontWeight: 800, color: '#1749c7' }}>
                  <td colSpan={5} style={{ textAlign: 'right' }}>TOTAL REVENUE</td>
                  <td style={{ textAlign: 'right' }}>{fmt(closing.totalRevenue ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12, color: '#595959', marginTop: 14, lineHeight: 1.7 }}>
            {closing.managerName ? `Prepared by: ${closing.managerName}` : ''}
            <br />
            Generated: {new Date().toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })}
          </div>
        </div>
      )}
    </div>
  );
}