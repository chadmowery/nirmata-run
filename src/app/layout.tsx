import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dungeon Runner - Flash Test',
  description: 'A classic terminal roguelike experience',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="crt-overlay" />
        <div className="crt-flicker" />
        {children}
      </body>
    </html>
  );
}
