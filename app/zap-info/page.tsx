import { PageShell } from '@/components/lovable/page-shell';
import { ExternalLink, Calculator, BookOpen } from 'lucide-react';

export const metadata = {
  title: 'ZAP-Info | Vergleich Gymi-Vorbereitungskurse',
  description: 'Informationen zur Zentralen Aufnahmeprüfung (ZAP) im Kanton Zürich',
};

export default function ZapInfoPage() {
  return (
    <PageShell
      title="ZAP-Info"
      subtitle="Zentrale Aufnahmeprüfung (ZAP) — Kanton Zürich"
    >
      <section className="mt-12 max-w-3xl">
        <h2 className="text-lg font-semibold tracking-tight">Was ist die ZAP?</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Die Zentrale Aufnahmeprüfung (ZAP) ist die Prüfung für den Eintritt ins Gymnasium
          im Kanton Zürich. Sie wird jährlich durchgeführt und prüft die Kenntnisse in
          Mathematik und Deutsch.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Prüfungsfächer</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Calculator className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">Mathematik</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Arithmetik, Algebra, Geometrie
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-semibold">Deutsch</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Aufsatz, Grammatik, Textverständnis
            </p>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Gymnasium-Typen</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold">Langzeitgymnasium</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Eintritt nach der 6. Klasse Primarschule. Prüfung jeweils im März.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold">Kurzzeitgymnasium</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Eintritt nach der 2. Klasse Sekundarschule. Prüfung jeweils im März.
            </p>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Offizielle Quellen</h2>
        <ul className="mt-4 space-y-2">
          <li>
            <a
              href="https://www.zh.ch/de/bildung-schule/schulen/mittelschulen/aufnahmepruefungen.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Offizielle ZAP-Seite Kanton Zürich
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
          <li>
            <a
              href="https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/bildung-schule/schulen/mittelschulen/aufnahmepruefungen/zap-merkblatt.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Merkblatt zur Aufnahmeprüfung (PDF)
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
        </ul>
      </section>

      <div className="mt-10 max-w-3xl rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
        <p className="text-sm text-warning">
          ⚠ Diese Informationen werden regelmässig aktualisiert. Massgeblich sind stets die
          offiziellen Angaben des Kantons Zürich.
        </p>
      </div>
    </PageShell>
  );
}
