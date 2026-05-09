'use client';
import {ArrowRight, Calendar, MapPin, Wallet, Users} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import type {Provider} from '@/lib/mock-providers';
import {formatCHF} from '@/lib/format';
import {gradientFor} from '@/lib/avatar';
import {cn} from '@/lib/utils';

function ScoreDots({score}: {score: number}) {
  const filled = Math.round((score / 100) * 5);
  return (
    <div className="flex items-center gap-1">
      {Array.from({length: 5}).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i < filled ? 'bg-primary' : 'bg-border',
          )}
        />
      ))}
    </div>
  );
}

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

export function ProviderCard({
  provider,
  onOpen,
}: {
  provider: Provider;
  onOpen: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const description = locale === 'en' && provider.shortDescriptionEn
    ? provider.shortDescriptionEn
    : provider.shortDescription;

  const locs = provider.locations.slice(0, 2).join(', ');
  const more = provider.locations.length > 2 ? ` +${provider.locations.length - 2}` : '';
  const gradient = gradientFor(provider.name);

  const availKey = provider.availability;
  const availText = t(`avail.${availKey}`);

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl border border-border bg-card p-6',
        'shadow-[var(--shadow-card)] transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            'grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br text-base font-semibold text-white shadow-sm',
            gradient,
          )}
          aria-hidden
        >
          {provider.name.charAt(0)}
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('card.score')}
          </div>
          <div className={cn('text-3xl font-semibold leading-none', scoreTone(provider.score))} style={{fontVariantNumeric: 'tabular-nums'}}>
            {provider.score}
          </div>
          <div className="mt-1.5 flex justify-end">
            <ScoreDots score={provider.score} />
          </div>
        </div>
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight">{provider.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      <div className="my-5 h-px bg-border" />

      <dl className="space-y-2 text-sm">
        <div className="flex items-center gap-2.5">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <dd className="font-medium" style={{fontVariantNumeric: 'tabular-nums'}}>{formatCHF(provider.price)}</dd>
          {provider.originalPrice && (
            <span className="text-xs text-muted-foreground line-through" style={{fontVariantNumeric: 'tabular-nums'}}>
              {formatCHF(provider.originalPrice)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <dd>{provider.teachingDays.join(', ')}</dd>
        </div>
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <dd className="truncate">{locs}{more}</dd>
        </div>
        <div className="flex items-center gap-2.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
              availTone(provider.availability),
            )}
          >
            {availText}
          </span>
        </div>
      </dl>

      <div className="mt-6 h-px bg-border" />

      <button
        onClick={onOpen}
        className="mt-5 inline-flex items-center justify-between rounded-[10px] bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t('card.more')}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </article>
  );
}
