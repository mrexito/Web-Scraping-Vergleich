"use client";
import {useMemo, useState} from 'react';
import {
  TrendingUp,
  Award,
  Shuffle,
  Package,
  MapPin,
  Laptop,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

type CritKey = 'price' | 'quality' | 'location' | 'flex' | 'services' | 'digital';

interface Criterion {
  key: CritKey;
  icon: LucideIcon;
}

const CRITERIA: Criterion[] = [
  {key: 'price', icon: TrendingUp},
  {key: 'quality', icon: Award},
  {key: 'location', icon: MapPin},
  {key: 'flex', icon: Shuffle},
  {key: 'services', icon: Package},
  {key: 'digital', icon: Laptop},
];

const PRESETS: Record<string, Record<CritKey, number>> = {
  balanced: {price: 17, quality: 17, location: 16, flex: 17, services: 17, digital: 16},
  price:    {price: 40, quality: 15, location: 15, flex: 10, services: 10, digital: 10},
  quality:  {price: 10, quality: 40, location: 10, flex: 15, services: 15, digital: 10},
  flex:     {price: 10, quality: 15, location: 10, flex: 35, services: 15, digital: 15},
};

export default function NutzwertanalysePage() {
  const t = useTranslations('nwa');
  const [gymType, setGymType] = useState<'lang' | 'kurz'>('lang');
  const [weights, setWeights] = useState<Record<CritKey, number>>(PRESETS.balanced);

  const total = useMemo(
    () => Object.values(weights).reduce((s, n) => s + n, 0),
    [weights],
  );

  const totalTone =
    total === 100
      ? 'text-success border-success/30 bg-success/10'
      : total < 100
        ? 'text-warning border-warning/30 bg-warning/10'
        : 'text-destructive border-destructive/30 bg-destructive/10';

  const setW = (k: CritKey, v: number) =>
    setWeights((w) => ({...w, [k]: Math.max(0, Math.min(100, v))}));

  const presetKeys = ['balanced', 'price', 'quality', 'flex'] as const;
  const presetLabelKey = (p: string) =>
    p === 'balanced' ? 'presetBalanced'
    : p === 'price' ? 'presetPrice'
    : p === 'quality' ? 'presetQuality'
    : 'presetFlex';

  return (
    <main className="mx-auto max-w-[1280px] px-6 pt-12 pb-24 lg:px-12">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {t('step')}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {t('subtitle')}
        </p>
      </header>

      {/* Step 1: Gymi-Typ */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">
          {t('step1Q')}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(['lang', 'kurz'] as const).map((k) => {
            const active = gymType === k;
            const label = k === 'lang' ? t('gymTypeLang') : t('gymTypeKurz');
            const sub = k === 'lang' ? t('gymTypeLangSub') : t('gymTypeKurzSub');
            return (
              <button
                key={k}
                onClick={() => setGymType(k)}
                className={cn(
                  'rounded-2xl border p-5 text-left transition-all',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_24px_var(--accent-glow)]'
                    : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]',
                )}
              >
                <div className="text-base font-semibold">{label}</div>
                <div className={cn('mt-1 text-sm', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {sub}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Presets */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">{t('presetsTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('presetsSub')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {presetKeys.map((p) => (
            <button
              key={p}
              onClick={() => setWeights(PRESETS[p])}
              className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {t(presetLabelKey(p))}
            </button>
          ))}
        </div>
      </section>

      {/* Step 3: Slider */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('weightsTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('weightsSub')}
            </p>
          </div>
          <div className={cn('shrink-0 rounded-full border px-3 py-1 text-sm font-medium', totalTone)}>
            {t('total')}: <span style={{fontVariantNumeric: 'tabular-nums'}}>{total}</span> / 100
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {CRITERIA.map(({key, icon: Icon}) => (
            <div
              key={key}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5"
            >
              <div className="flex min-w-[260px] flex-1 items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium">{t(`criteria.${key}`)}</div>
                  <div className="text-xs text-muted-foreground">{t(`criteria.${key}Desc`)}</div>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights[key]}
                onChange={(e) => setW(key, Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-[color:var(--primary)]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={weights[key]}
                  onChange={(e) => setW(key, Number(e.target.value))}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-right text-sm outline-none focus:border-primary"
                  style={{fontVariantNumeric: 'tabular-nums'}}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 flex flex-col items-start gap-2">
        {total === 100 ? (
          <Link
            href={`/?w=${weights.price},${weights.quality},${weights.location},${weights.flex},${weights.services},${weights.digital}#vergleich`}
            className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-all hover:shadow-[0_0_24px_var(--accent-glow)]"
          >
            {t('cta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <span
            aria-disabled
            className="inline-flex items-center gap-2 rounded-[10px] bg-muted px-5 py-3 text-sm font-medium text-muted-foreground cursor-not-allowed pointer-events-none"
          >
            {t('cta')}
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
        {total !== 100 && (
          <p className="text-xs text-muted-foreground">
            {t('helper')}
          </p>
        )}
      </section>
    </main>
  );
}
