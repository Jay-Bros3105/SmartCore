'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Boxes } from 'lucide-react';
import { getOpeningDoc, isSessionAuthed, type OpeningStockDoc } from '../../../lib/db';
import { useLang } from '../../../lib/i18n';

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export default function OpeningPreviewPage() {
  const router = useRouter();
  const { t } = useLang();
  const [doc, setDoc] = useState<OpeningStockDoc | null>(null);

  const load = useCallback(async (id: string) => {
    setDoc(await getOpeningDoc(id));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSessionAuthed()) {
      router.replace('/login');
      return;
    }
    const q = new URLSearchParams(window.location.search).get('id');
    if (q) load(q);
  }, [router, load]);

  return (
    <div>
      <div className="card">
        <Link href="/openings" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
          <ArrowLeft size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
          {t('openings.back')}
        </Link>

        {!doc ? (
          <p style={{ color: 'var(--muted)', padding: 20 }}>{t('openings.notFound')}</p>
        ) : (
          <>
            <div className="stat-label" style={{ marginBottom: 4 }}>
              <Boxes size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {t('openings.previewTitle')}
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
              <strong>{doc.shopName}</strong> — {t('openings.date')}: {doc.date} · {t('openings.time')}: {fmtTime(doc.createdAt)}
            </p>

            <table className="table">
              <thead>
                <tr>
                  <th>{t('closings.items')}</th>
                  <th>{t('stock.pcs')}</th>
                  <th>{t('stock.price')}</th>
                  <th>{t('stock.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                      {t('openings.noItems')}
                    </td>
                  </tr>
                ) : (
                  doc.items.map((it, i) => (
                    <tr key={`${it.name}-${i}`}>
                      <td>{it.name}</td>
                      <td>{it.qty}</td>
                      <td>{it.price.toLocaleString('en-US')} TSh</td>
                      <td>{(it.qty * it.price).toLocaleString('en-US')} TSh</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', marginTop: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', marginRight: 10 }}>
                {t('openings.stockT')}:
              </span>
              <strong>{doc.total.toLocaleString('en-US')} TSh</strong>
            </div>

            <div style={{ marginTop: 14 }}>
              <span className={`badge ${doc.status === 'confirmed' ? 'badge-ok' : 'badge-pending'}`}>
                {doc.status === 'confirmed' ? t('openings.confirmed') : t('openings.generated')}
              </span>
              {doc.managerConfirmedByName ? (
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>
                  {t('openings.confirmedBy')}: {doc.managerConfirmedByName}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}