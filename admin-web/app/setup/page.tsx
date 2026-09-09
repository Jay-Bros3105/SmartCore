'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store } from 'lucide-react';
import ShopMap from '../../components/ShopMap';
import { addShop, listShops, readScope, REGION_OPTIONS, type Geo } from '../../lib/db';
import { isSessionAuthed } from '../../lib/db';
import { useLang } from '../../lib/i18n';

type Step = 'welcome' | 'shop';

export default function SetupPage() {
  const router = useRouter();
  const { t } = useLang();
  const [step, setStep] = useState<Step>('welcome');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState(() => {
    const s = readScope();
    return s && s.regions !== 'all' && s.regions[0] ? s.regions[0] : '';
  });
  const [geo, setGeo] = useState<Geo>({ lat: 0, lng: 0, place: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSessionAuthed()) {
      router.replace('/login');
      return;
    }
    listShops().then((shops) => {
      if (shops.length > 0) router.replace('/');
    });
  }, [router]);

  const saveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError(t('setup.err.name')); return; }
    if (address.trim().length < 3) { setError(t('setup.err.address')); return; }
    if (!region) { setError(t('setup.err.region')); return; }
    if (!geo.lat) { setError(t('setup.err.map')); return; }
    setBusy(true);
    try {
      await addShop({ name, address, region, location: geo });
      router.replace('/');
    } catch {
      setError(t('setup.err.fail'));
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {step === 'welcome' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div className="module-icon" style={{ width: 72, height: 72, fontSize: 'inherit', margin: '0 auto 20px' }}>
            <Store size={34} strokeWidth={1.7} color="var(--accent-deep)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)', margin: '0 0 10px' }}>
            {t('setup.welcome.title')}
          </h2>
          <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '0 auto 28px', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {t('setup.welcome.desc')}
          </p>
          <button className="btn btn-primary" onClick={() => setStep('shop')}>
            {t('setup.start')}
          </button>
        </div>
      )}

      {step === 'shop' && (
        <form className="card" onSubmit={saveShop}>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)', margin: '0 0 6px' }}>
            {t('setup.title')}
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '0 0 24px' }}>
            {t('setup.desc')}
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="shopName">{t('setup.shopName')}</label>
            <input
              id="shopName"
              className="form-input"
              placeholder={t('setup.shopName.ph')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="shopAddr">{t('setup.address')}</label>
            <input
              id="shopAddr"
              className="form-input"
              placeholder={t('setup.address.ph')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="shopRegion">{t('setup.region')}</label>
            <select
              id="shopRegion"
              className="form-input"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="" disabled>{t('setup.region.ph')}</option>
              {REGION_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('setup.approx')}</label>
            <ShopMap value={geo} onChange={(g) => setGeo(g)} />
          </div>

          {error && <div className="alert alert-amber" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep('welcome')}>
              {t('setup.back')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t('setup.saving') : t('setup.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}