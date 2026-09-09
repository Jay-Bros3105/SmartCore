'use client';
import React, { useEffect, useState } from 'react';
import { MessageCircle, X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { useLang } from '../lib/i18n';
import { EMAILJS_SERVICE_ID, EMAILJS_NOTIFY_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, SUPER_ADMIN_EMAIL, isEmailJsConfigured } from '../lib/emailjs';

const TYPES = ['password_reset', 'feedback', 'bug'] as const;

const TYPE_LABEL: Record<string, string> = {
  password_reset: 'Password Reset Request',
  feedback: 'Feedback / Suggestion',
  bug: 'Problem / Bug Report',
};

export default function ContactFab() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<string>('feedback');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [errDetail, setErrDetail] = useState('');
  const configured = isEmailJsConfigured();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 3) return;
    if (!isEmailJsConfigured()) {
      setStatus('err');
      return;
    }
    setBusy(true);
    setStatus('idle');
    setErrDetail('');
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_NOTIFY_TEMPLATE_ID,
        {
          to_email: SUPER_ADMIN_EMAIL,
          to_name: 'Super Admin',
          category: TYPE_LABEL[type as keyof typeof TYPE_LABEL] || type,
          message,
          source: 'Neo-SmartCore Login — Contact Form',
          title: TYPE_LABEL[type as keyof typeof TYPE_LABEL] || type,
          details: message,
          submitted_by: [name || '', email || ''].filter(Boolean).join(' · ') || 'Anonymous',
          date: new Date().toLocaleString('en-GB'),
          reference_id: `NSC-${Date.now().toString(36).toUpperCase()}`,
          action_url: typeof window !== 'undefined' ? window.location.origin : '',
          current_year: new Date().getFullYear(),
        },
        { publicKey: EMAILJS_PUBLIC_KEY }
      );
      setStatus('ok');
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setStatus('err');
      setErrDetail(
        String(
          ((err as { text?: unknown })?.text ?? (err as Error)?.message ?? err) || ''
        ).slice(0, 300)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className={`contact-fab${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('contact.close') : t('contact.open')}
        title={open ? t('contact.close') : t('contact.open')}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div className="contact-panel card">
          <div className="contact-head">
            <div className="contact-hd-ico">
              <MessageCircle size={18} />
            </div>
            <div>
              <strong>{t('contact.title')}</strong>
              <small>{t('contact.subtitle')}</small>
            </div>
          </div>

          <form onSubmit={submit}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('contact.name')}</label>
                <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('contact.name.ph')} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('contact.email')}</label>
                <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('contact.email.ph')} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('contact.type')}</label>
              <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((tp) => (
                  <option key={tp} value={tp}>{t(`contact.type.${tp}`)}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('contact.message')}</label>
              <textarea
                className="form-input"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('contact.message.ph')}
                style={{ resize: 'vertical' }}
              />
            </div>

            {!configured && <div className="alert alert-amber" style={{ marginBottom: 12 }}>{t('contact.noconfig')}</div>}
            {status === 'ok' && <div className="alert alert-ok" style={{ marginBottom: 12 }}>{t('contact.ok')}</div>}
            {status === 'err' && (
              <div className="alert alert-amber" style={{ marginBottom: 12 }}>
                {t('contact.err')}
                {errDetail && <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85, wordBreak: 'break-word' }}>{errDetail}</div>}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={busy || !configured} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? <><Loader2 size={16} className="spin" /> {t('contact.sending')}</> : <><Send size={16} /> {t('contact.send')}</>}
            </button>
          </form>
        </div>
      )}
    </>
  );
}