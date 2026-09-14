'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Plus, Trash2, ChevronDown, ChevronUp, Package, Download, Pencil } from 'lucide-react';
import {
  listShops,
  listProducts,
  addShop,
  addProducts,
  deleteProduct,
  updateProduct,
  subscribe,
  readScope,
  REGION_OPTIONS,
  regionLabel,
  type Shop,
  type Product,
} from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { downloadShopPdf } from '../../lib/pdf';
import { useLang } from '../../lib/i18n';

export default function BranchesPage() {
  const router = useRouter();
  const [quickOpen, setQuickOpen] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('add') === '1' : false));
  const { t } = useLang();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [openBranch, setOpenBranch] = useState<string | null>(null);
  const [editBranch, setEditBranch] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const [quickName, setQuickName] = useState('');
  const [quickAddress, setQuickAddress] = useState('');
  const [quickRegion, setQuickRegion] = useState(() => {
    const s = readScope();
    return s && s.regions !== 'all' && s.regions[0] ? s.regions[0] : 'mwanza';
  });

  const [bulkText, setBulkText] = useState('');
  const [parsed, setParsed] = useState<{ name: string; price: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([listShops(), listProducts()]);
    setShops(s);
    setProducts(p);
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

  const productsOf = (branchId: string) =>
    products
      .filter((p) => p.branchId === branchId)
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const toggleOpen = (id: string) => {
    setOpenBranch((cur) => (cur === id ? null : id));
    setEditBranch(null);
    setDrafts({});
  };

  const enterEdit = (id: string) => {
    const next = editBranch === id ? null : id;
    setEditBranch(next);
    setDrafts({});
  };

  const commitPrice = async (p: Product, draft: string) => {
    const price = Math.max(0, Number(draft.replace(/,/g, '').trim()) || 0);
    if (price === p.price) return;
    setSaving(true);
    setError('');
    try {
      await updateProduct(p.id, { price });
      setDrafts((prev) => ({ ...prev, [p.id]: String(price) }));
    } catch {
      setError(t('br.err.save'));
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (p: Product) => {
    setError('');
    try {
      await deleteProduct(p.id);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
    } catch {
      setError(t('br.err.save'));
    }
  };

  const doPdf = (shop: Shop) => {
    const subtitle = [
      regionLabel(shop.region),
      shop.address !== '—' ? shop.address : '',
      shop.location?.place ? shop.location.place : '',
    ]
      .filter(Boolean)
      .join(' · ');
    downloadShopPdf({
      shopName: shop.name,
      subtitle,
      products: productsOf(shop.id),
      labels: {
        product: t('pdf.product'),
        price: t('pdf.price'),
        generated: t('pdf.generated'),
        total: t('pdf.total'),
      },
    });
  };

  const splitBulk = () => {
    const parts = bulkText
      .split(/[,;\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    setParsed(parts.map((name) => ({ name, price: '' })));
  };

  const setParsedPrice = (idx: number, price: string) => {
    setParsed((prev) => prev.map((r, i) => (i === idx ? { ...r, price } : r)));
  };

  const saveProducts = async () => {
    if (!openBranch) return;
    setSaving(true);
    setError('');
    try {
      const items = parsed.map((r) => ({ name: r.name, price: Number(r.price) || 0 }));
      await addProducts(openBranch, items);
      setBulkText('');
      setParsed([]);
    } catch {
      setError(t('br.err.save'));
    } finally {
      setSaving(false);
    }
  };

  const quickAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!quickName.trim()) { setError(t('br.err.quick')); return; }
    const shop = await addShop({ name: quickName, address: quickAddress.trim() || '—', region: quickRegion, location: null });
    setQuickName('');
    setQuickAddress('');
    toggleOpen(shop.id);
    setOpenBranch(shop.id);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>{t('br.title.line')}</p>
        <a href="/setup" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          <Plus size={16} /> {t('br.add.map')}
        </a>
      </div>

      {shops.length === 0 || quickOpen ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="module-icon" style={{ width: 60, height: 60, margin: '0 auto 14px' }}>
            <Store size={28} strokeWidth={1.7} color="var(--accent-deep)" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-serif)', margin: '0 0 6px' }}>{t('br.empty.title')}</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 20px' }}>{t('br.empty.desc')}</p>
          <form onSubmit={quickAddShop} style={{ display: 'flex', gap: 8, maxWidth: 560, margin: '0 auto', flexWrap: 'wrap' }}>
            <input className="form-input" placeholder={t('br.quick.ph.name')} value={quickName} onChange={(e) => setQuickName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <input className="form-input" placeholder={t('br.quick.ph.addr')} value={quickAddress} onChange={(e) => setQuickAddress(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <select className="form-input" value={quickRegion} onChange={(e) => setQuickRegion(e.target.value)} style={{ width: 160 }}>
              {REGION_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary"><Plus size={16} /> {t('br.quick.add')}</button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shops.map((shop) => {
            const list = productsOf(shop.id);
            const isOpen = openBranch === shop.id;
            const editing = editBranch === shop.id;
            return (
              <div key={shop.id} className="card" style={{ padding: isOpen ? 20 : 16 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                  onClick={() => toggleOpen(shop.id)}
                >
                  <div>
                    <strong style={{ fontSize: '0.95rem' }}>{shop.name}</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {regionLabel(shop.region)}
                      {shop.address !== '—' ? ` · ${shop.address}` : ''}
                      {shop.location?.place ? ` · ${shop.location.place}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className={`badge ${shop.status === 'active' ? 'badge-ok' : 'badge-danger'}`}>
                      {shop.status} · {list.length} {t('br.bidhaa.toggle')}
                    </span>
                    <span style={{ color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {isOpen ? <><ChevronUp size={16} /> {t('br.cancel')}</> : <><ChevronDown size={16} /> {t('br.bidhaa.toggle')}</>}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div className="stat-label" style={{ margin: 0 }}>
                        {t('br.products.of', { shop: shop.name })}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${editing ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => enterEdit(shop.id)}
                        >
                          <Pencil size={14} /> {editing ? t('prod.done') : t('prod.edit')}
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => doPdf(shop)}>
                          <Download size={14} /> {t('prod.pdf')}
                        </button>
                      </div>
                    </div>

                    {list.length > 0 ? (
                      <div style={{ overflowX: 'auto', marginBottom: editing ? 16 : 0 }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>{t('prod.product')}</th>
                              <th style={{ width: 150 }}>{t('br.price')}</th>
                              {editing && <th style={{ width: 120 }}></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((p) => {
                              const draft = drafts[p.id] ?? String(p.price);
                              return (
                                <tr key={p.id}>
                                  <td><Package size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{p.name}</td>
                                  <td>
                                    {editing ? (
                                      <input
                                        className="form-input"
                                        inputMode="numeric"
                                        value={draft}
                                        onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                        style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100%' }}
                                      />
                                    ) : (
                                      `${p.price.toLocaleString('en-US')}`
                                    )}
                                  </td>
                                  {editing && (
                                    <td>
                                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          disabled={saving || (Number(draft.replace(/,/g, '')) || 0) === p.price}
                                          onClick={() => commitPrice(p, draft)}
                                        >
                                          {t('prod.save')}
                                        </button>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeProduct(p)}>
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: editing ? 16 : 0 }}>
                        {t('prod.empty')}
                      </p>
                    )}

                    {editing && (
                      <div>
                        {editing && (
                          <div className="alert" style={{ background: 'var(--surface-alt)', border: '1px dashed var(--border)', marginBottom: 14, fontSize: '0.8rem' }}>
                            {t('prod.edit.hint')}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <textarea
                            className="form-input"
                            rows={2}
                            placeholder={t('br.batch.ph')}
                            value={bulkText}
                            onChange={(e) => { setBulkText(e.target.value); setParsed([]); }}
                            style={{ resize: 'vertical', fontFamily: 'var(--font)' }}
                          />
                          <div>
                            <button type="button" className="btn btn-outline btn-sm" onClick={splitBulk} disabled={!bulkText.trim()}>
                              {t('br.split')}
                            </button>
                          </div>

                          {parsed.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {parsed.map((row, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ flex: 1, fontSize: '0.85rem', padding: '8px 12px', background: 'var(--surface-alt)', borderRadius: 8 }}>
                                    {row.name}
                                  </span>
                                  <input
                                    className="form-input"
                                    placeholder={t('br.price.ph')}
                                    value={row.price}
                                    onChange={(e) => setParsedPrice(idx, e.target.value)}
                                    inputMode="numeric"
                                    style={{ width: 150 }}
                                  />
                                </div>
                              ))}
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => setParsed([])}>
                                  {t('br.cancel')}
                                </button>
                                <button type="button" className="btn btn-primary btn-sm" onClick={saveProducts} disabled={saving}>
                                  {saving ? t('br.saving') : t('br.save.products', { n: parsed.length })}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="alert alert-amber" style={{ marginTop: 20 }}>{error}</div>}
    </div>
  );
}