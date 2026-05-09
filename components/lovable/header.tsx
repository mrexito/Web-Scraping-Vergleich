'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';

const navItems = [
  { href: '/',         label: 'Vergleich' },
  { href: '/zap-info', label: 'ZAP-Info' },
  { href: '/about',    label: 'Über uns' },
  { href: '/contact',  label: 'Kontakt' },
] as const;

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full backdrop-blur-md transition-colors duration-200',
        scrolled
          ? 'bg-background/80 border-b border-border'
          : 'bg-background/40 border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6 lg:px-12">
        <Link href="/" className="group flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-[1.03]">
            <GraduationCap className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="hidden text-[15px] sm:inline">Vergleich Gymi-Vorbereitungskurse</span>
        </Link>

        <nav className="flex items-center gap-1">
          <ul className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground',
                    pathname === item.href && 'text-foreground bg-surface',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="ml-2">
            <LanguageToggle />
          </div>

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
