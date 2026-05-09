import {Mail} from 'lucide-react';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {PageShell} from '@/components/lovable/page-shell';

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'metadata'});
  return {
    title: t('aboutTitle'),
    description: t('aboutDescription'),
  };
}

const TECH = [
  'Next.js',
  'TypeScript',
  'Tailwind',
  'Supabase',
  'ScrapeGraphAI',
  'Gemini 2.5 Flash',
  'Puppeteer',
  'Bright Data',
  'Zod',
  'Zustand',
];

function Block({title, body}: {title: string; body: string}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: 'about'});

  return (
    <PageShell title={t('title')}>
      <div className="mt-10 grid gap-10 lg:grid-cols-5">
        <div className="space-y-10 lg:col-span-3">
          <Block title={t('s1Title')} body={t('s1Body')} />
          <Block title={t('s2Title')} body={t('s2Body')} />
          <Block title={t('s3Title')} body={t('s3Body')} />
          <Block title={t('s4Title')} body={t('s4Body')} />
        </div>
        <aside className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('techTitle')}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {TECH.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-xs text-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              {t('techFooter')}
            </p>
          </div>
        </aside>
      </div>

      <div className="mt-12 flex justify-center">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl font-semibold text-white shadow-md">
            T
          </div>
          <div className="mt-4 text-lg font-semibold">Tami</div>
          <div className="mt-1 text-sm text-muted-foreground">{t('authorRole')}</div>
          <a
            href="mailto:martt8@bfh.ch"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Mail className="h-4 w-4" />
            martt8@bfh.ch
          </a>
        </div>
      </div>
    </PageShell>
  );
}
