import { Mail } from 'lucide-react';
import { PageShell } from '@/components/lovable/page-shell';

export const metadata = {
  title: 'Über uns | Vergleich Gymi-Vorbereitungskurse',
  description: 'Bachelor-Thesis-Projekt der Berner Fachhochschule — Wirtschaftsinformatik.',
};

const TECH = [
  "Next.js",
  "TypeScript",
  "Tailwind",
  "Supabase",
  "ScrapeGraphAI",
  "Gemini 2.5 Flash",
  "Puppeteer",
  "Bright Data",
  "Zod",
  "Zustand",
];

function Block({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}

export default function AboutPage() {
  return (
    <PageShell title="Über uns">
      <div className="mt-10 grid gap-10 lg:grid-cols-5">
        <div className="space-y-10 lg:col-span-3">
          <Block
            title="Das Projekt"
            body="Dieses Vergleichsportal wurde im Rahmen einer Bachelorarbeit an der Berner Fachhochschule (BFH) entwickelt. 
            Ziel ist es, Eltern und Schülerinnen und Schülern dabei zu unterstützen, den passenden Gymi-Vorbereitungskurs im Kanton Zürich zu finden."
          />
          <Block
            title="Wie funktioniert der Vergleich?"
            body="Das Portal verwendet eine gewichtete Nutzwertanalyse (Multi-Criteria Decision Analysis). 
            Nutzerinnen und Nutzer können selbst festlegen, welche Kriterien ihnen besonders wichtig sind zum Beispiel Preis, Qualität, Flexibilität 
            oder Standort. 
            Basierend auf diesen Gewichtungen werden die Anbieter bewertet und nach Gesamtpunktzahl gerankt."
          />
          <Block
            title="Datenaktualität"
            body="Die Kursdaten werden automatisch über Web-Scraping von den Websites der Anbieter gesammelt und regelmässig aktualisiert. 
            Ein KI-basierter Self-Healing-Mechanismus erkennt strukturelle Änderungen auf den Anbieter-Websites und passt die Scraper automatisch an. 
            Alle Preisangaben dienen als Orientierung massgeblich sind stets die aktuellen Angaben auf den jeweiligen Anbieter-Websites."
          />
          <Block
            title="Berner Fachhochschule"
            body="Diese Arbeit entstand im Studiengang Wirtschaftsinformatik an der Berner Fachhochschule (BFH), Departement Wirtschaft."
          />
        </div>
        <aside className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Technologie
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {TECH.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-xs text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Bachelorarbeit · Berner Fachhochschule · 2026
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
          <div className="mt-1 text-sm text-muted-foreground">Bachelor-Thesis · BFH Wirtschaftsinformatik</div>
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
