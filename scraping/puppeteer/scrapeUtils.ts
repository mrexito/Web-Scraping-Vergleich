import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Startet einen Scrape-Run und speichert ihn in der scrape_runs-Tabelle.
 *
 * @param scraperMethod - 'scrapegraphai' | 'puppeteer' | 'brightdata'
 * @param providerId    - ID aus GymiProviders (z.B. 1 = Gymivorbereitung Zürich)
 * @returns             - Run-ID (UUID), oder null bei Fehler
 */
export async function startScrapeRun(
  scraperMethod: 'scrapegraphai' | 'puppeteer' | 'brightdata' = 'puppeteer',
  providerId?: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_runs')
    .insert({
      scraper_method: scraperMethod,
      provider_id: providerId ?? null,
      status: 'running',
      courses_found: 0,
      error_count: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Fehler beim Starten des Scrape-Runs:', error.message);
    return null;
  }

  console.log(
    `Scrape-Run gestartet: ${scraperMethod}` +
      (providerId ? ` | Provider ${providerId}` : '') +
      ` | Run-ID ${data.id}`
  );
  return data.id;
}

/**
 * Beendet einen Scrape-Run und aktualisiert Status + Metriken.
 *
 * @param runId         - UUID aus startScrapeRun
 * @param status        - 'success' | 'partial' | 'failed'
 * @param coursesFound  - Anzahl gefundener Kurse (für Report)
 * @param errorCount    - Anzahl Fehler während des Laufs
 */
export async function finishScrapeRun(
  runId: string,
  status: 'success' | 'partial' | 'failed',
  coursesFound: number = 0,
  errorCount: number = 0
): Promise<void> {
  const { error } = await supabase
    .from('scrape_runs')
    .update({
      finished_at: new Date().toISOString(),
      status,
      courses_found: coursesFound,
      error_count: errorCount,
    })
    .eq('id', runId);

  if (error) {
    console.error('Fehler beim Beenden des Scrape-Runs:', error.message);
  } else {
    console.log(
      `Scrape-Run ${runId} beendet: ${status} | ${coursesFound} Kurse | ${errorCount} Fehler`
    );
  }
}

/**
 * Loggt einen Fehler in scrape_errors. Speichert optional einen HTML-Snapshot,
 * der später vom Self-Healing-Loop analysiert werden kann.
 */
export async function logScrapeError(
  runId: string,
  providerId: number,
  errorType: string,
  message: string,
  htmlSnapshot?: string
): Promise<void> {
  const { error } = await supabase.from('scrape_errors').insert({
    run_id: runId,
    provider_id: providerId,
    error_type: errorType,
    message,
    html_snapshot: htmlSnapshot?.slice(0, 4000) ?? null,
    fixed_by_ai: false,
  });

  if (error) {
    console.error('Fehler beim Loggen des Scrape-Fehlers:', error.message);
  } else {
    console.warn(`Fehler geloggt für Provider ${providerId}: ${message}`);
  }
}

/**
 * Preisverlauf speichern — wird von allen Scrapern nach erfolgreichem Insert aufgerufen.
 */
export async function recordPriceHistory(
  providerId: number,
  courseType: string,
  priceChf: number
): Promise<void> {
  const { error } = await supabase.from('price_history').insert({
    provider_id: providerId,
    price_chf: priceChf,
    course_type: courseType,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Fehler beim Speichern der price_history:', error.message);
  } else {
    console.log(`✓ price_history: Provider ${providerId} | ${courseType} | CHF ${priceChf}`);
  }
}