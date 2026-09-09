'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCog, ShieldCheck, Loader2 } from 'lucide-react';
import { requireAdmin } from '../../lib/firebase';
import { readScope, type AdminScope } from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { useLang } from '../../lib/i18n';

export default function UsersPage() {
  const router = useRouter();
  const { t } = useLang();
  const [admin, setAdmin] = useState<{ email: string | null } | null>(null);
  const [scope, setScope] = useState<AdminScope | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSessionAuthed()) {
      router.replace('/login');
      return;
    }
    // Gate inategemea localStorage flag (kama login). requireAdmin ni best-effort
    // ya kuonyesha email — haifuti kikao ikishindwa (sababu ya ku-logout kwa bahati).
    Promise.all([requireAdmin(), Promise.resolve(readScope())])
      .then(([a, s]) => {
        setAdmin(a);
        setScope(s);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) return <div className="card" style={{ color: 'var(--muted)' }}><Loader2 size={16} className="spin" /> …</div>;

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>{t('usr.line')}</p>
      <div className="card">
        <div className="stat-label" style={{ marginBottom: 8 }}>
          <UserCog size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{t('usr.all')}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('usr.name')}</th>
                <th>{t('usr.phone')}</th>
                <th>{t('usr.role')}</th>
                <th>{t('usr.shop')}</th>
                <th>{t('usr.status')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{scope?.name || 'Admin'}</strong></td>
                <td>—</td>
                <td><span className="badge badge-ok">super_admin</span></td>
                <td>{scope?.regions !== 'all' ? scope?.regions?.join(', ') || '—' : 'All regions'}</td>
                <td><span className="badge badge-ok">
                  <ShieldCheck size={12} style={{ marginRight: 4, verticalAlign: -2 }} />active
                </span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '16px 0 0' }}>{t('usr.soon')}</p>
      </div>
    </div>
  );
}