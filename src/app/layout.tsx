import type { Metadata } from 'next';
import { EB_Garamond, Manrope } from 'next/font/google';
import { LanguageProvider } from '@/lib/i18n';
import './globals.css';

const serif = EB_Garamond({
  subsets: ['greek', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
});

const sans = Manrope({
  subsets: ['greek', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Wedding Moments — Digital Wedding Album',
  description: 'Share wedding photos and videos in original quality.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="el"
      suppressHydrationWarning
      className={`${serif.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#FAF8F5] text-stone-800 font-sans selection:bg-amber-200/60">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}