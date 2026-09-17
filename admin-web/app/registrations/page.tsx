'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Trash2, ClipboardList, MoreVertical, Store } from 'lucide-react';
import {
  listRegistrations,
  updateRegistration,
  deleteRegistration,
  addShop,
  subscribe,
  type ManagerRegistration,
} from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { badgeClass } from '../../lib/data';
import { useLang } from '../../lib/i18n';

export default function RegistrationsPage() {
  const router = useRouter();
  const { t } = useLang();
  const [regs, setRegs] = useState<ManagerRegistration[]>([]);
  const [menuReg, setMenuReg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRegs(await listRegistrations());
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

  const toggle = (id: string, status: ManagerRegistration['status']) => {
    updateRegistration(id, status);
    load();
  };

  const assignMoreShop = async (r: ManagerRegistration) => {
    const name = (window.prompt(`Jina la duka la pili kwa ${r.fullName}:`, `${r.region || 'SmartCore'} Branch`) || '').trim();
    if (!name) return;
    setMenuReg(null);
    try {
      await addShop({ name, address: '', region: r.region || 'mwanza', location: null, managerName: r.fullName });
    } catch (e) { setError(String(e)); }
    load();
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(t('reg.del.confirm', { name }))) return;
    deleteRegistration(id);
    load();
  };

  const pending = regs.filter((r) => r.status === 'pending');
  const pendingMsg = t('reg.alert').replace('{n}', String(pending.length));

  return (
    <div>
      {pending.length > 0 && (
        <div className="alert alert-amber"><strong>{pending.length}</strong> {pendingMsg}</div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="stat-label" style={{ marginBottom: 8 }}>
          <ClipboardList size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{t('reg.all')}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('reg.name')}</th>
                <th>{t('reg.phone')}</th>
                <th>{t('reg.shop')}</th>
                <th>{t('reg.date')}</th>
                <th>{t('reg.status')}</th>
                <th>{t('reg.action')}</th>
              </tr>
            </thead>
            <tbody>
              {regs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    {t('reg.empty')}
                  </td>
                </tr>
              ) : (
                regs
                  .slice()
                  .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
                  .map((r) => (
                    <tr key={r.userId} style={r.status === 'pending' ? { background: 'rgba(242,169,59,0.05)' } : undefined}>
                      <td><strong>{r.fullName}</strong></td>
                      <td>{r.phone}</td>
                      <td>{r.branchName}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(r.registeredAt).toLocaleDateString()}</td>
                      <td><span className={`badge ${badgeClass(r.status)}`}>{r.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ position: 'relative', display: 'inline-flex' }}>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => setMenuReg(menuReg === r.userId ? null : r.userId)}
                              aria-label="Actions"
                              title="Actions"
                              style={{ display: 'inline-flex', alignItems: 'center', padding: 6, background: 'none', border: 0, borderRadius: 6, cursor: 'pointer', color: 'var(--muted)' }}
                            >
                              <MoreVertical size={18} />
                            </button>
                            {menuReg === r.userId && (
                              <div className="card" style={{ position: 'absolute', right: 0, top: 32, zIndex: 30, minWidth: 185, padding: 6, borderRadius: 10, boxShadow: 'var(--shadow)' }}>
                                {r.status === 'pending' ? (
                                  <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 6, background: 'none', border: 0, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: 'var(--danger)' }}
                                    onClick={() => { setMenuReg(null); toggle(r.userId, 'rejected'); }}>
                                    <X size={14} /> {t('reg.reject')}
                                  </button>
                                ) : (
                                  <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 6, background: 'none', border: 0, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                                    onClick={() => { setMenuReg(null); toggle(r.userId, 'approved'); }}>
                                    <Check size={14} /> {t('reg.approve')}
                                  </button>
                                )}
                                <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 6, background: 'none', border: 0, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, color: 'var(--danger)' }}
                                  onClick={() => { setMenuReg(null); handleDelete(r.userId, r.fullName); }}>
                                  <Trash2 size={14} /> {t('reg.delete')}
                                </button>
                              </div>
                            )}
                          </span>
                          {r.status === 'pending' ? (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => toggle(r.userId, 'approved')}>
                                <Check size={14} /> {t('reg.approve')}
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => toggle(r.userId, 'rejected')}>
                                <X size={14} /> {t('reg.reject')}
                              </button>
                            </>
                          ) : r.status === 'rejected' ? (
                            <button className="btn btn-outline btn-sm" onClick={() => toggle(r.userId, 'approved')}>
                              {t('reg.fix')}
                            </button>
                          ) : (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => toggle(r.userId, 'rejected')}
                              title={t('reg.reset.title')}
                            >
                              <X size={14} /> {t('reg.reset')}
                            </button>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleDelete(r.userId, r.fullName)}
                            title={t('reg.delete')}
                            style={{ color: 'var(--danger)', borderColor: 'rgba(220,53,69,0.4)' }}
                          >
                            <Trash2 size={14} /> {t('reg.delete')}
                          </button>
                        </div>
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