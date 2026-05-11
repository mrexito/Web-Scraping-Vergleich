"use client";
import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';
import {useTransition} from 'react';

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: 'de' | 'en') => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, {locale: next});
    });
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => switchTo('de')}
        aria-pressed={locale === 'de'}
        disabled={isPending}
        className={
          locale === 'de'
            ? 'rounded-md px-2 py-1 bg-background text-foreground shadow-sm'
            : 'rounded-md px-2 py-1 text-muted-foreground hover:text-foreground transition'
        }
      >
        DE
      </button>
      <button
        type="button"
        onClick={() => switchTo('en')}
        aria-pressed={locale === 'en'}
        disabled={isPending}
        className={
          locale === 'en'
            ? 'rounded-md px-2 py-1 bg-background text-foreground shadow-sm'
            : 'rounded-md px-2 py-1 text-muted-foreground hover:text-foreground transition'
        }
      >
        EN
      </button>
    </div>
  );
}
