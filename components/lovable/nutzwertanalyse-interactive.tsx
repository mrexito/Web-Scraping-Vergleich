'use client';

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
import {formatCHF} from '@/lib/format';
import type {GymiProvider} from '@/schemas/gymiProviderSchema';
import type {Course as DbCourse} from '@/schemas/courseSchema';
import type {CourseDetail} from '@/schemas/courseDetailSchema';
import {
  adaptProviders,
  type CourseTypeFilter,
  type CriteriaWeights,
} from '@/utils/adaptProviders';

// =====================================================================
// TYPES & CONSTANTS
// =====================================================================

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

interface NutzwertanalyseInteractiveProps {
  providers: GymiProvider[];
  courseDetails: CourseDetail[];
  courses: DbCourse[];
}

// =====================================================================
// COMPONENT
// =====================================================================

export function NutzwertanalyseInteractive({
  providers,
  courseDetails,
  courses,
}: NutzwertanalyseInteractiveProps) {
  const t = useTranslations('nwa');
  const tCt = useTranslations('courseType');

  const [gymType, setGymType] = useState<'lang' | 'kurz'>('lang');
  const [weights, setWeights] = useState<Record<CritKey, number>>(PRESETS.balanced);

  // Slider-Total (muss 100 sein für CTA)
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

  // Live-Berechnung: bei jedem Render mit aktuellen Sliderwerten
  const courseType: CourseTypeFilter = gymType === 'lang' ? 'langgymi' : 'kurzgymi';
  const criteriaWeights: CriteriaWeights = weights;

  const ranked = useMemo(() => {
    const adapted = adaptProviders(
      providers,
      courses,
      courseDetails,
      criteriaWeights,
      courseType,
    );
    return [...adapted].sort((a, b) => b.score - a.score);
  }, [providers, courses, courseDetails, criteriaWeights, courseType]);

  // Maximalwerte für Balken-Skalierung pro Sub-Score-Spalte
  const maxBreakdown = useMemo(() => {
    if (ranked.length === 0) {
      return {price: 1, quality: 1, location: 1, flex: 1, services: 1, digital: 1};
    }
    return {
      price: Math.max(1, ...ranked.map((r) => r.weightedBreakdown.price)),
      quality: Math.max(1, ...ranked.map((r) => r.weightedBreakdown.quality)),
      location: Math.max(1, ...ranked.map((r) => r.weightedBreakdown.location)),
      flex: Math.max(1, ...ranked.map((r) => r.weightedBreakdown.flex)),
      services: Math.max(1, ...ranked.map((r) => r.weightedBreakdown.services)),
      digital: Math.max(1, ...ranked.map((r) => r.weightedBreakdown.digital)),
    };
  }, [ranked]);

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

      {/* Step 4: Live-Ranking-Tabelle */}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {t('rankingTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('rankingSub')}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            {tCt('resultCount', {count: ranked.length})} · {gymType === 'lang' ? tCt('langgymi') : tCt('kurzgymi')}
          </span>
        </div>

        {ranked.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
            {t('rankingEmpty')}
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm" style={{fontVariantNumeric: 'tabular-nums'}}>
              <thead className="bg-surface/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left font-medium">#</th>
                  <th className="px-3 py-3 text-left font-medium">{t('rankingProvider')}</th>
                  <th className="px-3 py-3 text-left font-medium">{t('rankingPrice')}</th>
                  <th className="px-3 py-3 text-right font-medium">
                    {t('rankingTotal')}
                  </th>
                  {CRITERIA.map(({key}) => (
                    <th key={key} className="px-2 py-3 text-right font-medium">
                      <abbr title={t(`criteria.${key}`)}>{t(`criteriaShort.${key}`)}</abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-t border-border transition-colors hover:bg-surface/40"
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{p.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatCHF(p.price)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                        {p.score}
                      </span>
                    </td>
                    {CRITERIA.map(({key}) => {
                      const value = p.weightedBreakdown[key];
                      const max = maxBreakdown[key];
                      const pct = max > 0 ? (value / max) * 100 : 0;
                      return (
                        <td key={key} className="relative px-2 py-2.5 text-right">
                          <div
                            className="absolute inset-y-1 left-1 right-1 rounded bg-primary/10"
                            style={{
                              width: `calc(${Math.max(2, pct)}% - 0.5rem)`,
                            }}
                            aria-hidden="true"
                          />
                          <span className="relative font-medium">{value}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="mt-10 flex flex-col items-start gap-2">
        {total === 100 ? (
          <Link
            href={`/?w=${weights.price},${weights.quality},${weights.location},${weights.flex},${weights.services},${weights.digital}&type=${gymType === 'lang' ? 'langgymi' : 'kurzgymi'}#vergleich`}
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
