import { Building2, BookOpen, RefreshCw } from 'lucide-react';
import { CountUp } from './count-up';

export interface HeroStatsProps {
  providerCount: number;
  courseCount: number;
  lastUpdated?: Date;
}

export function HeroStats({ providerCount, courseCount, lastUpdated }: HeroStatsProps) {
  const updatedTitle = lastUpdated
    ? lastUpdated.toLocaleDateString('de-CH')
    : undefined;

  const items = [
    { Icon: Building2, value: providerCount, label: 'Anbieter' },
    { Icon: BookOpen, value: courseCount, label: 'Kurse' },
    { Icon: RefreshCw, value: null as number | null, label: 'Aktualisiert', title: updatedTitle },
  ];

  return (
    <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map(({ Icon, value, label, title }, i) => (
        <div
          key={i}
          title={title}
          className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3.5 backdrop-blur"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            {value != null && (
              <div className="text-lg font-semibold leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <CountUp to={value} />
              </div>
            )}
            <div className={value != null ? 'mt-1 text-xs text-muted-foreground' : 'text-sm font-medium'}>
              {label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}