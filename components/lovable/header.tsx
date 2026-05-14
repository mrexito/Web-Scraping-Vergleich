'use client';
import {GraduationCap, Menu, GitCompare} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
import {ThemeToggle} from '@/components/theme-toggle';
import {LanguageToggle} from '@/components/language-toggle';
import {useCompareStore} from '@/stores/compareStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function Header() {
  const pathname = usePathname();
  const t = useTranslations();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const compareCount = useCompareStore((s) => s.selectedProviderIds.length);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    {href: '/', label: t('nav.comparison')},
    {href: '/nutzwertanalyse', label: t('nav.nutzwertanalyse')},
    {href: '/zap-info', label: t('nav.zapInfo')},
    {href: '/about', label: t('nav.about')},
    {href: '/contact', label: t('nav.contact')},
  ] as const;

  const showCounter = mounted && compareCount > 0;

  // Helper: Aktiv-Status pro Route prüfen
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur-md',
        'transition-shadow duration-200',
        scrolled && 'shadow-sm',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-80"
        >
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            {t('common.appName')}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
                {/* Aktiver Indikator — Unterstrich-Balken */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-[1px] left-3 right-3 h-0.5 rounded-full bg-primary"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Compare-Counter Badge */}
          {showCounter && (
            <Link
              href="/compare"
              aria-label={t('compareSelect.viewComparison')}
              aria-current={pathname.startsWith('/compare') ? 'page' : undefined}
              className={cn(
                'relative inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5',
                'text-sm font-medium text-primary transition-all',
                'hover:border-primary/50 hover:bg-primary/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                pathname.startsWith('/compare') && 'border-primary bg-primary/20',
              )}
            >
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t('compareSelect.headerLabel')}
              </span>
              <span
                className={cn(
                  'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full',
                  'bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground',
                )}
              >
                {compareCount}
              </span>
            </Link>
          )}

          <LanguageToggle />
          <ThemeToggle />

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
                aria-label={t('nav.openMenu')}
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>{t('nav.navigation')}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {/* Vertikaler Balken links für Mobile */}
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-primary"
                        />
                      )}
                      {item.label}
                    </Link>
                  );
                })}

                {/* Mobile: Compare-Link wenn aktiv */}
                {showCounter && (
                  <Link
                    href="/compare"
                    onClick={() => setMobileOpen(false)}
                    aria-current={pathname.startsWith('/compare') ? 'page' : undefined}
                    className={cn(
                      'mt-2 inline-flex items-center justify-between gap-2 rounded-lg border border-primary/30',
                      'bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary',
                      'hover:bg-primary/20',
                      pathname.startsWith('/compare') && 'border-primary bg-primary/20',
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <GitCompare className="h-4 w-4" />
                      {t('compareSelect.headerLabel')}
                    </span>
                    <span
                      className={cn(
                        'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full',
                        'bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground',
                      )}
                    >
                      {compareCount}
                    </span>
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}