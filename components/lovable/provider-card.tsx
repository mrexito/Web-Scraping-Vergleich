'use client';
import {ArrowRight, Calendar, MapPin, Wallet, Users, GitCompare, Check} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {Provider} from '@/lib/provider-types';
import {formatCHF} from '@/lib/format';
import {cn} from '@/lib/utils';
import {useCompareStore} from '@/stores/compareStore';

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

const VALID_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

export function ProviderCard({
  provider,
  onOpen,
}: {
  provider: Provider;
  onOpen: () => void;
}) {
  const t = useTranslations();

  // Hydration-Fix: Zustand-State erst nach Mount lesen (sonst Server/Client-Mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Zustand-Store für Vergleichsfunktion
  const toggleProvider = useCompareStore((s) => s.toggleProvider);
  const isSelectedRaw = useCompareStore((s) => s.isSelected(provider.id));
  const isFullRaw = useCompareStore((s) => s.isFull());

  // Vor Mount: immer false, damit Server und Client identisch rendern
  const isSelected = mounted ? isSelectedRaw : false;
  const isFull = mounted ? isFullRaw : false;

  const locs = provider.locations.slice(0, 2).join(', ');
  const more = provider.locations.length > 2 ? ` +${provider.locations.length - 2}` : '';

  const availKey = provider.availability;
  const availText = t(`avail.${availKey}`);

  const localizedDays = provider.teachingDays
    .map((d) => (VALID_DAYS.includes(d as typeof VALID_DAYS[number]) ? t(`days.${d}`) : d))
    .join(', ');

  const compareDisabled = isFull && !isSelected;

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!compareDisabled) {
      toggleProvider(provider.id);
    }
  };

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl border border-border bg-card p-6',
        'shadow-[var(--shadow-card)] transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]',
        isSelected && 'border-primary/60 ring-1 ring-primary/20',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight pr-4">
          {provider.name}
        </h3>
        <div className="text-right shrink-0">
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
          <dd>{localizedDays}</dd>
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

      <div className="mt-5 flex gap-2">
        <button
          onClick={onOpen}
          className="inline-flex flex-1 items-center justify-between rounded-[10px] bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t('card.more')}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          onClick={handleCompareClick}
          disabled={compareDisabled}
          aria-label={isSelected ? t('compareSelect.remove') : t('compareSelect.add')}
          title={
            compareDisabled
              ? t('compareSelect.maxReached')
              : isSelected
                ? t('compareSelect.remove')
                : t('compareSelect.add')
          }
          className={cn(
            'inline-flex items-center justify-center rounded-[10px] border px-3 py-2.5 text-sm font-medium transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isSelected
              ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
              : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted',
            compareDisabled && 'cursor-not-allowed opacity-40 hover:border-border hover:bg-card',
          )}
        >
          {isSelected ? (
            <Check className="h-4 w-4" />
          ) : (
            <GitCompare className="h-4 w-4" />
          )}
        </button>
      </div>
    </article>
  );
}