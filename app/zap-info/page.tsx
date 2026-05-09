import { Calendar, ExternalLink, BookOpen, Calculator, ClipboardCheck, GraduationCap } from 'lucide-react';
import { PageShell } from '@/components/lovable/page-shell';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { parseZapInfos, type ZapInfo, type ZapInfoScope } from '@/schemas/zapInfoSchema';

export const metadata = {
  title: 'ZAP-Info | Vergleich Gymi-Vorbereitungskurse',
  description: 'Termine und Informationen zur Zentralen Aufnahmeprüfung (ZAP) im Kanton Zürich',
};

const SCOPE_LABELS: Record<ZapInfoScope, string> = {
  langgymi: 'Langgymnasium',
  kurzgymi: 'Kurzgymnasium',
  fms: 'Fachmittelschule (FMS)',
  bms: 'Berufsmaturitätsschule (BMS)',
  ims: 'Informatikmittelschule (IMS)',
  k_und_s: 'Kunst- und Sportgymnasium',
};

function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric' });
}

function ZapEntry({ info }: { info: ZapInfo }) {
  const regStart = formatDate(info.registration_start);
  const regEnd = formatDate(info.registration_end);
  const examDate = formatDate(info.exam_date);
  const lastVerified = formatDate(info.last_verified_at);

  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{SCOPE_LABELS[info.scope]}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Schuljahr {info.school_year}</p>
        </div>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Quelle: zh.ch · {lastVerified}
        </span>
      </header>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {(regStart || regEnd) && (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <ClipboardCheck className="h-4 w-4" />
            </span>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Anmeldefrist</dt>
              <dd className="mt-1 text-sm font-medium">
                {regStart && regEnd
                  ? `${regStart} bis ${regEnd}`
                  : regStart || regEnd}
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
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Prüfungsdatum</dt>
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

      {info.exam_subjects && info.exam_subjects.length > 0 && (
        <section className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prüfungsteile
          </h4>
          <ul className="mt-3 space-y-2">
            {info.exam_subjects.map((subject, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">{subject.name}</span>
                <span className="text-xs text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {subject.duration}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {info.notes && (
        <p className="mt-5 rounded-lg border border-border bg-surface/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {info.notes}
        </p>
      )}

      <a
        href={info.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        Offizielle Seite Kanton Zürich
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

export default async function ZapInfoPage() {
  const supabase = await createServerSupabaseClient();
  const { data: rawZap, error } = await supabase
    .from('zap_info')
    .select('*')
    .order('school_year', { ascending: true })
    .order('scope', { ascending: true });

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
    <PageShell
      title="ZAP-Info"
      subtitle="Zentrale Aufnahmeprüfung (ZAP) — Kanton Zürich. Termine und Informationen direkt aus offiziellen Quellen (zh.ch)."
    >
      <section className="mt-12 max-w-3xl">
        <h2 className="text-lg font-semibold tracking-tight">Was ist die ZAP?</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Die Zentrale Aufnahmeprüfung (ZAP) ist die Prüfung für den Eintritt in eine Mittel- oder
          Berufsmaturitätsschule im Kanton Zürich. Sie wird jährlich im März durchgeführt und prüft
          die Kenntnisse in Mathematik und Deutsch.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Gymnasium-Typen</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">Langzeitgymnasium</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              6 Jahre · Eintritt nach der 6. Klasse Primarschule
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">Kurzzeitgymnasium</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              4 Jahre · Eintritt nach der 2. oder 3. Klasse Sekundarschule
            </p>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Prüfungsfächer</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Calculator className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">Mathematik</h3>
            <p className="mt-1 text-sm text-muted-foreground">Arithmetik, Algebra, Geometrie</p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">Deutsch</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Textverständnis, Sprachbetrachtung, Aufsatz
            </p>
          </article>
        </div>
      </section>

      {schoolYears.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Termine nach Schuljahr</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Daten verifiziert aus offiziellen Quellen des Kantons Zürich (zh.ch).
          </p>

          {schoolYears.map((year) => (
            <div key={year} className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Schuljahr {year}
              </h3>
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                {grouped[year].map((info) => (
                  <ZapEntry key={info.id} info={info} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="mt-12 max-w-3xl rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
        <p className="text-sm text-warning">
          ⚠ Diese Daten werden manuell aus offiziellen Quellen (zh.ch) verifiziert. Massgeblich
          sind stets die offiziellen Angaben des Kantons Zürich. Eine vollautomatisierte
          Aktualisierung über Web-Scraping ist als Future Work in der Roadmap definiert.
        </p>
      </div>
    </PageShell>
  );
}
