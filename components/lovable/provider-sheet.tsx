"use client";
import {Check, ExternalLink, Star, X, MapPin, ChevronDown} from 'lucide-react';
import {useEffect} from 'react';
import {useTranslations} from 'next-intl';
import type {Provider} from '@/lib/mock-providers';
import {formatCHF} from '@/lib/format';
import {cn} from '@/lib/utils';

function Stars({n}: {n: number}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({length: 3}).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < n ? 'fill-warning text-warning' : 'text-border',
          )}
        />
      ))}
    </span>
  );
}

function ServiceRow({
  label,
  has,
  isNew,
  newLabel,
}: {
  label: string;
  has: boolean;
  isNew?: boolean;
  newLabel: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'grid h-5 w-5 place-items-center rounded-full',
            has ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
          )}
        >
          {has ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
        </span>
        <span className="text-sm">{label}</span>
      </div>
      {isNew && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-primary">
          {newLabel}
        </span>
      )}
    </div>
  );
}

// =====================================================================
// COURSES-BY-LOCATION — Akkordeon-Gruppen nach Standort
// =====================================================================
function CoursesByLocation({
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

  if (sortedLocations.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface/20 px-4 py-6 text-center text-sm text-muted-foreground">
        Keine Kurse verfügbar
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedLocations.map((location, index) => (
        <details
          key={location}
          open={index === 0}
          className="group overflow-hidden rounded-xl border border-border bg-surface/20"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface/40 list-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{location}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {grouped[location].length} {grouped[location].length === 1 ? 'Kurs' : 'Kurse'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="border-t border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t('sheet.courseLabel')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('sheet.day')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('sheet.time')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('sheet.price')}</th>
                </tr>
              </thead>
              <tbody>
                {grouped[location].map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{c.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.day}</td>
                    <td className="px-3 py-2 text-muted-foreground" style={{fontVariantNumeric: 'tabular-nums'}}>{c.time}</td>
                    <td className="px-3 py-2 text-right">
                      {c.originalPrice && (
                        <div className="text-[11px] text-muted-foreground line-through" style={{fontVariantNumeric: 'tabular-nums'}}>
                          {formatCHF(c.originalPrice)}
                        </div>
                      )}
                      <div className="font-medium" style={{fontVariantNumeric: 'tabular-nums'}}>{formatCHF(c.price)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}

export function ProviderSheet({
  provider,
  onClose,
}: {
  provider: Provider | null;
  onClose: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    if (!provider) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [provider, onClose]);

  const open = !!provider;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          'fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={provider?.name ?? ''}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {provider && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-border px-7 py-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{provider.name}</h2>
              </div>
              <button
                onClick={onClose}
                aria-label={t('common.close')}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-6">
              <section>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {k: t('sheet.quality'), v: <Stars n={provider.quality} />},
                    {k: t('sheet.maxParticipants'), v: <span style={{fontVariantNumeric: 'tabular-nums'}}>{provider.maxParticipants}</span>},
                    {k: t('sheet.location'), v: provider.locations.join(', ')},
                    {k: t('sheet.availability'), v: t(`avail.${provider.availability}`)},
                  ].map((it, i) => (
                    <div key={i} className="rounded-xl border border-border bg-surface/40 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{it.k}</div>
                      <div className="mt-1.5 text-sm font-medium">{it.v}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('sheet.coursesTitle')}</h3>
                <div className="mt-4">
                  <CoursesByLocation courses={provider.courses} t={t} />
                </div>
              </section>

              <section className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('sheet.servicesTitle')}</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <ServiceRow label={t('service.eLearning')} has={provider.hasELearning} newLabel={t('sheet.new')} />
                  <ServiceRow label={t('service.einstufungstest')} has={provider.hasEinstufungstest} newLabel={t('sheet.new')} />
                  <ServiceRow label={t('service.pruefungsarchiv')} has={provider.hasPruefungsarchiv} newLabel={t('sheet.new')} />
                  <ServiceRow label={t('service.aufsatzkorrektur')} has={provider.hasAufsatzkorrektur} newLabel={t('sheet.new')} />
                  <ServiceRow label={t('service.lernunterlagen')} has={provider.hasLernunterlagen} newLabel={t('sheet.new')} />
                  <ServiceRow label={t('service.beratungsgespraech')} has={provider.hasBeratungsgespraech} newLabel={t('sheet.new')} />
                  <ServiceRow label={t('service.distanceLearning')} has={provider.hasDistanceLearning} newLabel={t('sheet.new')} />
                  <ServiceRow label={t('service.digitalMaterials')} has={provider.hasDigitalMaterials} newLabel={t('sheet.new')} />
                  <ServiceRow label={t('service.catchUp')} has={provider.hasCatchUpOptions} newLabel={t('sheet.new')} />
                </div>
              </section>
            </div>

            <div className="border-t border-border bg-surface/40 px-7 py-5">
              <a
                href={provider.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90"
              >
                {t('sheet.cta')}
                <ExternalLink className="h-4 w-4" />
              </a>
              <p className="mt-2 truncate text-center text-xs text-muted-foreground">{provider.websiteUrl}</p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}