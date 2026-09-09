'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WalletCards, ArrowUpDown, CheckCircle2, Clock } from 'lucide-react';
import {
  approveCashReconciliation,
  listCashReconciliations,
  subscribe,
  formatTsh,
  type CashReconciliationRow,
} from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { useLang } from '../../lib/i18n';

function fmtDate(key: string) {
  const d = new Date(key + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function ReconcilePage() {
  const router = useRouter();
  const { t } = useLang();
  const [rows, setRows] = useState<CashReconciliationRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<Record<string, string>>({});

  const parseNum = (v: string) => {
    const n = Number(v.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const baseExpected = (r: CashReconciliationRow) => r.expectedCash - (r.adminAdjustment ?? 0);
  const previewAdjust = (r: CashReconciliationRow) => parseNum(adjust[r.id] ?? '');
  const previewExpected = (r: CashReconciliationRow) => baseExpected(r) + previewAdjust(r);
  const previewVariance = (r: CashReconciliationRow) => r.countedCash - previewExpected(r);

  const load = useCallback(async () => {
    setRows(await listCashReconciliations());
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

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.shopName.localeCompare(b.shopName)),
    [rows]
  );

  const approved = rows.filter((r) => r.status === 'approved').length;
  const pending = rows.length - approved;
  const shortages = rows.filter((r) => r.varianceKind === 'shortage').length;

  const handleApprove = async (r: CashReconciliationRow) => {
    const adj = previewAdjust(r);
    if (!window.confirm(t('reconcile.approvalTitle') + '\n' + t('reconcile.approvalBody').replace('{date}', r.date))) return;
    setBusy(r.id);
    try {
      await approveCashReconciliation(r.id, adj !== 0 ? adj : undefined);
      load();
    } catch {
      window.alert(t('reconcile.failed'));
    } finally {
      setBusy(null);
    }
  };

  const kindProps = (k: CashReconciliationRow['varianceKind']) =>
    k === 'matched'
      ? { cls: 'badge-ok', txt: t('reconcile.matched') }
      : k === 'shortage'
        ? { cls: 'badge-danger', txt: t('reconcile.shortage') }
        : { cls: 'badge-warn', txt: t('reconcile.overage') };

  return (
    <div>
      <div className="card">
        <div className="stat-label" style={{ marginBottom: 4 }}>
          <WalletCards size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t('reconcile.title')}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>{t('reconcile.desc')}</p>
      </div>

      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="card">
          <div className="stat-label">{t('reconcile.pending')}</div>
          <div className="stat-value">{pending}</div>
        </div>
        <div className="card">
          <div className="stat-label">{t('reconcile.approved')}</div>
          <div className="stat-value">{approved}</div>
        </div>
        <div className="card" style={{ borderColor: shortages ? 'var(--danger)' : undefined }}>
          <div className="stat-label">{t('reconcile.shortage')}</div>
          <div className="stat-value" style={{ color: shortages ? 'var(--danger)' : undefined }}>{shortages}</div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('reconcile.date')}</th>
              <th>{t('reconcile.shop')}</th>
              <th className="num-cell">{t('reconcile.expected')}</th>
              <th className="num-cell">{t('reconcile.counted')}</th>
              <th className="num-cell">{t('reconcile.variance')}</th>
              <th>{t('reconcile.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                  {t('reconcile.empty')}
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const kind = kindProps(r.varianceKind);
                const adj = previewAdjust(r);
                const expPreview = previewExpected(r);
                const varPreview = previewVariance(r);
                return (
                  <React.Fragment key={r.id}>
                  <tr>
                    <td>{fmtDate(r.date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.shopName}</td>
                    <td className="num-cell">{formatTsh(r.expectedCash)}</td>
                    <td className="num-cell">{formatTsh(r.countedCash)}</td>
                    <td className="num-cell">
                      <span
                        className={`badge ${kind.cls}`}
                        style={{ color: r.variance === 0 ? undefined : r.variance < 0 ? 'var(--danger)' : 'var(--warn)' }}
                      >
                        {r.variance > 0 ? '+' : ''}{formatTsh(r.variance)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${r.status === 'approved' ? 'badge-ok' : 'badge-pending'}`}>
                        {r.status === 'approved' ? (
                          <><CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{t('reconcile.approved')}</>
                        ) : (
                          <><Clock size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{t('reconcile.pending')}</>
                        )}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm"
                        style={{
                          background: 'transparent',
                          color: 'var(--primary)',
                          boxShadow: 'none',
                          padding: '4px 0',
                          marginRight: 10,
                        }}
                        onClick={() => setDetailId(detailId === r.id ? null : r.id)}
                      >
                        {t('reconcile.details')} {detailId === r.id ? '▲' : '▼'}
                      </button>
                      {r.status === 'approved' ? (
                        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                          <ArrowUpDown size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                          {t('reconcile.approved')}
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busy === r.id}
                          onClick={() => handleApprove(r)}
                        >
                          {busy === r.id ? t('reconcile.approving') : t('reconcile.approve')}
                        </button>
                      )}
                    </td>
                  </tr>
                  {detailId === r.id && (
                    <tr>
                      <td colSpan={7} style={{ backgroundColor: 'var(--bg, #f8fafc)', padding: '14px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--primary)' }}>
                          {t('reconcile.details')} · {r.shopName} · {fmtDate(r.date)}
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 10,
                          }}
                        >
                          <table className="table" style={{ minWidth: 260, width: '100%' }}>
                            <tbody>
                              <tr><td>{t('reconcile.opening')}</td><td className="num-cell">{formatTsh(r.openingCash)}</td></tr>
                              <tr><td>{t('reconcile.sales')}</td><td className="num-cell">+ {formatTsh(r.salesRevenue)}</td></tr>
                              <tr><td>{t('reconcile.cashIn')}</td><td className="num-cell">+ {formatTsh(r.cashIn)}</td></tr>
                              <tr><td>{t('reconcile.cashOut')}</td><td className="num-cell">− {formatTsh(r.cashOut)}</td></tr>
                              <tr><td>{t('reconcile.expenses')}</td><td className="num-cell">− {formatTsh(r.expensesTotal)}</td></tr>
<tr><td>{t('reconcile.receiving')}</td><td className="num-cell">{formatTsh(r.receivingTotal)}</td></tr>
<tr><td>{t('reconcile.requests')}</td><td className="num-cell">{formatTsh(r.requestTotal)}</td></tr>
<tr>
  <td colSpan={2} style={{ fontSize: 11, color: 'var(--muted)', paddingTop: 2 }}>
    {t('reconcile.stockInSales')}
  </td>
</tr>
                              <tr><td>{t('reconcile.totalMoneyOut')}</td><td className="num-cell">− {formatTsh(r.moneyOut)}</td></tr>
                              <tr>
                                <td style={{ fontWeight: 800 }}>{t('reconcile.expected')}</td>
                                <td className="num-cell" style={{ fontWeight: 800 }}>{formatTsh(r.expectedCash)}</td>
                              </tr>
                              <tr><td>{t('reconcile.counted')}</td><td className="num-cell">{formatTsh(r.countedCash)}</td></tr>
                            </tbody>
                          </table>
                          <div style={{ minWidth: 240 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{t('reconcile.variance')}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: r.variance === 0 ? 'var(--ok)' : r.variance < 0 ? 'var(--danger)' : 'var(--warn)' }}>
                              {r.variance > 0 ? '+' : ''}{formatTsh(r.variance)}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 4px' }}>
                              {t('reconcile.adjustment')}
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={adjust[r.id] ?? (r.adminAdjustment ? String(r.adminAdjustment) : '')}
                              onChange={(e) => setAdjust((p) => ({ ...p, [r.id]: e.target.value }))}
                              placeholder={r.adminAdjustment ? String(r.adminAdjustment) : '0'}
                              style={{
                                padding: '7px 10px',
                                border: '1px solid var(--border, #dce9f5)',
                                borderRadius: 8,
                                fontSize: 13,
                                width: '100%',
                                maxWidth: 220,
                              }}
                            />
                            <div style={{ fontSize: 11, color: 'var(--muted)', margin: '6px 0 8px' }}>
                              {t('reconcile.adjustmentHint')}
                            </div>
                            {(adj !== 0 || r.adminAdjustment) && (
                              <div
                                style={{
                                  fontSize: 13,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  background: 'var(--bg, #f8fafc)',
                                  border: '1px dashed var(--border, #dce9f5)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{t('reconcile.expected')}</span>
                                  <b>{formatTsh(expPreview)}</b>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{t('reconcile.variance')}</span>
                                  <b style={{ color: varPreview === 0 ? 'var(--ok)' : varPreview < 0 ? 'var(--danger)' : 'var(--warn)' }}>
                                    {varPreview > 0 ? '+' : ''}{formatTsh(varPreview)}
                                  </b>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                  {t('reconcile.adjustApplied')}
                                </div>
                              </div>
                            )}
                            {r.note && (
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                                <b>{t('reconcile.note')}:</b> {r.note}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
        <style jsx>{`.num-cell { text-align: right; font-variant-numeric: tabular-nums; }`}</style>
      </div>
    </div>
  );
}