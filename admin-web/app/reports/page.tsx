'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, CalendarDays, Eye, TrendingUp, Wallet } from 'lucide-react';
import {
  listClosingReports,
  listShops,
  listExpenses,
  listStockReceiving,
  listStockRequests,
  listCashReconciliations,
  subscribe,
  formatTsh,
  type ClosingReport,
  type Shop,
  type ExpenseRow,
  type StockReceivingRow,
  type StockRequestRow,
  type CashReconciliationRow,
} from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { useLang } from '../../lib/i18n';

type Pt = { label: string; value: number };

function FrequencyPolygon({ points }: { points: Pt[] }) {
  const W = 660;
  const H = 280;
  const padL = 48;
  const padR = 22;
  const padT = 24;
  const padB = 52;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const spanW = Math.max(W, points.length * 48);
  const max = Math.max(1, ...points.map((p) => p.value));
  const niceMax = Math.ceil(max / Math.max(1, Math.pow(10, String(Math.round(max)).length - 1))) * Math.pow(10, String(Math.round(max)).length - 1) || max;
  const step = plotH / 4;
  const x = (i: number) => (points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (Math.min(v, niceMax) / niceMax) * plotH;

  const line = points
    .map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');

  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <div style={{ minWidth: spanW }}>
        <svg viewBox={`0 0 ${spanW} ${H}`} width="100%" height="auto" role="img" aria-label="Frequency polygon of sold items">
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="#f8fbff" stroke="#dce9f5" />
          {[0, 1, 2, 3, 4].map((g) => {
            const gy = padT + step * g;
            const v = niceMax - (niceMax / 4) * g;
            return (
              <g key={g}>
                <line x1={padL} y1={gy} x2={padL + plotW} y2={gy} stroke="#dce9f5" strokeDasharray="4 4" />
                <text x={padL - 8} y={gy + 4} textAnchor="end" fontSize={10} fill="#595959">
                  {Math.round(v)}
                </text>
              </g>
            );
          })}
          {points.map((p, i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 14}
              textAnchor="middle"
              fontSize={10}
              fill="#10202E"
              transform={`rotate(-22 ${x(i)} ${H - 14})`}
            >
              {p.label.length > 14 ? p.label.slice(0, 13) + '…' : p.label}
            </text>
          ))}
          <polyline points={line} fill="none" stroke="#2bb6c9" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.value)} r={4.5} fill="#1749c7" stroke="#fff" strokeWidth={1.5} />
              <text x={x(i)} y={y(p.value) - 9} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1749c7">
                {p.value}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

type DaySummary = {
  revenue: number;
  expenses: number;
  receiving: number;
  requests: number;
  purchases: number;
  rec?: CashReconciliationRow;
};

function summarize(shopId: string, day: string, closings: ClosingReport[], expenses: ExpenseRow[], receiving: StockReceivingRow[], requests: StockRequestRow[], recs: CashReconciliationRow[]): DaySummary {
  const closing = closings.find((c) => c.shopId === shopId && c.date === day);
  const expensesTotal = expenses
    .filter((e) => e.shopId === shopId && e.date === day)
    .reduce((s, e) => s + (e.total || 0), 0);
  const receivingTotal = receiving
    .filter((r) => r.shopId === shopId && r.date === day)
    .reduce((s, r) => s + (r.total || 0), 0);
  const requestsTotal = requests
    .filter((r) => r.shopId === shopId && r.date === day)
    .reduce((s, r) => s + (r.total || 0), 0);
  return {
    revenue: closing?.totalRevenue ?? 0,
    expenses: expensesTotal,
    receiving: receivingTotal,
    requests: requestsTotal,
    purchases: receivingTotal + requestsTotal,
    rec: recs.find((r) => r.shopId === shopId && r.date === day),
  };
}

