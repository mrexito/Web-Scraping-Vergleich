'use client';
import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {ArrowRight, Calendar, MapPin, Wallet, Users, GitCompare, X, ArrowLeft, CheckCircle2, Circle, Clock, BookOpen, Star, ExternalLink, ChevronDown} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import type {Provider} from '@/lib/provider-types';
import {formatCHF} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useCompareStore} from '@/stores/compareStore';

const VALID_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

function scoreTone(score: number) {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-foreground';
  return 'text-warning';
}

function availTone(a: Provider['availability']) {
  if (a === 'viele_plaetze') return 'bg-success/10 text-success border-success/20';
  if (a === 'wenige_plaetze') return 'bg-warning/10 text-warning border-warning/30';
  return 'bg-muted text-muted-foreground border-border';
}

export function CompareView({allProviders}: {allProviders: Provider[]}) {
  const t = useTranslations();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedIds = useCompareStore((s) => s.selectedProviderIds);
  const removeProvider = useCompareStore((s) => s.removeProvider);
  const clearAll = useCompareStore((s) => s.clearAll);

  if (!mounted) {
    return (
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
    );
  }

  const selectedProviders = allProviders.filter((p) =>
    selectedIds.includes(p.id),
  );

  // Empty-State
  if (selectedProviders.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <GitCompare className="h-8 w-8 text-primary" />
        </div>
        <p className="mt-6 text-muted-foreground">
          {t('compareSelect.emptyState')}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar: Counter + Clear-All */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          <GitCompare className="h-3.5 w-3.5" />
          {t('compareSelect.count', {count: selectedProviders.length})}
        </div>

        <button
          onClick={clearAll}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
        >
          {t('compareSelect.clearAll')}
        </button>
      </div>

      {/* Vergleichs-Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {selectedProviders.map((provider) => (
          <CompareCard
            key={provider.id}
            provider={provider}
            onRemove={() => removeProvider(provider.id)}
          />
        ))}
      </div>
    </>
  );
}

// =====================================================================
// COMPARE-CARD — ALLE Infos auf einen Blick mit Akkordeon-Kurse
// =====================================================================

function CompareCard({
  provider,
  onRemove,
}: {
  provider: Provider;
  onRemove: () => void;
}) {
  const t = useTranslations();

  const availKey = provider.availability;
  const availText = t(`avail.${availKey}`);

  const localizedDays = provider.teachingDays
    .map((d) => (VALID_DAYS.includes(d as typeof VALID_DAYS[number]) ? t(`days.${d}`) : d))
    .join(', ');

  // Alle 9 Services
  const services: {label: string; active: boolean}[] = [
    {label: t('service.eLearning'), active: provider.hasELearning},
    {label: t('service.einstufungstest'), active: provider.hasEinstufungstest},
    {label: t('service.pruefungsarchiv'), active: provider.hasPruefungsarchiv},
    {label: t('service.aufsatzkorrektur'), active: provider.hasAufsatzkorrektur},
    {label: t('service.lernunterlagen'), active: provider.hasLernunterlagen},
    {label: t('service.beratungsgespraech'), active: provider.hasBeratungsgespraech},
    {label: t('service.distanceLearning'), active: provider.hasDistanceLearning},
    {label: t('service.digitalMaterials'), active: provider.hasDigitalMaterials},
    {label: t('service.catchUp'), active: provider.hasCatchUpOptions},
  ];

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl border border-border bg-card p-6',
        'shadow-[var(--shadow-card)] transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]',
      )}
    >
      {/* Remove-Button */}
      <button
        onClick={onRemove}
        aria-label={t('compareSelect.remove')}
        title={t('compareSelect.remove')}
        className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* HEADER: Name + Score + Quality-Stars */}
      <div className="flex items-start justify-between gap-4">
        <div className="pr-4">
          <h3 className="text-lg font-semibold tracking-tight">
            {provider.name}
          </h3>
          <div className="mt-1 flex items-center gap-0.5">
            {Array.from({length: 3}).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-3 w-3',
                  // Quality: DB 1=beste → 3 Sterne, DB 3=schlechteste → 1 Stern
                  i < (4 - provider.quality)
                    ? 'fill-primary text-primary'
                    : 'fill-none text-border',
                )}
              />
            ))}
            <span className="ml-1.5 text-[11px] text-muted-foreground">
              {t('sheet.quality')}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('card.score')}
          </div>
          <div
            className={cn('text-3xl font-semibold leading-none', scoreTone(provider.score))}
            style={{fontVariantNumeric: 'tabular-nums'}}
          >
            {provider.score}
          </div>
        </div>
      </div>

      <div className="my-5 h-px bg-border" />

      {/* SEKTION 1: Preis & Verfügbarkeit */}
      <dl className="space-y-2 text-sm">
        <div className="flex items-center gap-2.5">
          <Wallet className="h-4 w-4 text-primary" />
          <dd className="font-medium" style={{fontVariantNumeric: 'tabular-nums'}}>
            {formatCHF(provider.price)}
          </dd>
        </div>

        <div className="flex items-center gap-2.5">
          <Users className="h-4 w-4 text-primary" />
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
              availTone(provider.availability),
            )}
          >
            {availText}
          </span>
          <span className="text-xs text-muted-foreground">
            · max. {provider.maxParticipants}
          </span>
        </div>
      </dl>

      <div className="my-5 h-px bg-border" />

      {/* SEKTION 2: Standorte und Unterrichtstage */}
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {t('sheet.location')}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {provider.locations.map((loc) => (
                <span
                  key={loc}
                  className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-xs"
                >
                  {loc}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {t('sheet.day')}
            </div>
            <div className="mt-0.5 text-sm">{localizedDays}</div>
          </div>
        </div>
      </div>

      <div className="my-5 h-px bg-border" />

      {/* SEKTION 3: Kurse gruppiert nach Standort (Hybrid-Akkordeon) */}
      {provider.courses && provider.courses.length > 0 && (
        <>
          <div className="mb-5">
            <h4 className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              {t('sheet.coursesTitle')}
            </h4>
            <CompareCoursesByLocation courses={provider.courses} t={t} />
          </div>

          <div className="my-5 h-px bg-border" />
        </>
      )}

      {/* SEKTION 4: Alle 9 Services */}
      <div className="mb-5">
        <h4 className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          {t('sheet.servicesTitle')}
        </h4>
        <ul className="grid grid-cols-1 gap-1.5 text-sm">
          {services.map((s, i) => (
            <li
              key={i}
              className={cn(
                'flex items-center gap-2',
                !s.active && 'text-muted-foreground/50',
              )}
            >
              {s.active ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-border" />
              )}
              <span className={cn(!s.active && 'line-through')}>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <a
        href={provider.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center justify-between rounded-[10px] bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="inline-flex items-center gap-2">
          {t('sheet.cta')}
          <ExternalLink className="h-3.5 w-3.5" />
        </span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </a>
    </article>
  );
}

// =====================================================================
// COMPARE-COURSES-BY-LOCATION — Akkordeon-Gruppen nach Standort
// =====================================================================

function CompareCoursesByLocation({
  courses,
  t,
}: {
  courses: Provider['courses'];
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  // Gruppiere Kurse nach Standort
  const grouped = courses.reduce((acc, course) => {
    const loc = course.location || '—';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(course);
    return acc;
  }, {} as Record<string, Provider['courses']>);

  // Sortierung: Standorte mit den meisten Kursen zuerst, dann alphabetisch
  const sortedLocations = Object.keys(grouped).sort((a, b) => {
    const diff = grouped[b].length - grouped[a].length;
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  return (
    <div className="space-y-2">
      {sortedLocations.map((location, index) => (
        <details
          key={location}
          open={index === 0}
          className="group overflow-hidden rounded-lg border border-border bg-muted/20"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-muted/40 list-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium">{location}</span>
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {grouped[location].length}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <ul className="space-y-1.5 border-t border-border px-3 py-2 text-xs">
            {grouped[location].map((course) => (
              <li
                key={course.id}
                className="rounded-md bg-card p-2"
              >
                <div className="font-medium text-foreground">{course.label}</div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="inline-flex items-center gap-0.5">
                      <Calendar className="h-3 w-3" /> {course.day}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Clock className="h-3 w-3" /> {course.time}
                    </span>
                  </div>
                  <div className="text-right">
                    {course.originalPrice && (
                      <div className="text-[10px] line-through" style={{fontVariantNumeric: 'tabular-nums'}}>
                        {formatCHF(course.originalPrice)}
                      </div>
                    )}
                    <div className="font-medium text-foreground" style={{fontVariantNumeric: 'tabular-nums'}}>
                      {formatCHF(course.price)}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
