'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Eye, Layers } from 'lucide-react';
import { listOpenings, subscribe, isSessionAuthed, type OpeningStockDoc } from '../../lib/db';
import { useLang } from '../../lib/i18n';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Siku HALISI (kwa saa za msimamizi) ambayo opening ilifunguliwa — sio label ya
 *  document (label inaweza kuwa na tarehe ya kesho kwa sababu ya kufunguliwa
 *  mara nyingi kwa siku moja). Hii ndiyo inayotumika kugawa rows. */
function dayKeyOf(doc: OpeningStockDoc): string {
  if (doc.createdAt) {
    const d = new Date(doc.createdAt);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
  }
  return doc.date;
}

type Group = { key: string; docs: OpeningStockDoc[] };

export default function OpeningsPage() {
  const router = useRouter();
  const { t } = useLang();
  const [rows, setRows] = useState<OpeningStockDoc[]>([]);

  const load = useCallback(async () => {
    setRows(await listOpenings());
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

  const groups = useMemo<Group[]>(() => {
    const sorted = [...rows].sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date));
    const map = new Map<string, OpeningStockDoc[]>();
    for (const doc of sorted) {
      const key = dayKeyOf(doc);
      const arr = map.get(key) ?? [];
      arr.push(doc);
      map.set(key, arr);
    }
    return [...map.entries()]
      .map(([key, docs]) => ({ key, docs }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [rows]);

  return (
    <div>
      <div className="card">
        <div className="stat-label" style={{ marginBottom: 4 }}>
          <CalendarDays size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t('openings.title')}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>{t('openings.sub')}</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('openings.date')}</th>
                <th>{t('openings.time')}</th>
                <th>{t('closings.shop')}</th>
                <th>{t('openings.stockT')}</th>
                <th>{t('openings.status')}</th>
                <th>{t('openings.preview')}</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    {t('openings.empty')}
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <React.Fragment key={g.key}>
                    {g.docs.map((r, idx) => (
                      <tr key={r.id}>
                        {idx === 0 && (
                          <td
                            rowSpan={g.docs.length}
                            style={{ fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Layers size={14} style={{ color: 'var(--muted)' }} />
                              {fmtDate(g.key)}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>
                              {g.docs.length} {g.docs.length === 1 ? t('openings.doc') : t('openings.docs')}
                            </div>
                          </td>
                        )}
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fmtTime(r.createdAt)}</td>
                        <td><strong>{r.shopName}</strong></td>
                        <td><strong>{r.total.toLocaleString('en-US')} TSh</strong></td>
                        <td>
                          <span className={`badge ${r.status === 'confirmed' ? 'badge-ok' : 'badge-pending'}`}>
                            {r.status === 'confirmed' ? t('openings.confirmed') : t('openings.generated')}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/openings/preview?id=${encodeURIComponent(r.id)}`}
                            className="btn btn-outline btn-sm"
                            style={{ textDecoration: 'none' }}
                          >
                            <Eye size={14} /> {t('openings.preview')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}