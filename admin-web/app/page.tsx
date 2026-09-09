'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Package, TrendingUp, Users, BarChart3, Clock, ClipboardCheck, WalletCards, ArrowLeftRight } from 'lucide-react';
import {
  listShops,
  listProducts,
  listSales,
  listRegistrations,
  listConfirmedOpenings,
  countPendingCashReconciliations,
  countPendingTransactions,
  topSelling,
  subscribe,
  formatTsh,
  type Shop,
  type Product,
  type SaleTx,
  type ManagerRegistration,
  type OpeningStockDoc,
} from '../lib/db';
import { isSessionAuthed } from '../lib/db';
import { badgeClass } from '../lib/data';
import { useLang } from '../lib/i18n';

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLang();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleTx[]>([]);
  const [regs, setRegs] = useState<ManagerRegistration[]>([]);
  const [confirmations, setConfirmations] = useState<OpeningStockDoc[]>([]);
  const [reconPending, setReconPending] = useState(0);
  const [txPending, setTxPending] = useState(0);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const [s, p, txs, r, c, rc, txc] = await Promise.all([
      listShops(),
      listProducts(),
      listSales(),
      listRegistrations(),
      listConfirmedOpenings(),
      countPendingCashReconciliations(),
      countPendingTransactions(),
    ]);
    setShops(s);
    setProducts(p);
    setSales(txs);
    setRegs(r);
    setConfirmations(c);
    setReconPending(rc);
    setTxPending(txc);
    setReady(true);
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

  const top = topSelling(sales);
  const maxQty = top.length ? top[0].quantity : 0;
  const totalRevenue = sales.reduce((a, s) => a + s.totalPrice, 0);
  const approved = regs.filter((r) => r.status === 'approved').length;
  const pendingRegs = regs.filter((r) => r.status === 'pending');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('dash.greeting.am') : hour < 18 ? t('dash.greeting.pm') : t('dash.greeting.eve');

  if (!ready) return <div className="card" style={{ color: 'var(--muted)' }}>{t('dash.loading')}</div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--navy)',
            margin: 0,
            fontSize: 'clamp(1.15rem, 4.2vw, 1.7rem)',
            lineHeight: 1.25,
            textWrap: 'balance',
          }}
        >
          {greeting}, {t('dash.greeting.you')}
          <span style={{ whiteSpace: 'nowrap' }}>&nbsp;👋</span>
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
          {shops.length === 0
            ? t('dash.empty.line1')
            : `${shops.length} ${t('dash.stat.shops').toLowerCase()}, ${products.length} ${t('dash.stat.products').toLowerCase()}, ${sales.length} sales.`}
        </p>
      </div>

      {shops.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px', marginBottom: 28 }}>
          <div className="module-icon" style={{ width: 64, height: 64, margin: '0 auto 16px' }}>
            <Store size={30} strokeWidth={1.7} color="var(--accent-deep)" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-serif)', margin: '0 0 6px' }}>{t('dash.empty.title')}</h3>
          <p style={{ color: 'var(--muted)', maxWidth: 420, margin: '0 auto 24px', fontSize: '0.88rem' }}>
            {t('dash.empty.desc')}
          </p>
          <a href="/setup" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            {t('dash.empty.cta')}
          </a>
        </div>
      ) : (
        <div className="card-grid">
          <div className="card">
            <div className="stat-label">{t('dash.stat.shops')}</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {shops.filter((s) => s.status === 'active').length} <Store size={20} color="var(--accent-deep)" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dash.stat.shops.sub')}</div>
          </div>
          <div className="card">
            <div className="stat-label">{t('dash.stat.products')}</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {products.length} <Package size={20} color="var(--accent-deep)" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dash.stat.products.sub')}</div>
          </div>
          <div className="card">
            <div className="stat-label">{t('dash.stat.sales')}</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {formatTsh(totalRevenue)} <TrendingUp size={20} color="var(--success)" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('dash.stat.sales.sub')}</div>
          </div>
          <div className="card">
            <div className="stat-label">{t('dash.stat.regs')}</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {approved}{pendingRegs.length ? ` +${pendingRegs.length}` : ''} <Users size={20} color="var(--accent-deep)" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{pendingRegs.length ? `${pendingRegs.length} pending` : ''}</div>
          </div>
        </div>
      )}

      {txPending > 0 && (
        <Link
          href="/transactions"
          style={{ textDecoration: 'none', display: 'block', marginBottom: 24 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: '1px solid var(--accent)',
              background: 'rgba(43,182,201,0.10)',
              borderRadius: 12,
              padding: '14px 18px',
            }}
          >
            <ArrowLeftRight size={18} color="var(--accent-deep)" />
            <div style={{ flex: 1, fontSize: 13, color: 'var(--navy)' }}>
              <strong>{txPending}</strong> {t('dash.tx.pending')}
            </div>
            <span style={{ fontSize: 12, color: 'var(--accent-deep)', fontWeight: 600 }}>{t('nav.transactions')} →</span>
          </div>
        </Link>
      )}

      {reconPending > 0 && (
        <Link
          href="/reconcile"
          style={{ textDecoration: 'none', display: 'block', marginBottom: 24 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: '1px solid var(--warn)',
              background: 'rgba(242,169,59,0.12)',
              borderRadius: 12,
              padding: '14px 18px',
            }}
          >
            <WalletCards size={18} color="var(--warn)" />
            <div style={{ flex: 1, fontSize: 13, color: 'var(--navy)' }}>
              <strong>{reconPending}</strong> {t('dash.recon.pending')}
            </div>
            <span style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}>{t('nav.reconcile')} →</span>
          </div>
        </Link>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="stat-label" style={{ marginBottom: 4 }}>
          <ClipboardCheck size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t('dash.confirm.title')}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>{t('dash.confirm.sub')}</p>
        {confirmations.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            {t('dash.confirm.empty')}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('dash.confirm.shop')}</th>
                <th>{t('dash.confirm.manager')}</th>
                <th>{t('dash.confirm.when')}</th>
              </tr>
            </thead>
            <tbody>
              {confirmations.slice(0, 8).map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.shopName}</strong> <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {c.date}</span></td>
                  <td>{c.managerConfirmedByName || '—'}</td>
                  <td>
                    <span className="badge badge-ok">
                      {new Date(c.confirmedAt ?? '').toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex-row">
        <div className="card flex-1">
          <div className="stat-label" style={{ marginBottom: 4 }}>{t('dash.chart.title')}</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px' }}>{t('dash.chart.sub')}</p>
          {top.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: '0.85rem' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}><BarChart3 size={26} color="var(--muted)" /></div>
              {t('dash.chart.empty')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {top.map((item) => (
                <div key={item.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{ color: 'var(--muted)' }}>{item.quantity} × {formatTsh(item.revenue)}</span>
                  </div>
                  <div style={{ height: 14, background: 'var(--surface-alt)', borderRadius: 7, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(item.quantity / maxQty) * 100}%`,
                        background: 'linear-gradient(90deg,var(--accent-deep),var(--accent))',
                        borderRadius: 7,
                        transition: 'width .3s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card flex-1" style={{ overflow: 'hidden' }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>{t('dash.recent.title')}</div>
          {approved === 0 && pendingRegs.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}><Clock size={26} color="var(--muted)" /></div>
              {t('dash.recent.empty')}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>{t('usr.name')}</th><th>{t('reg.shop')}</th><th>{t('reg.status')}</th></tr>
              </thead>
              <tbody>
                {[...regs].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, 5).map((r) => (
                  <tr key={r.userId}>
                    <td><strong>{r.fullName}</strong></td>
                    <td>{r.branchName}</td>
                    <td><span className={`badge ${badgeClass(r.status)}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}