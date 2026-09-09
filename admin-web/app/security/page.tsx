'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Eye, EyeOff, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { changeAdminPassword, requireAdmin } from '../../lib/firebase';
import { useLang } from '../../lib/i18n';
import { isSessionAuthed } from '../../lib/db';

export default function SecurityPage() {
  const router = useRouter();
  const { t } = useLang();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSessionAuthed()) {
      router.replace('/login');
      return;
    }
    // Best-effort: onyesha email ya account; tusifute kikao kama auth inashindwa
    // kwa muda (hii ndiyo ilikuwa ikilogout users/security pages).
    requireAdmin()
      .then((r) => {
        if (r) setEmail(r.email || '');
      })
      .catch(() => {});
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!current) { setMsg({ type: 'err', text: t('sec.err.current') }); return; }
    if (newPass.length < 8) { setMsg({ type: 'err', text: t('sec.err.length') }); return; }
    if (newPass !== confirm) { setMsg({ type: 'err', text: t('sec.err.mismatch') }); return; }
    setBusy(true);
    try {
      await changeAdminPassword(current, newPass);
      setMsg({ type: 'ok', text: t('sec.done') });
      setCurrent('');
      setNewPass('');
      setConfirm('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/wrong-password') setMsg({ type: 'err', text: t('sec.err.wrong') });
      else if (code === 'auth/weak-password') setMsg({ type: 'err', text: t('sec.err.length') });
      else setMsg({ type: 'err', text: t('sec.err.fail') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="card">
        <div className="stat-label" style={{ marginBottom: 16 }}>
          <ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{t('sec.title')}
        </div>

        {email && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface-alt)', borderRadius: 10, fontSize: '0.85rem', color: 'var(--muted)' }}>
            {t('sec.signedin')} <strong style={{ color: 'var(--text)' }}>{email}</strong>
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">{t('sec.current')}</label>
            <div className="pass-wrap">
              <input
                className="form-input"
                type={showCur ? 'text' : 'password'}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" className="pass-toggle" onClick={() => setShowCur((v) => !v)} aria-label={showCur ? t('login.hidePass') : t('login.showPass')}>
                {showCur ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('sec.new')}</label>
            <div className="pass-wrap">
              <input
                className="form-input"
                type={showNew ? 'text' : 'password'}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder={t('sec.new.ph')}
                autoComplete="new-password"
              />
              <button type="button" className="pass-toggle" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? t('login.hidePass') : t('login.showPass')}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small style={{ color: 'var(--muted)', fontSize: 12 }}>{t('sec.hint')}</small>
          </div>

          <div className="form-group">
            <label className="form-label">{t('sec.confirm')}</label>
            <div className="pass-wrap">
              <input
                className="form-input"
                type={showConf ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('sec.confirm.ph')}
                autoComplete="new-password"
              />
              <button type="button" className="pass-toggle" onClick={() => setShowConf((v) => !v)} aria-label={showConf ? t('login.hidePass') : t('login.showPass')}>
                {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {msg && (
            <div className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-amber'}`} style={{ marginBottom: 16 }}>
              {msg.type === 'ok' && <CheckCircle2 size={15} style={{ marginRight: 6, verticalAlign: -2 }} />}
              {msg.text}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? <><Loader2 size={16} className="spin" /> {t('sec.saving')}</> : <><KeyRound size={16} /> {t('sec.submit')}</>}
          </button>
        </form>
      </div>
    </div>
  );
}