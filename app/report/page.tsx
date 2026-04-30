import { loadReportData, METHOD_LABEL, type ScraperMethod } from '@/app/_lib/loadReportData';
import {
  COMPLETENESS_GZ,
  COMPLETENESS_AVIDII,
  ACCURACY_ROWS,
  RELIABILITY_ROWS,
  EFFORT_ROWS,
  PERFORMANCE_NOTES,
  DEVELOPER_EXPERIENCE_ROWS,
  REPORT_INTRO,
  REPORT_CONCLUSION,
  type CompletenessSection,
  type ComparisonRow,
} from '@/app/_lib/reportContent';

// Kriterien zum Vergleich
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportPage() {
  const data = await loadReportData();

  // Aggregat-Lookup
  const aggBy = (m: ScraperMethod) => data.aggregates.find((a) => a.method === m);
  const sgiAgg = aggBy('scrapegraphai');
  const pupAgg = aggBy('puppeteer');
  const bdAgg  = aggBy('brightdata');

  // Provider-Coverage
  const fullyCovered = data.providers.filter(
    (p) => p.scrapegraphai > 0 && p.puppeteer > 0 && p.brightdata > 0
  );

  return (
    <div className="container mx-auto px-4 sm:px-8 py-10 max-w-4xl">
      {/* === Titel === */}
      <header className="mb-12 pb-6 border-b">
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">
          Bachelorthesis · Vergleichsportal Gymivorbereitungskurse Zürich
        </p>
        <h1 className="text-3xl font-serif mb-3">Vergleich der Scraping-Methoden</h1>
        <p className="text-gray-700 leading-relaxed">{REPORT_INTRO}</p>
        <p className="text-xs text-gray-500 mt-3">
          Stand: {new Date().toLocaleString('de-CH')} ·
          Datenbasis: {data.total_courses} Kurse, {data.providers.length} Anbieter, {data.total_runs} Läufe
        </p>
      </header>

      {/* ================================================================ */}
      {/* 1. VOLLSTÄNDIGKEIT */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-serif mb-2">1. Vollständigkeit</h2>
        <p className="text-sm text-gray-500 italic mb-4">
          Wie viele der erwarteten Kurse und Felder werden tatsächlich extrahiert?
        </p>
        <p className="text-gray-700 leading-relaxed mb-5">
          Die Vollständigkeitsanalyse betrachtet zwei Anbieter, für die alle drei Methoden
          implementiert wurden: Gymivorbereitung Zürich (26 erwartete Kurse) und Avidii (14
          erwartete Kurse). Sie zeigt sowohl die Anzahl gefundener Kurse als auch die
          Befüllung kritischer Felder.
        </p>

        {/* Live-Coverage-Matrix für alle 12 Anbieter */}
        <h3 className="text-base font-semibold mb-2 mt-6">Live-Daten: Kurse pro Anbieter und Methode</h3>
        <div className="overflow-x-auto mb-2">
          <table className="min-w-full text-sm border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold border-b">Anbieter</th>
                <th className="px-4 py-2 text-right font-semibold border-b">Puppeteer</th>
                <th className="px-4 py-2 text-right font-semibold border-b">Bright Data</th>
                <th className="px-4 py-2 text-right font-semibold border-b">ScrapeGraphAI</th>
                <th className="px-4 py-2 text-right font-semibold border-b">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((p) => (
                <tr key={p.id} className="border-b border-gray-200">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.puppeteer || '–'}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.brightdata || '–'}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.scrapegraphai || '–'}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{p.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="font-semibold">
                <td className="px-4 py-2 border-t border-gray-300">Total</td>
                <td className="px-4 py-2 text-right font-mono border-t border-gray-300">
                  {data.providers.reduce((s, p) => s + p.puppeteer, 0)}
                </td>
                <td className="px-4 py-2 text-right font-mono border-t border-gray-300">
                  {data.providers.reduce((s, p) => s + p.brightdata, 0)}
                </td>
                <td className="px-4 py-2 text-right font-mono border-t border-gray-300">
                  {data.providers.reduce((s, p) => s + p.scrapegraphai, 0)}
                </td>
                <td className="px-4 py-2 text-right font-mono border-t border-gray-300">{data.total_courses}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-gray-500 italic mb-6">
          Tabelle 1.1: Anzahl extrahierter Kurse je Anbieter und Methode (Live-Daten aus Datenbank).
        </p>

        {/* Detail GZ */}
        <h3 className="text-base font-semibold mb-2 mt-6">{COMPLETENESS_GZ.provider}</h3>
        <CompletenessTable data={COMPLETENESS_GZ} />
        <p className="text-xs text-gray-500 italic mb-6">
          Tabelle 1.2: Felder-Coverage Gymivorbereitung Zürich (manuell aus Scraper-Outputs ermittelt).
        </p>

        {/* Detail Avidii */}
        <h3 className="text-base font-semibold mb-2 mt-6">{COMPLETENESS_AVIDII.provider}</h3>
        <CompletenessTable data={COMPLETENESS_AVIDII} />
        <p className="text-xs text-gray-500 italic mb-6">
          Tabelle 1.3: Felder-Coverage Avidii (manuell aus Scraper-Outputs ermittelt).
        </p>

        <p className="text-gray-700 leading-relaxed">
          Vollständige Drei-Wege-Abdeckung besteht für {fullyCovered.length} Anbieter
          ({fullyCovered.map((p) => p.name).join(', ') || '–'}). Bei der Felder-Coverage zeigt
          sich, dass Bright Data bei Datumsfeldern dem Puppeteer-Scraper überlegen ist
          (Puppeteer: nicht implementiert für GZ), während ScrapeGraphAI bei langgymi
          weitgehend gut abdeckt, kurzgymi-Datumsangaben jedoch verloren gehen.
        </p>
      </section>

      {/* ================================================================ */}
      {/* 2. GENAUIGKEIT */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-serif mb-2">2. Genauigkeit</h2>
        <p className="text-sm text-gray-500 italic mb-4">
          Stimmen die extrahierten Werte? Werden Formate korrekt umgewandelt?
        </p>
        <p className="text-gray-700 leading-relaxed mb-5">
          Während die Vollständigkeit beziffert, wie viele Werte vorhanden sind, zeigt die
          Genauigkeit, wie korrekt diese Werte sind. Die folgende Übersicht stellt die
          Extraktions-Strategien der drei Methoden für die wichtigsten Felder gegenüber.
        </p>
        <ComparisonTable rows={ACCURACY_ROWS} firstColLabel="Aspekt" />
        <p className="text-xs text-gray-500 italic mb-2">
          Tabelle 2: Vergleich der Extraktions-Genauigkeit pro Datenfeld.
        </p>
        <p className="text-gray-700 leading-relaxed mt-4">
          Die Analyse zeigt, dass alle drei Methoden bei einfachen Werten (Preise) gleichwertig
          arbeiten. Unterschiede entstehen bei komplexeren Konvertierungen (Datumsformat,
          Verfügbarkeitsstatus): hier zahlt sich die manuelle Implementation der Puppeteer-Skripte
          aus, während Bright Data einen sauberen Mittelweg zwischen Aufwand und Genauigkeit
          bietet. ScrapeGraphAI ist sehr abhängig von der Qualität des Prompts und der
          Webseiten-Struktur.
        </p>
      </section>

      {/* ================================================================ */}
      {/* 3. ZUVERLÄSSIGKEIT */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-serif mb-2">3. Zuverlässigkeit</h2>
        <p className="text-sm text-gray-500 italic mb-4">
          Wie konsistent sind die Ergebnisse? Wie viele Läufe scheitern?
        </p>
        <p className="text-gray-700 leading-relaxed mb-5">
          Zuverlässigkeit misst, wie häufig ein Scraper-Lauf erfolgreich abschliesst und
          wie konsistent die Ergebnisse über mehrere Läufe hinweg sind. Die folgenden
          Live-Daten stammen aus der <code>scrape_runs</code>-Tabelle.
        </p>

        {/* Live-Statistik */}
        <h3 className="text-base font-semibold mb-2">Live-Daten: Erfolgsrate pro Methode</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <KpiBox
            label="Puppeteer"
            value={`${pupAgg?.success_runs ?? 0} / ${pupAgg?.total_runs ?? 0}`}
            sub={`${pupAgg?.success_rate_pct ?? 0}% Erfolg`}
          />
          <KpiBox
            label="Bright Data"
            value={`${bdAgg?.success_runs ?? 0} / ${bdAgg?.total_runs ?? 0}`}
            sub={`${bdAgg?.success_rate_pct ?? 0}% Erfolg`}
          />
          <KpiBox
            label="ScrapeGraphAI"
            value={`${sgiAgg?.success_runs ?? 0} / ${sgiAgg?.total_runs ?? 0}`}
            sub={`${sgiAgg?.success_rate_pct ?? 0}% Erfolg`}
          />
        </div>
        <p className="text-xs text-gray-500 italic mb-6">
          Abbildung 3.1: Erfolgreiche vs. gesamte Läufe pro Methode (Live aus Datenbank).
        </p>

        {/* Qualitative Zuverlässigkeitsanalyse */}
        <h3 className="text-base font-semibold mb-2">Risiko-Profile</h3>
        <ComparisonTable rows={RELIABILITY_ROWS} firstColLabel="Kriterium" />
        <p className="text-xs text-gray-500 italic mb-2">
          Tabelle 3: Qualitative Risikoanalyse der drei Methoden.
        </p>

        <p className="text-gray-700 leading-relaxed mt-4">
          Im Live-Betrieb erreichen alle drei Methoden eine hohe Erfolgsrate, allerdings mit
          unterschiedlichen Versagens-Mustern: Puppeteer scheitert primär an
          DOM-Strukturänderungen, Bright Data an externen Timeouts, und ScrapeGraphAI
          bei JSON-Parsing-Fehlern wenn das LLM ungültige Antworten liefert.
        </p>
      </section>

      {/* ================================================================ */}
      {/* 4. AUFWAND & KOSTEN */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-serif mb-2">4. Aufwand & Kosten</h2>
        <p className="text-sm text-gray-500 italic mb-4">
          Wie aufwendig ist die Implementierung? Welche laufenden Kosten entstehen?
        </p>
        <p className="text-gray-700 leading-relaxed mb-5">
          Diese Dimension betrachtet die initiale Implementierung, den Wartungsaufwand
          und die laufenden Betriebskosten. Da BFH-Studierende kostenlosen Zugang zum
          internen LLM haben, fallen für ScrapeGraphAI keine Lizenzkosten an — Bright Data
          ist hier die einzige kostenpflichtige Methode.
        </p>
        <ComparisonTable rows={EFFORT_ROWS} firstColLabel="Kriterium" />
        <p className="text-xs text-gray-500 italic">
          Tabelle 4: Aufwand- und Kostenvergleich.
        </p>
      </section>

      {/* ================================================================ */}
      {/* 5. PERFORMANCE */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-serif mb-2">5. Performance</h2>
        <p className="text-sm text-gray-500 italic mb-4">
          Wie schnell läuft ein Scraper? Wo sind die Flaschenhälse?
        </p>
        <p className="text-gray-700 leading-relaxed mb-5">
          Die Laufzeit-Daten stammen direkt aus der Datenbank ({data.runs.length} aufgezeichnete
          Läufe). Pro Methode wird der Mittelwert und der Median berechnet.
        </p>

        {/* Live-KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <KpiBox
            label="Puppeteer"
            value={`${pupAgg?.avg_duration_s ?? '–'} s`}
            sub={`Median: ${pupAgg?.median_duration_s ?? '–'} s · ${pupAgg?.total_runs ?? 0} Läufe`}
          />
          <KpiBox
            label="Bright Data"
            value={`${bdAgg?.avg_duration_s ?? '–'} s`}
            sub={`Median: ${bdAgg?.median_duration_s ?? '–'} s · ${bdAgg?.total_runs ?? 0} Läufe`}
          />
          <KpiBox
            label="ScrapeGraphAI"
            value={`${sgiAgg?.avg_duration_s ?? '–'} s`}
            sub={`Median: ${sgiAgg?.median_duration_s ?? '–'} s · ${sgiAgg?.total_runs ?? 0} Läufe`}
          />
        </div>
        <p className="text-xs text-gray-500 italic mb-6">
          Abbildung 5.1: Durchschnittliche Laufzeit pro Methode (Live aus Datenbank).
        </p>

        {/* Bar-Chart */}
        <h3 className="text-base font-semibold mb-2">Visualisierung der Laufzeit</h3>
        <div className="bg-white border rounded p-5 mb-6">
          {data.aggregates.map((agg) => {
            const maxDur = Math.max(...data.aggregates.map((a) => a.avg_duration_s ?? 0), 1);
            const widthPct = ((agg.avg_duration_s ?? 0) / maxDur) * 100;
            return (
              <div key={agg.method} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{METHOD_LABEL[agg.method]}</span>
                  <span className="font-mono">{agg.avg_duration_s ?? '–'} s</span>
                </div>
                <div className="h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-gray-700"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <h3 className="text-base font-semibold mb-2">Performance-Eigenschaften</h3>
        <ComparisonTable rows={PERFORMANCE_NOTES} firstColLabel="Kriterium" />
        <p className="text-xs text-gray-500 italic mt-2">
          Tabelle 5: Architektur-bedingte Performance-Eigenschaften.
        </p>
      </section>

      {/* ================================================================ */}
      {/* 6. ENTWICKLER-ERFAHRUNG (NEU) */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-serif mb-2">6. Entwickler-Erfahrung</h2>
        <p className="text-sm text-gray-500 italic mb-4">
          Wie war die persönliche Erfahrung beim Implementieren?
        </p>
        <p className="text-gray-700 leading-relaxed mb-5">
          Während die fünf vorhergehenden Kriterien objektiv messbare Aspekte abbilden,
          beleuchtet dieses Kapitel die qualitative Entwickler-Erfahrung — also Lernkurve,
          Frustrations-Quellen und subjektiver Eindruck. Diese Dimension ergänzt die
          quantitativen Daten und dokumentiert das praktische Arbeiten mit den Methoden.
        </p>
        <ComparisonTable rows={DEVELOPER_EXPERIENCE_ROWS} firstColLabel="Kriterium" />
        <p className="text-xs text-gray-500 italic mt-2">
          Tabelle 6: Entwickler-Erfahrungs-Reflexion.
        </p>
      </section>

      {/* ================================================================ */}
      {/* FAZIT */}
      {/* ================================================================ */}
      <section className="mb-12">
        <h2 className="text-2xl font-serif mb-3">Fazit</h2>
        <p className="text-gray-700 leading-relaxed">{REPORT_CONCLUSION}</p>
      </section>

      <footer className="mt-16 pt-6 border-t text-xs text-gray-500">
        <p>
          Live-Daten dieses Berichts werden bei jedem Aufruf aus der Datenbank geladen.
          Quellen: Tabellen <code>scrape_runs</code>, <code>scrape_errors</code>,
          <code> courses</code>, <code>GymiProviders</code>. Statische Inhalte siehe{' '}
          <code>app/_lib/reportContent.ts</code>.
        </p>
      </footer>
    </div>
  );
}

// HILFSKOMPONENTEN
function CompletenessTable({ data }: { data: typeof COMPLETENESS_GZ }) {
  return (
    <div className="overflow-x-auto mb-2">
      <table className="min-w-full text-sm border border-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold border-b">Kriterium</th>
            <th className="px-4 py-2 text-left font-semibold border-b">Puppeteer</th>
            <th className="px-4 py-2 text-left font-semibold border-b">Bright Data</th>
            <th className="px-4 py-2 text-left font-semibold border-b">ScrapeGraphAI</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-200 align-top">
              <td className="px-4 py-2 font-medium">{r.feld}</td>
              <td className="px-4 py-2 font-mono text-xs">
                {r.puppeteer}
                {r.note_pup && <span className="block text-gray-500 italic">{r.note_pup}</span>}
              </td>
              <td className="px-4 py-2 font-mono text-xs">
                {r.brightdata}
                {r.note_bd && <span className="block text-gray-500 italic">{r.note_bd}</span>}
              </td>
              <td className="px-4 py-2 font-mono text-xs">
                {r.sgi}
                {r.note_sgi && <span className="block text-gray-500 italic">{r.note_sgi}</span>}
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
}: {
  rows: Array<{ kriterium?: string; aspekt?: string; puppeteer: string; brightdata: string; sgi: string }>;
  firstColLabel: string;
}) {
  return (
    <div className="overflow-x-auto mb-2">
      <table className="min-w-full text-sm border border-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold border-b">{firstColLabel}</th>
            <th className="px-4 py-2 text-left font-semibold border-b">Puppeteer</th>
            <th className="px-4 py-2 text-left font-semibold border-b">Bright Data</th>
            <th className="px-4 py-2 text-left font-semibold border-b">ScrapeGraphAI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-200 align-top">
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
    <div className="border rounded p-4 bg-white">
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
