'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, Send, Receipt, CheckCircle2, Clock } from 'lucide-react';
import {
  approveExpense,
  approveStockReceiving,
  approveStockRequest,
  listExpenses,
  listStockReceiving,
  listStockRequests,
  subscribe,
  formatTsh,
  type ExpenseRow,
  type StockReceivingRow,
  type StockRequestRow,
} from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { useLang } from '../../lib/i18n';

type Tab = 'receiving' | 'requests' | 'expenses';

function fmtDate(key: string) {
  const d = new Date(key + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function TransactionsPage() {
  const router = useRouter();
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>('receiving');
  const [receiving, setReceiving] = useState<StockReceivingRow[]>([]);
  const [requests, setRequests] = useState<StockRequestRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, q, e] = await Promise.all([listStockReceiving(), listStockRequests(), listExpenses()]);
    setReceiving(r);
    setRequests(q);
    setExpenses(e);
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

  const sortRows = <T extends { date: string; submittedAt?: string }>(rows: T[]) =>
    [...rows].sort((a, b) => (b.submittedAt || b.date).localeCompare(a.submittedAt || a.date));

  const sortedReceiving = useMemo(() => sortRows(receiving), [receiving]);
  const sortedRequests = useMemo(() => sortRows(requests), [requests]);
  const sortedExpenses = useMemo(() => sortRows(expenses), [expenses]);

  const pendingCount = (rows: { status: string }[]) => rows.filter((r) => r.status !== 'approved').length;

  const doApprove = async (
    row: StockReceivingRow | StockRequestRow | ExpenseRow,
    kind: Tab
  ) => {
    let title = t('tx.approveReceivingTitle');
    let body = t('tx.approveReceivingBody').replace('{shop}', row.shopName).replace('{date}', row.date);
    if (kind === 'requests') {
      title = t('tx.approveRequestTitle');
      body = t('tx.approveRequestBody').replace('{shop}', row.shopName).replace('{date}', row.date);
    }
    if (kind === 'expenses') {
      title = t('tx.approveExpenseTitle');
      body = t('tx.approveExpenseBody')
        .replace('{shop}', row.shopName)
        .replace('{total}', formatTsh(row.total))
        .replace('{date}', row.date);
    }
    if (!window.confirm(title + '\n' + body)) return;
    setBusy(row.id);
    try {
      if (kind === 'receiving') await approveStockReceiving(row.id);
      else if (kind === 'requests') await approveStockRequest(row.id);
      else await approveExpense(row.id);
      load();
    } catch {
      window.alert(t('tx.failed'));
    } finally {
      setBusy(null);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`badge ${status === 'approved' ? 'badge-ok' : 'badge-pending'}`}>
      {status === 'approved' ? (
        <><CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{t('tx.approved')}</>
      ) : (
        <><Clock size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{t('tx.pending')}</>
      )}
    </span>
  );

  return (
    <div>
      <div className="card">
        <div className="stat-label" style={{ marginBottom: 4 }}>
          <Boxes size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t('tx.title')}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>{t('tx.sub')}</p>

        {/* Segments */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              ['receiving', t('tx.receiving'), Boxes],
              ['requests', t('tx.requests'), Send],
              ['expenses', t('tx.expenses'), Receipt],
            ] as [Tab, string, typeof Boxes][]
          ).map(([k, label, Icon]) => {
            const count = k === 'receiving' ? pendingCount(receiving) : k === 'requests' ? pendingCount(requests) : pendingCount(expenses);
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`btn ${tab === k ? 'btn-primary' : 'btn-outline'} btn-sm`}
              >
                <Icon size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                {label}
                {count > 0 && <span className="badge badge-danger" style={{ marginLeft: 8 }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {tab === 'receiving' && (
          <table className="table">
            <thead>
              <tr>
                <th>{t('tx.date')}</th>
                <th>{t('tx.shop')}</th>
                <th>{t('tx.items')}</th>
                <th className="num-cell">{t('tx.total')}</th>
                <th>{t('tx.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedReceiving.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('tx.emptyReceiving')}</td></tr>
              ) : (
                sortedReceiving.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.shopName}</td>
                    <td>
                      {r.items.map((it) => (
                        <div key={it.name} style={{ fontSize: 12.5 }}>
                          <strong>{it.name}</strong> × {it.qty} · <span style={{ color: 'var(--muted)' }}>{formatTsh(it.price * it.qty)}</span>
                        </div>
                      ))}
                      {r.note && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{t('tx.note')}: {r.note}</div>}
                      <div style={{ fontSize: 10.5, color: 'var(--accent-deep)', marginTop: 2 }}>{t('tx.addsToStock')}</div>
                    </td>
                    <td className="num-cell"><strong>{formatTsh(r.total)}</strong></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      {r.status === 'approved' ? (
                        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{t('tx.approved')}</span>
                      ) : (
                        <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => doApprove(r, 'receiving')}>
                          {busy === r.id ? t('tx.approving') : t('tx.approve')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {tab === 'requests' && (
          <table className="table">
            <thead>
              <tr>
                <th>{t('tx.date')}</th>
                <th>{t('tx.shop')}</th>
                <th>{t('tx.items')}</th>
                <th className="num-cell">{t('tx.estimatedValue')}</th>
                <th>{t('tx.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedRequests.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('tx.emptyRequests')}</td></tr>
              ) : (
                sortedRequests.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.shopName}</td>
                    <td>
                      {r.items.map((it) => (
                        <div key={it.name} style={{ fontSize: 12.5 }}>
                          <strong>{it.name}</strong> × {it.qty}
                        </div>
                      ))}
                      {r.reason && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{t('tx.reason')}: {r.reason}</div>}
                    </td>
                    <td className="num-cell"><strong>{formatTsh(r.total)}</strong></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      {r.status === 'approved' ? (
                        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{t('tx.approved')}</span>
                      ) : (
                        <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => doApprove(r, 'requests')}>
                          {busy === r.id ? t('tx.approving') : t('tx.approve')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {tab === 'expenses' && (
          <table className="table">
            <thead>
              <tr>
                <th>{t('tx.date')}</th>
                <th>{t('tx.shop')}</th>
                <th>{t('tx.purpose')}</th>
                <th className="num-cell">{t('tx.total')}</th>
                <th>{t('tx.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('tx.emptyExpenses')}</td></tr>
              ) : (
                sortedExpenses.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.shopName}</td>
                    <td>
                      {r.items.map((it, i) => (
                        <div key={i} style={{ fontSize: 12.5 }}>
                          <strong>{it.description}</strong>
                          {it.category ? <span className="badge" style={{ marginLeft: 6 }}>{it.category}</span> : null}
                          <span style={{ color: 'var(--muted)' }}> · {formatTsh(it.amount)}</span>
                        </div>
                      ))}
                    </td>
                    <td className="num-cell"><strong>{formatTsh(r.total)}</strong></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      {r.status === 'approved' ? (
                        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{t('tx.approved')}</span>
                      ) : (
                        <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => doApprove(r, 'expenses')}>
                          {busy === r.id ? t('tx.approving') : t('tx.approve')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        <style jsx>{`.num-cell { text-align: right; font-variant-numeric: tabular-nums; }`}</style>
      </div>
    </div>
  );
}