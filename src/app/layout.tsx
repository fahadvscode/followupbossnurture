import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { isAuthenticated } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthGate } from '@/components/layout/AuthGate';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Drip Engine — FUB SMS Campaign Platform',
  description: 'Follow Up Boss SMS Drip Campaign Platform',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authed = await isAuthenticated();

  if (!authed) {
    return (
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full">
          <AuthGate />
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Sidebar />
        <main className="min-h-screen min-w-0 lg:ml-64">
          <div className="min-w-0 p-4 pt-14 sm:p-6 sm:pt-14 lg:p-8 lg:pt-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
