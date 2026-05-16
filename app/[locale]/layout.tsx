import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {GeistSans} from 'geist/font/sans';
import {ThemeProvider} from '@/components/theme-provider';
import {Header} from '@/components/lovable/header';
import {Footer} from '@/components/lovable/footer';
import {RealtimeIndicator} from '@/components/lovable/realtime-indicator';
import {routing} from '@/i18n/routing';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'metadata'});
  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale} className={GeistSans.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen flex flex-col">
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <RealtimeIndicator />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}