function DayMetric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="card" style={{ padding: '14px 16px', background: 'var(--surface-alt)' }}>
      <div className="stat-label" style={{ fontSize: 12 }}>{label}</div>
      <div className={`stat-value ${strong ? 'stat-value-accent' : ''}`} style={{ fontSize: '1.3rem', marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { t } = useLang();
  const [shops, setShops] = useState<Shop[]>([]);
  const [closings, setClosings] = useState<ClosingReport[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [receiving, setReceiving] = useState<StockReceivingRow[]>([]);
  const [requests, setRequests] = useState<StockRequestRow[]>([]);
  const [recs, setRecs] = useState<CashReconciliationRow[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, c, e, rv, rq, rc] = await Promise.all([
      listShops(),
      listClosingReports(),
      listExpenses(),
      listStockReceiving(),
      listStockRequests(),
      listCashReconciliations(),
    ]);
    setShops(s);
    setClosings(c);
    setExpenses(e);
    setReceiving(rv);
    setRequests(rq);
    setRecs(rc);
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

  const shopClosings = useMemo(
    () =>
      closings
        .filter((c) => c.shopId === shopId)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [closings, shopId]
  );

  const days = useMemo(() => Array.from(new Set(shopClosings.map((c) => c.date))), [shopClosings]);
  const activeDay = date ?? days[0] ?? null;
  const activeClosing = shopClosings.find((c) => c.date === activeDay) ?? null;
  const activeSummary = useMemo(
    () => (shopId && activeDay ? summarize(shopId, activeDay, closings, expenses, receiving, requests, recs) : null),
    [shopId, activeDay, closings, expenses, receiving, requests, recs]
  );

  const graphPoints: Pt[] = useMemo(
    () => (activeClosing ? activeClosing.items.map((it) => ({ label: it.name, value: it.sold })) : []),
    [activeClosing]
  );

  const selectShop = (sid: string) => {
    setShopId(sid);
    setDate(null);
  };

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>{t('rep.daily')} · {t('rep.daily.shops')} · {t('rep.day.auto')}</p>

      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {shops.map((s) => {
          const count = closings.filter((c) => c.shopId === s.id).length;
          const selected = s.id === shopId;
          return (
            <div
              key={s.id}
              onClick={() => selectShop(s.id)}
              className="card"
              style={{
                cursor: 'pointer',
                border: selected ? '2px solid var(--accent)' : undefined,
                background: selected ? 'var(--surface-alt)' : undefined,
              }}
            >
              <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Store size={15} color="var(--accent-deep)" />
                {s.name}
              </div>
              <div className="stat-value" style={{ fontSize: '1.4rem' }}>{count}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('closings.date')} · {t('closings.items')}</div>
            </div>
          );
        })}
      </div>

      {!shopId ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', marginTop: 20 }}>
          <div className="module-icon" style={{ width: 60, height: 60, margin: '0 auto 14px' }}>
            <Store size={28} strokeWidth={1.7} color="var(--accent-deep)" />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>{t('rep.daily.pick')}</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginTop: 20 }}>
            <div className="stat-label" style={{ marginBottom: 6 }}>
              <TrendingUp size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {t('rep.daily.graph')}
              {activeClosing && (
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                  {' '}· {t('rep.daily.day')}: <strong>{activeDay}</strong>
                </span>
              )}
            </div>

            {days.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 16px' }}>
                {days.map((d) => (
                  <button
                    key={d}
                    className={d === activeDay ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                    onClick={() => setDate(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            {graphPoints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: '0.85rem' }}>
                {t('rep.daily.empty')}
              </div>
            ) : (
              <FrequencyPolygon points={graphPoints} />
            )}
          </div>

          {activeSummary && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="stat-label" style={{ marginBottom: 12 }}>
                <Wallet size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                {t('rep.day.title')}
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {t('rep.daily.day')}: <strong>{activeDay}</strong></span>
              </div>
              <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
                <DayMetric label={t('rep.day.sales')} value={formatTsh(activeSummary.revenue)} strong />
                <DayMetric label={t('rep.day.expenses')} value={formatTsh(activeSummary.expenses)} />
                <DayMetric label={t('rep.day.receiving')} value={formatTsh(activeSummary.receiving)} />
                <DayMetric label={t('rep.day.requests')} value={formatTsh(activeSummary.requests)} />
                <DayMetric label={t('rep.day.purchases')} value={formatTsh(activeSummary.purchases)} />
              </div>
              {activeSummary.rec ? (
                <>
                  <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', marginTop: 12 }}>
                    <DayMetric label={t('rep.day.opening')} value={formatTsh(activeSummary.rec.openingCash)} />
                    <DayMetric label={t('rep.day.moneyIn')} value={formatTsh(activeSummary.rec.cashIn)} />
                    <DayMetric label={t('rep.day.moneyOut')} value={formatTsh(activeSummary.rec.moneyOut)} />
                    <DayMetric label={t('rep.day.expected')} value={formatTsh(activeSummary.rec.expectedCash)} strong />
                    <DayMetric label={t('rep.day.counted')} value={formatTsh(activeSummary.rec.countedCash)} strong />
                    <DayMetric label={t('rep.day.adjustment')} value={formatTsh(activeSummary.rec.adminAdjustment ?? 0)} />
                  </div>
                  <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, color: '#fff', fontWeight: 700, background: activeSummary.rec.variance === 0 ? 'var(--ok,#2e9e5b)' : activeSummary.rec.variance < 0 ? 'var(--danger,#d64545)' : 'var(--warn,#d98a2b)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('rep.day.variance')}</span>
                    <span>{formatTsh(activeSummary.rec.variance)}</span>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0 0' }}>{t('rep.day.none')}</p>
              )}
            </div>
          )}

          <div className="card" style={{ marginTop: 20, overflowX: 'auto' }}>
            <div className="stat-label" style={{ marginBottom: 12 }}>
              <CalendarDays size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {t('rep.daily.history')}
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('closings.date')}</th>
                  <th className="stock-num">{t('rep.daily.revenue')}</th>
                  <th className="stock-num">{t('rep.day.expenses')}</th>
                  <th className="stock-num">{t('rep.day.purchases')}</th>
                  <th className="stock-num">{t('rep.day.counted')}</th>
                  <th className="stock-num">{t('rep.day.variance')}</th>
                  <th>{t('closings.status')}</th>
                  <th>{t('closings.preview')}</th>
                </tr>
              </thead>
              <tbody>
                {shopClosings.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      {t('rep.daily.empty')}
                    </td>
                  </tr>
                ) : (
                  shopClosings.map((c) => {
                    const sum = summarize(c.shopId, c.date, closings, expenses, receiving, requests, recs);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setDate(c.date)}
                        style={{ cursor: 'pointer', background: c.date === activeDay ? 'rgba(43,182,201,0.08)' : undefined }}
                      >
                        <td style={{ fontWeight: 600 }}>{c.date}</td>
                        <td className="stock-num">
                          <strong>{formatTsh(c.totalRevenue ?? 0)}</strong>
                        </td>
                        <td className="stock-num">{sum.expenses ? formatTsh(sum.expenses) : t('rep.day.notReported')}</td>
                        <td className="stock-num">{sum.purchases ? formatTsh(sum.purchases) : t('rep.day.notReported')}</td>
                        <td className="stock-num">{sum.rec ? formatTsh(sum.rec.countedCash) : t('rep.day.notReported')}</td>
                        <td className="stock-num">
                          {sum.rec ? (
                            <span style={{ color: sum.rec.variance === 0 ? 'var(--ok,#2e9e5b)' : sum.rec.variance < 0 ? 'var(--danger,#d64545)' : 'var(--warn,#d98a2b)', fontWeight: 700 }}>
                              {formatTsh(sum.rec.variance)}
                            </span>
                          ) : t('rep.day.notReported')}
                        </td>
                        <td>
                          <span className={`badge ${c.status === 'approved' ? 'badge-ok' : 'badge-pending'}`}>
                            {c.status === 'approved' ? t('closings.approved') : t('closings.pending')}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/closings/preview?id=${encodeURIComponent(c.id)}`}
                            className="btn btn-outline btn-sm"
                            style={{ textDecoration: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye size={14} /> {t('closings.preview')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <style jsx>{`.stock-num { text-align: right; font-variant-numeric: tabular-nums; }`}</style>
          </div>
        </>
      )}
    </div>
  );
}