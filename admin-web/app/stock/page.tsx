'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, Plus, Minus, Trash2, Save, AlertTriangle, Pencil, X } from 'lucide-react';
import {
  getCurrentStock,
  listProducts,
  listShops,
  saveCurrentStock,
  type CurrentStockItem,
  type Product,
  type Shop,
} from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { useLang } from '../../lib/i18n';

function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function StockPage() {
  const router = useRouter();
  const { t } = useLang();
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState('');
  const [date, setDate] = useState(todayKey());
  const [items, setItems] = useState<CurrentStockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [addName, setAddName] = useState('');
  const [addQty, setAddQty] = useState('1');
  const [addPrice, setAddPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [editMode, setEditMode] = useState(false);

  const loadShopStock = useCallback(
    async (sid: string, d: string) => {
      if (!sid) return;
      setProducts(await listProducts(sid));
      const stk = await getCurrentStock(sid, d);
      setItems(stk?.items ?? []);
      setEditMode(false);
    },
    []
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSessionAuthed()) {
      router.replace('/login');
      return;
    }
    listShops().then((shopsArr) => {
      setShops(shopsArr);
      if (shopsArr.length > 0) {
        const first = shopsArr[0].id;
        setShopId(first);
        loadShopStock(first, todayKey());
      }
    });
  }, [router, loadShopStock]);

  const selectShop = (sid: string) => {
    setShopId(sid);
    setSavedMsg('');
    loadShopStock(sid, date);
  };

  const selectDate = (d: string) => {
    setDate(d);
    setSavedMsg('');
    if (shopId) loadShopStock(shopId, d);
  };

  const setQty = (name: string, raw: string) => {
    const qty = Math.max(0, Math.floor(Number(raw.replace(/[^0-9]/g, '')) || 0));
    setSavedMsg('');
    setItems((prev) => prev.map((it) => (it.name === name ? { ...it, qty } : it)));
  };

  const bumpQty = (name: string, delta: number) => {
    setSavedMsg('');
    setItems((prev) =>
      prev.map((it) => {
        if (it.name !== name) return it;
        return { ...it, qty: Math.max(0, it.qty + delta) };
      })
    );
  };

  const removeItem = (name: string) => {
    setSavedMsg('');
    setItems((prev) => prev.filter((it) => it.name !== name));
  };

  const addFromProduct = (name: string, price: number) => {
    setSavedMsg('');
    setItems((prev) => {
      const found = prev.find((it) => it.name === name);
      if (found) {
        return prev.map((it) => (it.name === name ? { ...it, qty: it.qty + 1 } : it));
      }
      return [...prev, { name, qty: 1, price }];
    });
  };

  const addManual = () => {
    const name = addName.trim();
    const qty = Number(addQty || 0);
    const price = Number(addPrice || 0);
    if (!name || qty < 1) return;
    setSavedMsg('');
    setItems((prev) => {
      const found = prev.find((it) => it.name === name);
      if (found) {
        return prev.map((it) => (it.name === name ? { ...it, qty: it.qty + qty, price } : it));
      }
      return [...prev, { name, qty, price }];
    });
    setAddName('');
    setAddQty('1');
    setAddPrice('');
  };

  const handleSave = async () => {
    if (!shopId || !window.confirm(t('stock.confirmSave'))) return;
    const shop = shops.find((s) => s.id === shopId);
    setSaving(true);
    await saveCurrentStock(shopId, shop?.name ?? 'Shop', date, items);
    setSaving(false);
    setEditMode(false);
    setSavedMsg(t('stock.saved'));
  };

  const handleCancel = () => {
    setEditMode(false);
    setSavedMsg('');
    if (shopId) loadShopStock(shopId, date);
  };

  const totalValue = items.reduce((s, it) => s + it.qty * it.price, 0);
  const addable = products.filter((p) => !items.some((it) => it.name === p.name));

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Boxes size={16} style={{ color: 'var(--accent)' }} />
          <span className="stat-label" style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
            {t('stock.title')}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{t('stock.desc')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
          <div className="form-group">
            <label className="form-label">{t('stock.shop')}</label>
            <select className="form-select" value={shopId} onChange={(e) => selectShop(e.target.value)}>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('stock.date')}</label>
            <input type="date" className="form-input" value={date} onChange={(e) => selectDate(e.target.value)} />
          </div>
        </div>

        <div className="alert alert-amber" style={{ marginBottom: 0, marginTop: 12 }}>
          <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t('stock.auto')}
        </div>
      </div>

      {editMode && (
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="card">
            <div className="stat-label" style={{ marginBottom: 12 }}>{t('stock.add.product')}</div>
            {addable.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                {t('stock.empty')}
              </p>
            ) : (
              <select
                className="form-select"
                value=""
                onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  if (p) addFromProduct(p.name, p.price);
                  e.currentTarget.value = '';
                }}
              >
                <option value="">— {t('stock.add')} —</option>
                {addable.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.price.toLocaleString('en-US')} TSh</option>
                ))}
              </select>
            )}
          </div>

          <div className="card">
            <div className="stat-label" style={{ marginBottom: 12 }}>{t('stock.add.manual')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                className="form-input"
                placeholder={t('stock.manual.name')}
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
                <input
                  className="form-input"
                  placeholder={t('stock.manual.qty')}
                  inputMode="numeric"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value.replace(/[^0-9]/g, ''))}
                />
                <input
                  className="form-input"
                  placeholder={t('stock.manual.price')}
                  inputMode="numeric"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
              <button className="btn btn-primary btn-sm" onClick={addManual}>
                <Plus size={14} /> {t('stock.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <span className="stat-label" style={{ color: 'var(--text)', fontWeight: 600 }}>{t('stock.title')} — {date}</span>
          {editMode ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={handleCancel} disabled={saving}>
                <X size={14} /> {t('stock.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? t('stock.saving') : t('stock.save')}
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => setEditMode(true)}>
              <Pencil size={14} /> {t('stock.edit')}
            </button>
          )}
        </div>

        {!editMode && !savedMsg && (
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
            {t('stock.editHint')}
          </p>
        )}

        {savedMsg && (
          <div className="alert alert-ok" style={{ padding: 12, marginBottom: 16 }}>
            {savedMsg}
          </div>
        )}

        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', padding: 20, textAlign: 'center' }}>
            {t('stock.none')}
          </p>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('stock.hdr.item')}</th>
                  <th style={{ width: editMode ? 210 : 120 }}>{t('stock.hdr.qty')}</th>
                  <th className="stock-num">{t('stock.hdr.price')}</th>
                  <th className="stock-num">{t('stock.hdr.total')}</th>
                  {editMode && <th style={{ width: 110 }}></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.name}>
                    <td><strong>{it.name}</strong></td>
                    <td>
                      {editMode ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => bumpQty(it.name, -1)} title={t('stock.dec')}>
                            <Minus size={12} />
                          </button>
                          <input
                            className="form-input"
                            inputMode="numeric"
                            value={String(it.qty)}
                            onChange={(e) => setQty(it.name, e.target.value)}
                            style={{ width: 72, textAlign: 'center', padding: '6px 8px' }}
                          />
                          <button className="btn btn-outline btn-sm" onClick={() => bumpQty(it.name, 1)} title={t('stock.inc')}>
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{it.qty}</span>
                      )}
                    </td>
                    <td className="stock-num">{it.price.toLocaleString('en-US')}</td>
                    <td className="stock-num"><strong>{(it.qty * it.price).toLocaleString('en-US')} TSh</strong></td>
                    {editMode && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => removeItem(it.name)}
                            style={{ color: 'var(--danger)', borderColor: 'rgba(220,53,69,0.4)' }}
                            title={t('stock.delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 700 }}>{t('stock.total')}</td>
                  <td></td>
                  <td></td>
                  <td className="stock-num" style={{ fontWeight: 800, color: 'var(--accent)' }}>
                    {totalValue.toLocaleString('en-US')} TSh
                  </td>
                  {editMode && <td></td>}
                </tr>
              </tfoot>
            </table>
            <style jsx>{`.stock-num { text-align: right; font-variant-numeric: tabular-nums; }`}</style>
          </>
        )}
      </div>
    </div>
  );
}