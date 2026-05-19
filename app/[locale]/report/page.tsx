import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadReportData, METHOD_LABEL, type ScraperMethod } from '@/app/_lib/loadReportData';
import {
  getReportContent,
  type CompletenessSection,
  type ComparisonRow,
} from '@/app/_lib/reportContent';
import { PageShell } from '@/components/lovable/page-shell';

// Server-Component mit Live-Daten — keine statische Generierung
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const data = await loadReportData();
  const content = getReportContent(t);

  // Aggregat-Lookup
  const aggBy = (m: ScraperMethod) => data.aggregates.find((a) => a.method === m);
  const sgiAgg = aggBy('scrapegraphai');
  const pupAgg = aggBy('puppeteer');
  const bdAgg = aggBy('brightdata');

  // Provider-Coverage
  const fullyCovered = data.providers.filter(
    (p) => p.scrapegraphai > 0 && p.puppeteer > 0 && p.brightdata > 0,
  );

  // Date-Locale: 'de-CH' für DE-Mode, 'en-GB' für EN-Mode
  const dateLocale = locale === 'de' ? 'de-CH' : 'en-GB';
  const formattedDate = new Date().toLocaleString(dateLocale);

  return (
    <PageShell title={t('report.header.title')} subtitle={t('report.header.intro')}>
      {/* === Sub-Header: Kicker + Kriterien-Liste + Status === */}
      <div className="mt-8 mb-12 pb-8 border-b border-border">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          {t('report.header.kicker')}
        </p>
        <ul className="list-disc pl-6 text-foreground leading-relaxed text-sm space-y-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i}>{t(`report.header.criteria.${i}`)}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-4">
          {t('report.header.statusLine', {
            date: formattedDate,
            courses: data.total_courses,
            providers: data.providers.length,
            runs: data.total_runs,
          })}
        </p>
      </div>

      {/* ================================================================ */}
      {/* 1. VOLLSTÄNDIGKEIT */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          {t('report.section1.title')}
        </h2>
        <p className="text-sm text-muted-foreground italic mb-4">
          {t('report.section1.subtitle')}
        </p>
        <p className="text-foreground leading-relaxed mb-5">
          {t('report.section1.intro')}
        </p>

        {/* Live-Coverage-Matrix für alle 12 Anbieter */}
        <h3 className="text-base font-semibold mb-3 mt-6">
          {t('report.section1.liveDataTitle')}
        </h3>
        <div className="overflow-x-auto mb-2 rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface/60">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {t('report.labels.provider')}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {t('report.methods.puppeteer')}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {t('report.methods.brightdata')}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {t('report.methods.sgi')}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {t('report.labels.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.puppeteer || '–'}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.brightdata || '–'}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.scrapegraphai || '–'}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{p.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface/60">
              <tr className="font-semibold border-t border-border">
                <td className="px-4 py-2.5">{t('report.labels.total')}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {data.providers.reduce((s, p) => s + p.puppeteer, 0)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {data.providers.reduce((s, p) => s + p.brightdata, 0)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {data.providers.reduce((s, p) => s + p.scrapegraphai, 0)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{data.total_courses}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-muted-foreground italic mb-6">
          {t('report.section1.caption11')}
        </p>

        {/* Detail GZ */}
        <h3 className="text-base font-semibold mb-3 mt-6">
          {content.completenessGz.provider}
        </h3>
        <CompletenessTable data={content.completenessGz} t={t} />
        <p className="text-xs text-muted-foreground italic mb-6">
          {t('report.section1.caption12')}
        </p>

        {/* Detail Avidii */}
        <h3 className="text-base font-semibold mb-3 mt-6">
          {content.completenessAvidii.provider}
        </h3>
        <CompletenessTable data={content.completenessAvidii} t={t} />
        <p className="text-xs text-muted-foreground italic mb-6">
          {t('report.section1.caption13')}
        </p>

        <p className="text-foreground leading-relaxed">
          {t('report.section1.fullCoverageNote', {
            count: fullyCovered.length,
            names: fullyCovered.map((p) => p.name).join(', ') || '–',
          })}
        </p>
      </section>

      {/* ================================================================ */}
      {/* 2. GENAUIGKEIT */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          {t('report.section2.title')}
        </h2>
        <p className="text-sm text-muted-foreground italic mb-4">
          {t('report.section2.subtitle')}
        </p>
        <p className="text-foreground leading-relaxed mb-5">
          {t('report.section2.intro')}
        </p>
        <ComparisonTable
          rows={content.accuracyRows}
          firstColLabel={t('report.labels.aspect')}
          t={t}
        />
        <p className="text-xs text-muted-foreground italic mb-2">
          {t('report.section2.caption')}
        </p>
        <p className="text-foreground leading-relaxed mt-4">
          {t('report.section2.outro')}
        </p>
      </section>

      {/* ================================================================ */}
      {/* 3. ZUVERLÄSSIGKEIT */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          {t('report.section3.title')}
        </h2>
        <p className="text-sm text-muted-foreground italic mb-4">
          {t('report.section3.subtitle')}
        </p>
        <p className="text-foreground leading-relaxed mb-5">
          {t('report.section3.intro')}
        </p>

        {/* Live-Statistik */}
        <h3 className="text-base font-semibold mb-3">
          {t('report.section3.successRateTitle')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <KpiBox
            label={t('report.methods.puppeteer')}
            value={t('report.labels.successOf', {
              success: pupAgg?.success_runs ?? 0,
              total: pupAgg?.total_runs ?? 0,
            })}
            sub={t('report.labels.successRate', { pct: pupAgg?.success_rate_pct ?? 0 })}
          />
          <KpiBox
            label={t('report.methods.brightdata')}
            value={t('report.labels.successOf', {
              success: bdAgg?.success_runs ?? 0,
              total: bdAgg?.total_runs ?? 0,
            })}
            sub={t('report.labels.successRate', { pct: bdAgg?.success_rate_pct ?? 0 })}
          />
          <KpiBox
            label={t('report.methods.sgi')}
            value={t('report.labels.successOf', {
              success: sgiAgg?.success_runs ?? 0,
              total: sgiAgg?.total_runs ?? 0,
            })}
            sub={t('report.labels.successRate', { pct: sgiAgg?.success_rate_pct ?? 0 })}
          />
        </div>
        <p className="text-xs text-muted-foreground italic mb-6">
          {t('report.section3.caption31')}
        </p>

        {/* Qualitative Zuverlässigkeitsanalyse */}
        <h3 className="text-base font-semibold mb-3">
          {t('report.section3.riskProfileTitle')}
        </h3>
        <ComparisonTable
          rows={content.reliabilityRows}
          firstColLabel={t('report.labels.criterion')}
          t={t}
        />
        <p className="text-xs text-muted-foreground italic mb-2">
          {t('report.section3.caption')}
        </p>
        <p className="text-foreground leading-relaxed mt-4">
          {t('report.section3.outro')}
        </p>
      </section>

      {/* ================================================================ */}
      {/* 4. AUFWAND & KOSTEN */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          {t('report.section4.title')}
        </h2>
        <p className="text-sm text-muted-foreground italic mb-4">
          {t('report.section4.subtitle')}
        </p>
        <p className="text-foreground leading-relaxed mb-5">
          {t('report.section4.intro')}
        </p>
        <ComparisonTable
          rows={content.effortRows}
          firstColLabel={t('report.labels.criterion')}
          t={t}
        />
        <p className="text-xs text-muted-foreground italic">
          {t('report.section4.caption')}
        </p>
      </section>

      {/* ================================================================ */}
      {/* 5. PERFORMANCE */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          {t('report.section5.title')}
        </h2>
        <p className="text-sm text-muted-foreground italic mb-4">
          {t('report.section5.subtitle')}
        </p>
        <p className="text-foreground leading-relaxed mb-5">
          {t('report.section5.intro', { runs: data.runs.length })}
        </p>

        {/* Live-KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <KpiBox
            label={t('report.methods.puppeteer')}
            value={t('report.labels.courseSeconds', {
              value: pupAgg?.avg_duration_s ?? '–',
            })}
            sub={t('report.labels.medianRuns', {
              median: pupAgg?.median_duration_s ?? '–',
              runs: pupAgg?.total_runs ?? 0,
            })}
          />
          <KpiBox
            label={t('report.methods.brightdata')}
            value={t('report.labels.courseSeconds', {
              value: bdAgg?.avg_duration_s ?? '–',
            })}
            sub={t('report.labels.medianRuns', {
              median: bdAgg?.median_duration_s ?? '–',
              runs: bdAgg?.total_runs ?? 0,
            })}
          />
          <KpiBox
            label={t('report.methods.sgi')}
            value={t('report.labels.courseSeconds', {
              value: sgiAgg?.avg_duration_s ?? '–',
            })}
            sub={t('report.labels.medianRuns', {
              median: sgiAgg?.median_duration_s ?? '–',
              runs: sgiAgg?.total_runs ?? 0,
            })}
          />
        </div>
        <p className="text-xs text-muted-foreground italic mb-6">
          {t('report.section5.caption51')}
        </p>

        {/* Bar-Chart */}
        <h3 className="text-base font-semibold mb-3">
          {t('report.section5.visualizationTitle')}
        </h3>
        <div className="rounded-2xl border border-border bg-card p-5 mb-6 shadow-[var(--shadow-card)]">
          {data.aggregates.map((agg) => {
            const maxDur = Math.max(...data.aggregates.map((a) => a.avg_duration_s ?? 0), 1);
            const widthPct = ((agg.avg_duration_s ?? 0) / maxDur) * 100;
            return (
              <div key={agg.method} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{METHOD_LABEL[agg.method]}</span>
                  <span className="font-mono text-muted-foreground">
                    {agg.avg_duration_s ?? '–'} s
                  </span>
                </div>
                <div className="h-6 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <h3 className="text-base font-semibold mb-3">
          {t('report.section5.propertiesTitle')}
        </h3>
        <ComparisonTable
          rows={content.performanceNotes}
          firstColLabel={t('report.labels.criterion')}
          t={t}
        />
        <p className="text-xs text-muted-foreground italic mt-2">
          {t('report.section5.caption')}
        </p>
      </section>

      {/* ================================================================ */}
      {/* 6. ENTWICKLER-ERFAHRUNG */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          {t('report.section6.title')}
        </h2>
        <p className="text-sm text-muted-foreground italic mb-4">
          {t('report.section6.subtitle')}
        </p>
        <p className="text-foreground leading-relaxed mb-5">
          {t('report.section6.intro')}
        </p>
        <ComparisonTable
          rows={content.developerExperienceRows}
          firstColLabel={t('report.labels.criterion')}
          t={t}
        />
        <p className="text-xs text-muted-foreground italic mt-2">
          {t('report.section6.caption')}
        </p>
      </section>

      {/* ================================================================ */}
      {/* FAZIT */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-3">
          {t('report.conclusion.title')}
        </h2>
        <p className="text-foreground leading-relaxed">{t('report.conclusion.body')}</p>
      </section>

      <footer className="mt-16 pt-6 border-t border-border text-xs text-muted-foreground">
        <p>{t('report.footer')}</p>
      </footer>
    </PageShell>
  );
}

// HILFSKOMPONENTEN

type Translator = (key: string, values?: Record<string, string | number>) => string;

function CompletenessTable({
  data,
  t,
}: {
  data: CompletenessSection;
  t: Translator;
}) {
  return (
    <div className="overflow-x-auto mb-2 rounded-xl border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-surface/60">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {t('report.labels.criterion')}
            </th>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {t('report.methods.puppeteer')}
            </th>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {t('report.methods.brightdata')}
            </th>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {t('report.methods.sgi')}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              <td className="px-4 py-2 font-medium">{r.feld}</td>
              <td className="px-4 py-2 font-mono text-xs">
                {r.puppeteer}
                {r.note_pup && (
                  <span className="block text-muted-foreground italic">{r.note_pup}</span>
                )}
              </td>
              <td className="px-4 py-2 font-mono text-xs">
                {r.brightdata}
                {r.note_bd && (
                  <span className="block text-muted-foreground italic">{r.note_bd}</span>
                )}
              </td>
              <td className="px-4 py-2 font-mono text-xs">
                {r.sgi}
                {r.note_sgi && (
                  <span className="block text-muted-foreground italic">{r.note_sgi}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonTable({
  rows,
  firstColLabel,
  t,
}: {
  rows: ComparisonRow[];
  firstColLabel: string;
  t: Translator;
}) {
  return (
    <div className="overflow-x-auto mb-2 rounded-xl border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-surface/60">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {firstColLabel}
            </th>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {t('report.methods.puppeteer')}
            </th>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {t('report.methods.brightdata')}
            </th>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              {t('report.methods.sgi')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              <td className="px-4 py-2 font-medium">{r.kriterium ?? r.aspekt}</td>
              <td className="px-4 py-2 text-xs">{r.puppeteer}</td>
              <td className="px-4 py-2 text-xs">{r.brightdata}</td>
              <td className="px-4 py-2 text-xs">{r.sgi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KpiBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
