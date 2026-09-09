'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Eye } from 'lucide-react';
import { listOpeningRows, subscribe, type OpeningRow } from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { useLang } from '../../lib/i18n';

export default function OpeningsPage() {
  const router = useRouter();
  const { t } = useLang();
  const [rows, setRows] = useState<OpeningRow[]>([]);

  const load = useCallback(async () => {
    setRows(await listOpeningRows());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSessionAuthed()) {
      router.replace('/login');
      return;
    }
    load();
    const unsub = subscribe(load);
    return unsub;
  }, [router, load]);

  return (
    <div>
      <div className="card">
        <div className="stat-label" style={{ marginBottom: 4 }}>
          <CalendarDays size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t('openings.title')}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>{t('openings.sub')}</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('openings.date')}</th>
                <th>{t('closings.shop')}</th>
                <th>{t('openings.revenue')}</th>
                <th>{t('closings.status')}</th>
                <th>{t('closings.preview')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    {t('openings.empty')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.date + r.shopId}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td><strong>{r.shopName}</strong></td>
                    <td><strong>{r.totalRevenue.toLocaleString('en-US')} TSh</strong></td>
                    <td>
                      <span className={`badge ${r.approved ? 'badge-ok' : 'badge-pending'}`}>
                        {r.approved ? t('closings.approved') : t('closings.pending')}
                      </span>
                    </td>
                    <td>
                      {r.closingId ? (
                        <Link
                          href={`/closings/preview?id=${encodeURIComponent(r.closingId)}`}
                          className="btn btn-outline btn-sm"
                          style={{ textDecoration: 'none' }}
                        >
                          <Eye size={14} /> {t('closings.preview')}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}