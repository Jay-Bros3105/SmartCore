'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ClipboardCheck, Eye } from 'lucide-react';
import {
  approveClosing,
  listClosingReports,
  subscribe,
  type ClosingReport,
} from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { useLang } from '../../lib/i18n';

export default function ClosingsPage() {
  const router = useRouter();
  const { t } = useLang();
  const [closings, setClosings] = useState<ClosingReport[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setClosings(await listClosingReports());
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

  const handleApprove = async (c: ClosingReport) => {
    if (busyId) return;
    setBusyId(c.id);
    const res = await approveClosing(c.id);
    setBusyId(null);
    if (!res.ok) {
      window.alert(res.message ?? 'Failed to approve.');
      return;
    }
    load();
  };

  const pending = closings.filter((c) => c.status === 'pending_admin');

  return (
    <div>
      {pending.length > 0 && (
        <div className="alert alert-amber" style={{ marginBottom: 16 }}>
          <strong>{pending.length}</strong> {t('closings.alert')}
        </div>
      )}

      <div className="card">
        <div className="stat-label" style={{ marginBottom: 12 }}>
          <ClipboardCheck size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t('closings.all')}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('closings.shop')}</th>
                <th>{t('closings.date')}</th>
                <th>{t('closings.manager')}</th>
                <th>{t('closings.items')}</th>
                <th>{t('closings.total')}</th>
                <th>{t('closings.status')}</th>
                <th>{t('closings.action')}</th>
                <th>{t('closings.preview')}</th>
              </tr>
            </thead>
            <tbody>
              {closings.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    {t('closings.empty')}
                  </td>
                </tr>
              ) : (
                closings
                  .slice()
                  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                  .map((c) => (
                    <tr
                      key={c.id}
                      style={c.status === 'pending_admin' ? { background: 'rgba(242,169,59,0.05)' } : undefined}
                    >
                      <td><strong>{c.shopName}</strong></td>
                      <td style={{ fontSize: 12 }}>{c.date}</td>
                      <td style={{ fontSize: 14 }}>{c.managerName ?? '—'}</td>
                      <td>{c.items.length}</td>
                      <td><strong>{(c.totalRevenue ?? 0).toLocaleString('en-US')} TSh</strong></td>
                      <td>
                        <span
                          className={`badge ${
                            c.status === 'approved' ? 'badge-ok' : 'badge-pending'
                          }`}
                        >
                          {c.status === 'approved' ? t('closings.approved') : t('closings.pending')}
                        </span>
                      </td>
                      <td>
                        {c.status === 'pending_admin' ? (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={busyId === c.id}
                            onClick={() => handleApprove(c)}
                          >
                            <Check size={14} /> {busyId === c.id ? '…' : t('closings.approve')}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {t('closings.done')}
                          </span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/closings/preview?id=${encodeURIComponent(c.id)}`}
                          className="btn btn-outline btn-sm"
                          style={{ textDecoration: 'none' }}
                        >
                          <Eye size={14} /> {t('closings.preview')}
                        </Link>
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