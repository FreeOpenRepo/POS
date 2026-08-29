import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Artisan POS & KDS Engine',
  description: 'Ultra-modern Next.js 16 + .NET 10 POS & Kitchen Display System with SignalR and ESC/POS Printing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
