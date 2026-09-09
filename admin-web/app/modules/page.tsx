'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, MoonStar, Banknote, Receipt, Truck, ScrollText, UserCog, Bell } from 'lucide-react';
import { useLang } from '../../lib/i18n';
import { isSessionAuthed } from '../../lib/db';

const MODULE_KEYS = [
  { key: 'stock', icon: Boxes },
  { key: 'closing', icon: MoonStar },
  { key: 'cash', icon: Banknote },
  { key: 'expenses', icon: Receipt },
  { key: 'transfers', icon: Truck },
  { key: 'audit', icon: ScrollText },
  { key: 'users', icon: UserCog },
  { key: 'notifs', icon: Bell },
] as const;

export default function ModulesPage() {
  const router = useRouter();
  const { t } = useLang();

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSessionAuthed()) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>{t('mod.line')}</p>

      <div className="module-grid">
        {MODULE_KEYS.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.key} className="module-card">
              <div className="module-icon">
                <Icon size={20} strokeWidth={1.8} color="var(--accent-deep)" />
              </div>
              <h3>{t(`mod.${m.key}`)}</h3>
              <p>{t(`mod.${m.key}.desc`)}</p>
              <div style={{ marginTop: 10 }}>
                <span className="badge badge-pending">{t('mod.build')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}