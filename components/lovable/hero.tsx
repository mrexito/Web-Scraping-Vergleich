'use client';
import {ArrowRight} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {HeroStats} from './hero-stats';

interface HeroProps {
  providerCount: number;
  courseCount: number;
  lastUpdated?: Date;
}

export function Hero({providerCount, courseCount, lastUpdated}: HeroProps) {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden">
      <div className="bg-mesh absolute inset-0 -z-10 opacity-80" />
      <div className="grid-pattern absolute inset-0 -z-10 opacity-40" />
      <div className="mx-auto max-w-[1280px] px-6 pt-20 pb-12 lg:px-12 lg:pt-28">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {t('hero.trustBadge')}
          </span>
          <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {t('hero.headline')}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {t('hero.subline')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/nutzwertanalyse"
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_0_0_var(--accent-glow)] transition-all hover:shadow-[0_0_24px_4px_var(--accent-glow)]"
            >
              {t('hero.ctaPrimary')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#vergleich"
              className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-background/50 px-5 py-3 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-surface"
            >
              {t('hero.ctaSecondary')}
            </a>
          </div>
        </div>
        <HeroStats
          providerCount={providerCount}
          courseCount={courseCount}
          lastUpdated={lastUpdated}
        />
      </div>
    </section>
  );
}
