'use client';
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { adminLogin, isFirebaseConfigured } from '../../lib/firebase';
import { getAdminScope, saveScope, markSessionAuthed } from '../../lib/db';
import { useLang } from '../../lib/i18n';
import ContactFab from '../../components/ContactFab';

const LAST_PATH_KEY = 'neo_admin_last_path';

export default function LoginPage() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function firebaseErrorMessage(e: unknown): string {
    const code = (e as { code?: string })?.code ?? '';
    switch (code) {
      case 'auth/invalid-email':
        return t('login.experr.invalidEmail');
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return t('login.experr.badCreds');
      case 'auth/operation-not-allowed':
        return t('login.experr.disabled');
      case 'auth/too-many-requests':
        return t('login.experr.throttled');
      case 'auth/network-request-failed':
        return t('login.experr.network');
      default:
        return t('login.err.fallback');
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t('login.err.empty'));
      return;
    }
    setLoading(true);
    setError('');

    try {
      const user = await adminLogin(email, password);
      const scope = await getAdminScope(user.uid, user.email ?? email);
      saveScope(scope);
      markSessionAuthed();
      // Full page load: static hosting inarudisha page safi (kus-ita RSC client nav).
      // Rudi kwenye ukurasa aliokuwepo (ili session ipate "niikute ilipokuwa").
      const saved = typeof window !== 'undefined' ? localStorage.getItem(LAST_PATH_KEY) : null;
      window.location.href = saved && saved.startsWith('/') ? saved : '/';
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = () => {
    if (!email.trim()) {
      setError(t('login.forgot.empty'));
      return;
    }
    setError(t('login.forgot.done', { email: email.trim() }));
  };

  return (
    <div className="login-stage">
      <div className="beam beam-1" />
      <div className="beam beam-2" />
      <div className="beam beam-3" />
      <div className="beam beam-4" />

      <form className="login-card card" onSubmit={handleLogin} style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 2 }}>
        <img src="/NeoSmartCore_Icon.png" alt="Neo SmartCore" className="login-logo" />
        <h2>{t('login.title')}</h2>
        <p className="sub">{t('login.subtitle')}</p>

        {error && (
          <div className="alert alert-amber" style={{ textAlign: 'left', marginBottom: 16, fontSize: '0.78rem' }}>{error}</div>
        )}

        <div className="form-group">
          <label className="form-label">{t('login.email')}</label>
          <input
            type="email"
            className="form-input"
            placeholder="admin1@gmail.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('login.password')}</label>
          <div className="pass-wrap">
            <input
              type={showPass ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              style={{ paddingRight: 42 }}
            />
            <button
              type="button"
              className="pass-toggle"
              onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? t('login.hidePass') : t('login.showPass')}
              title={showPass ? t('login.hidePass') : t('login.showPass')}
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="login-links">
          <button
            type="button"
            onClick={forgotPassword}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-deep)', padding: 0 }}
          >
            {t('login.forgot')}
          </button>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 18 }} disabled={loading}>
          {loading ? t('login.signin.loading') : t('login.signin')}
        </button>

        {!isFirebaseConfigured() && (
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 18, textAlign: 'center' }}>
            {t('login.demo')}
          </p>
        )}
      </form>

      <ContactFab />
    </div>
  );
}