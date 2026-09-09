'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, LayoutDashboard, Store, ClipboardList, Users, Package, Blocks, FileBarChart, Languages, ShieldCheck, AlertTriangle, ClipboardCheck, Boxes, CalendarDays, WalletCards, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { LanguageProvider, useLang } from '../lib/i18n';
import { adminLogout } from '../lib/firebase';
import { clearSessionAuthed } from '../lib/db';

/** Full-page navigation (badala ya next/link RSC) — Firebase static hosting
 *  inarudisha page sahihi kwa kila URL, hakuna hitaji RSC client nav. */
function NavLink({
  href,
  className,
  title,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  );
}

type ThemeCtx = { isDark: boolean; toggle: () => void };
const ThemeCtx = createContext<ThemeCtx>({ isDark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

type AuthCtx = { logout: () => void };
const AuthCtx = createContext<AuthCtx>({ logout: () => {} });
export const useAuth = () => useContext(AuthCtx);

export default function RootShell({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [adminLabel, setAdminLabel] = useState('');
  const pathname = usePathname();
  const route = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const isLogin = route === '/login';

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('neo_admin_theme') : null;
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem('neo_admin_scope') : null;
      if (raw) {
        const s = JSON.parse(raw) as { email?: string; name?: string; regions?: string[] | 'all' };
        setAdminLabel(
          `${s.name || s.email || ''}${s.regions && s.regions !== 'all' ? ` · ${s.regions.join(', ')}` : ''}`
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (route && route !== '/login') {
      localStorage.setItem('neo_admin_last_path', route);
    }
  }, [route]);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    if (typeof window !== 'undefined') localStorage.setItem('neo_admin_theme', next ? 'dark' : 'light');
  };

  const logout = async () => {
    if (typeof window !== 'undefined') {
      clearSessionAuthed();
    }
    try { await adminLogout(); } catch {}
    window.location.href = '/login';
  };

  return (
    <LanguageProvider>
      <AuthCtx.Provider value={{ logout }}>
        <ThemeCtx.Provider value={{ isDark, toggle }}>
          {isLogin ? <>{children}</> : <Shell collapsed={collapsed} setCollapsed={setCollapsed} adminLabel={adminLabel} isDark={isDark} toggle={toggle} requestLogout={() => setConfirmLogout(true)} pathname={route}>{children}</Shell>}
          {confirmLogout && <LogoutModal onCancel={() => setConfirmLogout(false)} onConfirm={logout} />}
        </ThemeCtx.Provider>
      </AuthCtx.Provider>
    </LanguageProvider>
  );
}

function Shell({
  children,
  collapsed,
  setCollapsed,
  adminLabel,
  isDark,
  toggle,
  requestLogout,
  pathname,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  adminLabel: string;
  isDark: boolean;
  toggle: () => void;
  requestLogout: () => void;
  pathname: string;
}) {
  const { t, lang, setLang } = useLang();
  const [isMobile, setIsMobile] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isMobile && collapsed) setCollapsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isMobile]);

  const NAV = [
    {
      key: 'dashboard',
      label: t('nav.dashboard'),
      icon: LayoutDashboard,
      items: [{ href: '/', label: t('nav.dashboard'), icon: LayoutDashboard }],
    },
    {
      key: 'myshop',
      label: t('nav.group.shop'),
      icon: Store,
      items: [
        { href: '/branches', label: t('nav.shops'), icon: Store },
        { href: '/registrations', label: t('nav.registrations'), icon: ClipboardList },
        { href: '/users', label: t('nav.users'), icon: Users },
        { href: '/products', label: t('nav.products'), icon: Package },
      ],
    },
    {
      key: 'stocks',
      label: t('nav.group.stocks'),
      icon: Boxes,
      items: [
        { href: '/openings', label: t('nav.openings'), icon: CalendarDays },
        { href: '/closings', label: t('nav.closings'), icon: ClipboardCheck },
        { href: '/stock', label: t('nav.stock'), icon: Boxes },
        { href: '/transactions', label: t('nav.transactions'), icon: ArrowLeftRight },
        { href: '/reconcile', label: t('nav.reconcile'), icon: WalletCards },
      ],
    },
    {
      key: 'system',
      label: t('nav.group.system'),
      icon: Blocks,
      items: [
        { href: '/modules', label: t('nav.modules'), icon: Blocks },
        { href: '/reports', label: t('nav.reports'), icon: FileBarChart },
        { href: '/security', label: t('nav.security'), icon: ShieldCheck },
      ],
    },
  ];

  useEffect(() => {
    const active = NAV.find((g) => g.items.some((n) => n.href === pathname));
    if (active && active.items.length > 1) {
      setOpenGroups((p) => ({ ...p, [active.key]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups((p) => ({ ...p, [key]: !p[key] }));
  };

  const ALL_ITEMS = NAV.flatMap((g) => g.items);
  const currentTitle = ALL_ITEMS.find((n) => n.href === pathname)?.label ?? 'Neo SmartCore';

  return (
    <div className={`layout${collapsed ? ' collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo-wrap">
            <img src="/NeoSmartCore_Icon.png" alt="Neo SmartCore" className="sidebar-logo" />
          </span>
          <div>
            <h2>Neo SmartCore</h2>
            <small>{t('shell.subtitle')}</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((g) =>
            g.items.length === 1 ? (() => {
              const ItemIcon = g.items[0].icon;
              const item = g.items[0];
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link${pathname === item.href ? ' active' : ''}`}
                  title={item.label}
                >
                  <ItemIcon size={18} strokeWidth={2} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })() : (() => {
              const GroupIcon = g.icon;
              return (
                <div key={g.key} className="sidebar-group">
                  <button
                    className="sidebar-group-toggle"
                    onClick={() => toggleGroup(g.key)}
                    aria-expanded={!!openGroups[g.key]}
                    title={g.label}
                  >
                    <GroupIcon size={18} strokeWidth={2} />
                    <span>{g.label}</span>
                    <ChevronDown size={16} className={`chev${openGroups[g.key] ? ' open' : ''}`} />
                  </button>
                  {openGroups[g.key] && (
                    <div className="sidebar-group-items">
                      {g.items.map((sub) => {
                        const SubIcon = sub.icon;
                        return (
                          <NavLink
                            key={sub.href}
                            href={sub.href}
                            className={`sidebar-link sub${pathname === sub.href ? ' active' : ''}`}
                            title={sub.label}
                          >
                            <SubIcon size={16} strokeWidth={2} />
                            <span>{sub.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="sidebar-link logout-danger"
            style={{ cursor: 'pointer', width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
            onClick={requestLogout}
            title={t('nav.logout')}
          >
            <LogOut size={18} strokeWidth={2} />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
</aside>

        {isMobile && collapsed && (
          <div className="sidebar-backdrop" onClick={() => setCollapsed(false)} aria-hidden="true" />
        )}

        <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="icon-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle menu" title="Toggle menu">
              {collapsed ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1>{currentTitle}</h1>
          </div>
          <div className="topbar-actions">
            {adminLabel && <span className="toggle-wrap admin-label">{adminLabel}</span>}
            <button
              className="icon-btn"
              onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
              aria-label="Language"
              title={`${t('lang.label')}: ${lang === 'en' ? t('lang.swahili') : t('lang.english')}`}
            >
              <Languages size={18} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{lang === 'en' ? 'EN' : 'SW'}</span>
            </button>
            <button className={`toggle${isDark ? ' on' : ''}`} onClick={toggle} aria-label="Toggle theme"></button>
            <span className="toggle-wrap">{isDark ? t('theme.dark') : t('theme.light')}</span>
          </div>
        </div>
        <div className="content">{children}</div>

        {pathname !== '/setup' && (
          <NavLink href="/setup" className="fab" title="Add shop" aria-label="Add another shop">
            <PlusIcon />
          </NavLink>
        )}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function LogoutModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal danger" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-icon danger">
          <AlertTriangle size={26} strokeWidth={1.8} color="var(--danger)" />
        </div>
        <h3>{t('logout.title')}</h3>
        <p>{t('logout.desc')}</p>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>
            {t('logout.cancel')}
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            <LogOut size={16} /> {t('logout.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}