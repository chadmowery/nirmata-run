import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nirmata Runner // Taikoku Vector Manifest',
  description: 'Turn-based, server-authoritative extraction roguelike in high-contrast constructivist packaging',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&family=Noto+Sans+JP:wght@400;600;700;800;900&family=Share+Tech+Mono&family=Space+Grotesk:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="crt-overlay" />
        {children}
      </body>
    </html>
  );
}
