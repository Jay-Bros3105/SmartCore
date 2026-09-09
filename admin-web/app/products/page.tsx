'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Store, Download, Trash2, Pencil } from 'lucide-react';
import { listShops, listProducts, deleteProduct, updateProduct, subscribe, regionLabel, type Shop, type Product } from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { downloadShopPdf } from '../../lib/pdf';
import { useLang } from '../../lib/i18n';

export default function ProductsPage() {
  const router = useRouter();
  const { t } = useLang();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const productGroups = shops
    .map((shop) => ({
      shop,
      items: products
        .filter((p) => p.branchId === shop.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'en')),
    }))
    .filter((g) => g.items.length > 0);

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

  const doPdf = (shop: Shop, items: Product[]) => {
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
      products: items,
      labels: {
        product: t('pdf.product'),
        price: t('pdf.price'),
        generated: t('pdf.generated'),
        total: t('pdf.total'),
      },
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>{t('prod.line')}</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {editMode && (
            <span className="badge badge-ok" style={{ fontSize: 12 }}>{t('prod.edit.hint')}</span>
          )}
          <button
            type="button"
            className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setEditMode((v) => !v)}
          >
            <Pencil size={14} /> {editMode ? t('prod.done') : t('prod.edit')}
          </button>
        </div>
      </div>

      {productGroups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="module-icon" style={{ width: 60, height: 60, margin: '0 auto 14px' }}>
            <Package size={28} strokeWidth={1.7} color="var(--accent-deep)" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-serif)', margin: '0 0 6px' }}>{t('prod.empty')}</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {productGroups.map((g) => (
            <div key={g.shop.id} className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  paddingBottom: 14,
                  borderBottom: '1px solid var(--border)',
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="module-icon" style={{ width: 36, height: 36 }}>
                    <Store size={18} color="var(--accent-deep)" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.98rem' }}>{g.shop.name}</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {regionLabel(g.shop.region)}
                      {g.shop.address !== '—' ? ` · ${g.shop.address}` : ''} · {g.items.length} {t('prod.items', { n: g.items.length })}
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => doPdf(g.shop, g.items)}>
                  <Download size={14} /> {t('prod.pdf')}
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('prod.product')}</th>
                      <th style={{ width: 160 }}>{t('br.price')}</th>
                      {editMode && <th style={{ width: 130 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((p) => {
                      const draft = drafts[p.id] ?? String(p.price);
                      return (
                        <tr key={p.id}>
                          <td>
                            <Package size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                            {p.name}
                          </td>
                          <td>
                            {editMode ? (
                              <input
                                className="form-input"
                                inputMode="numeric"
                                value={draft}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100%' }}
                              />
                            ) : (
                              `TSh ${p.price.toLocaleString('en-US')}`
                            )}
                          </td>
                          {editMode && (
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
            </div>
          ))}
        </div>
      )}

      {error && <div className="alert alert-amber" style={{ marginTop: 20 }}>{error}</div>}
    </div>
  );
}