"use client";
import {useMemo, useState} from 'react';
import {LayoutGrid, List as ListIcon} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {Provider} from '@/lib/mock-providers';
import {ProviderCard} from './provider-card';
import {ProviderSheet} from './provider-sheet';
import {formatCHF} from '@/lib/format';
import {cn} from '@/lib/utils';

type Sort = 'score' | 'price' | 'name';

export function ComparisonSection({providers}: {providers: Provider[]}) {
  const t = useTranslations();
  const [sort, setSort] = useState<Sort>('score');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [active, setActive] = useState<Provider | null>(null);

  const sorted = useMemo(() => {
    const arr = [...providers];
    arr.sort((a, b) => {
      if (sort === 'score') return b.score - a.score;
      if (sort === 'price') return (a.price ?? Infinity) - (b.price ?? Infinity);
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [providers, sort]);

  return (
    <section id="vergleich" className="mx-auto mt-24 max-w-[1280px] scroll-mt-20 px-6 lg:px-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('compare.heading')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('compare.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm">
            <span className="text-xs text-muted-foreground">{t('compare.sortBy')}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="bg-transparent text-sm font-medium text-foreground outline-none"
            >
              <option value="score">{t('compare.sortScore')}</option>
              <option value="price">{t('compare.sortPrice')}</option>
              <option value="name">{t('compare.sortName')}</option>
            </select>
          </label>

          <div className="flex rounded-lg border border-border bg-surface p-0.5">
            <button
              onClick={() => setView('grid')}
              aria-label={t('compare.viewGrid')}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-md transition-colors',
                view === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              aria-label={t('compare.viewList')}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-md transition-colors',
                view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <ProviderCard key={p.id} provider={p} onOpen={() => setActive(p)} />
          ))}
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t('compare.tableNumber')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('compare.tableName')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('card.score')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('compare.sortPrice')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('compare.tableLocations')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.id} className="border-t border-border transition-colors hover:bg-surface/40">
                  <td className="px-4 py-3 text-muted-foreground" style={{fontVariantNumeric: 'tabular-nums'}}>{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3" style={{fontVariantNumeric: 'tabular-nums'}}>{p.score}</td>
                  <td className="px-4 py-3" style={{fontVariantNumeric: 'tabular-nums'}}>{formatCHF(p.price)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.locations.slice(0, 2).join(', ')}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setActive(p)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t('card.more')} →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProviderSheet provider={active} onClose={() => setActive(null)} />
    </section>
  );
}
