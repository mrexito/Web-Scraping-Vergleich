import {Calendar, ClipboardCheck, Mail, GraduationCap, ArrowRight} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {createServerSupabaseClient} from '@/utils/supabase/server';
import {parseZapInfos} from '@/schemas/zapInfoSchema';

interface TimelineStep {
  icon: typeof Calendar;
  label: string;
  value: string;
}

export async function ZapTimeline({locale}: {locale: string}) {
  const t = await getTranslations({locale, namespace: 'zap'});

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const {data: rawZap} = await supabase
    .from('zap_info')
    .select('*')
    .gte('exam_date', today)
    .order('exam_date', {ascending: true})
    .limit(1);

  const zapInfos = parseZapInfos(rawZap ?? []);
  if (zapInfos.length === 0) return null;

  const next = zapInfos[0];
  const examYear = next.exam_date ? new Date(next.exam_date).getFullYear() : new Date().getFullYear();

  const steps: TimelineStep[] = [
    {
      icon: ClipboardCheck,
      label: t('timelineRegistration'),
      value: t('timelineRegistrationValue', {year: examYear}),
    },
    {
      icon: Calendar,
      label: t('timelineExam'),
      value: t('timelineExamValue', {year: examYear}),
    },
    {
      icon: Mail,
      label: t('timelineResults'),
      value: t('timelineResultsMonth', {year: examYear}),
    },
    {
      icon: GraduationCap,
      label: t('timelineSchoolStart'),
      value: t('timelineSchoolStartValue', {year: examYear}),
    },
  ];

  const verifiedDate = new Date(next.last_verified_at).toLocaleDateString(
    locale === 'en' ? 'en-GB' : 'de-CH',
    {day: '2-digit', month: 'long', year: 'numeric'},
  );

  return (
    <section id="zap-timeline" className="mx-auto mt-24 max-w-[1280px] scroll-mt-20 px-6 lg:px-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <header className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('quickInfoTitle')}
            </h3>
            <p className="mt-1 text-base font-semibold tracking-tight">
              {t('schoolYear')} {next.school_year}
            </p>
          </header>

          <ol className="relative space-y-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isLast = i === steps.length - 1;
              return (
                <li key={i} className="relative flex items-start gap-4">
                  {!isLast && (
                    <span
                      aria-hidden
                      className="absolute left-[19px] top-10 h-[calc(100%-1rem)] w-px bg-border"
                    />
                  )}
                  <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="pt-1">
                    <div className="text-sm font-semibold">{step.label}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">{step.value}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
            <p className="text-xs text-muted-foreground">
              Source: zh.ch &mdash; {verifiedDate}
            </p>
            <Link
              href="/zap-info"
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:shadow-[0_0_24px_var(--accent-glow)]"
            >
              {t('quickInfoCta')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
