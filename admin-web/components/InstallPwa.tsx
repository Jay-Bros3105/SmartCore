'use client';

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Floating "Install App" button kwa PWA. Inatokea tu kwenye Chrome/Edge
 * (Android/desktop) baada ya site kufikia masharti ya installable —
 * si kwenye iOS Safari (imefungwa na Apple).
 */
export default function InstallPwa() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
      setHidden(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !event || hidden) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,.25)',
        padding: '10px 14px',
        maxWidth: 320,
      }}
    >
      <Download size={18} style={{ color: 'var(--primary)' }} />
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>
        <b>Sakinisha Neo-SmartCore</b>
        <br />
        Weka dashboard kwenye simu (PWA).
      </div>
      <button
        onClick={async () => {
          try {
            await event.prompt();
            await event.userChoice;
            setEvent(null);
          } catch {
            /* Hakuna kilicho — user alifunga. */
          }
        }}
        style={{
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          padding: '7px 14px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Install
      </button>
      <button
        onClick={() => setHidden(true)}
        aria-label="Funga"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}