import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import RootShell from '../components/RootShell';

export const metadata: Metadata = {
  title: 'Neo SmartCore · Admin Dashboard',
  description: 'Admin dashboard ya kusimamia maduka, watumiaji na taarifa za Neo SmartCore',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw" suppressHydrationWarning>
      <head>
        {/* Weka dark mode KABLA ya paint: static hosting inaingia page moja kwa moja,
            hivyo class inahitajika mapema ili kuepuka flash ya light mode kila nav. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('neo_admin_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Tinos:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2BB6C9" />
        <link rel="apple-touch-icon" href="/NeoSmartCore_Icon.png" />
        <link rel="icon" href="/NeoSmartCore_Icon.png" />
      </head>
      <body>
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}