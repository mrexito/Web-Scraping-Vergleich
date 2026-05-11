import {Calendar, ExternalLink, BookOpen, Calculator, ClipboardCheck, GraduationCap} from 'lucide-react';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {PageShell} from '@/components/lovable/page-shell';
import {createServerSupabaseClient} from '@/utils/supabase/server';
import {parseZapInfos, type ZapInfo} from '@/schemas/zapInfoSchema';

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'metadata'});
  return {
    title: t('zapTitle'),
    description: t('zapDescription'),
  };
}

function formatDate(dateString: string | null | undefined, locale: string): string | null {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  const dateLocale = locale === 'en' ? 'en-GB' : 'de-CH';
  return d.toLocaleDateString(dateLocale, {day: '2-digit', month: 'long', year: 'numeric'});
}

function ZapEntry({
  info,
  locale,
  t,
}: {
  info: ZapInfo;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const regStart = formatDate(info.registration_start, locale);
  const regEnd = formatDate(info.registration_end, locale);
  const examDate = formatDate(info.exam_date, locale);
  const lastVerified = formatDate(info.last_verified_at, locale);

  const subjectsToShow = locale === 'en' && info.exam_subjects_en && info.exam_subjects_en.length > 0
    ? info.exam_subjects_en
    : info.exam_subjects;

  const notesToShow = locale === 'en' && info.notes_en
    ? info.notes_en
    : info.notes;

  const scopeKey = info.scope === 'k_und_s'
    ? 'scopeKundS'
    : info.scope === 'langgymi' ? 'scopeLanggymi'
    : info.scope === 'kurzgymi' ? 'scopeKurzgymi'
    : info.scope === 'fms' ? 'scopeFms'
    : info.scope === 'bms' ? 'scopeBms'
    : 'scopeIms';

  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{t(scopeKey)}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('schoolYear')} {info.school_year}</p>
        </div>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {t('sourceLabel')} {lastVerified}
        </span>
      </header>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {(regStart || regEnd) && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <ClipboardCheck className="h-4 w-4" />
            </span>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t('registration')}</dt>
              <dd className="mt-1 text-sm font-medium">
                {regStart && regEnd
                  ? t('regBetween', {from: regStart, to: regEnd})
                  : (regStart || regEnd) ?? ''}
              </dd>
            </div>
          </div>
        )}

        {examDate && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </span>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t('examDate')}</dt>
              <dd className="mt-1 text-sm font-medium">
                {examDate}
                {info.exam_time_info && (
                  <span className="block text-xs text-muted-foreground">{info.exam_time_info}</span>
                )}
              </dd>
            </div>
          </div>
        )}
      </dl>

      {subjectsToShow && subjectsToShow.length > 0 && (
        <section className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('examParts')}
          </h4>
          <ul className="mt-3 space-y-2">
            {subjectsToShow.map((subject, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">{subject.name}</span>
                <span className="text-xs text-muted-foreground" style={{fontVariantNumeric: 'tabular-nums'}}>
                  {subject.duration}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notesToShow && (
        <p className="mt-5 rounded-lg border border-border bg-surface/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {notesToShow}
        </p>
      )}

      <a
        href={info.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        {t('officialSource')}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

export default async function ZapInfoPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: 'zap'});

  const supabase = await createServerSupabaseClient();
  const {data: rawZap, error} = await supabase
    .from('zap_info')
    .select('*')
    .order('school_year', {ascending: true})
    .order('scope', {ascending: true});

  if (error) {
    console.error('Fehler beim Laden der ZAP-Daten:', error);
  }

  const zapInfos = parseZapInfos(rawZap ?? []);

  const grouped = zapInfos.reduce<Record<string, ZapInfo[]>>((acc, info) => {
    if (!acc[info.school_year]) acc[info.school_year] = [];
    acc[info.school_year].push(info);
    return acc;
  }, {});

  const schoolYears = Object.keys(grouped).sort();

  return (
    <PageShell title={t('title')} subtitle={t('subtitle')}>
      <section className="mt-12 max-w-3xl">
        <h2 className="text-lg font-semibold tracking-tight">{t('whatTitle')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t('whatBody')}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">{t('typesTitle')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">{t('longTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('longBody')}
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">{t('shortTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('shortBody')}
            </p>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">{t('subjectsTitle')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Calculator className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">{t('mathTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('mathBody')}</p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">{t('germanTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('germanBody')}
            </p>
          </article>
        </div>
      </section>

      {schoolYears.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">{t('datesTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('datesSubtitle')}
          </p>

          {schoolYears.map((year) => (
            <div key={year} className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t('schoolYear')} {year}
              </h3>
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                {grouped[year].map((info) => (
                  <ZapEntry key={info.id} info={info} locale={locale} t={t} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="mt-12 max-w-3xl rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
        <p className="text-sm text-warning">
          ⚠ {t('disclaimer')}
        </p>
      </div>
    </PageShell>
  );
}
