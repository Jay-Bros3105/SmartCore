'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Trash2, ClipboardList } from 'lucide-react';
import {
  listRegistrations,
  updateRegistration,
  deleteRegistration,
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
                        <div style={{ display: 'flex', gap: 6 }}>
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