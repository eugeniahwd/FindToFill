import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';
import { ToastProvider } from '@/context/ToastContext';
import { AppShell } from '@/components/layout/AppShell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FindToFill - Find it. Fill it.',
  description:
    'Temukan dispenser air minum dan charging station aktif di stasiun KRL Commuter Line Jabodetabek.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="font-sans antialiased bg-page-tint text-navy">
        <ToastProvider>
          <AuthProvider>
            <LocationProvider>
              <AppShell>{children}</AppShell>
            </LocationProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
