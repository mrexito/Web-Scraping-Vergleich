import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROVIDER_ID = 6; // Nachhilfe Akademie ID in GymiProviders
const PROVIDER_NAME = 'Nachilfe Akademie';

const urls = [
  { url: 'https://nachhilfeakademie.ch/preise-gymivorbereitung-langgymnasium/', course_type: 'langgymi' },
  { url: 'https://nachhilfeakademie.ch/preise-gymivorbereitung-kurzgymnasium/', course_type: 'kurzgymi' },
];

// ─────────────────────────────────────────────
// Logging Hilfsfunktionen
// ─────────────────────────────────────────────

async function startScrapeRun(): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_runs')
    .insert({ scraper_type: 'puppeteer', status: 'running' })
    .select('id')
    .single();
  if (error) { console.error('Fehler beim Starten des Scrape-Runs:', error.message); return null; }
  console.log(`Scrape-Run gestartet mit ID: ${data.id}`);
  return data.id;
}

async function finishScrapeRun(runId: string, status: 'success' | 'error'): Promise<void> {
  const { error } = await supabase
    .from('scrape_runs')
    .update({ finished_at: new Date().toISOString(), status })
    .eq('id', runId);
  if (error) console.error('Fehler beim Beenden:', error.message);
  else console.log(`Scrape-Run ${runId} beendet mit Status: ${status}`);
}

async function logScrapeError(runId: string, providerId: number, errorType: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('scrape_errors')
    .insert({ run_id: runId, provider_id: providerId, error_type: errorType, message });
  if (error) console.error('Fehler beim Loggen:', error.message);
  else console.warn(`Fehler geloggt für Provider ${providerId}: ${message}`);
}

// ─────────────────────────────────────────────
// Preise aus Tabellen extrahieren
// ─────────────────────────────────────────────

async function scrapeCoursesFromPage(page: Page, pageUrl: string, courseType: string) {
  const courses: any[] = [];

  // Wöchentliche Kurse (tablepress-2 für Langgymi, tablepress-5 für Kurzgymi)
  const weeklyRows = await page.$$eval('table.tablepress tbody tr', (rows) => {
    return rows.map(row => {
      const cols = row.querySelectorAll('td');
      if (cols.length < 4) return null;
      return {
        title: cols[1]?.textContent?.trim() || '',
        lektionen: cols[2]?.textContent?.trim() || '',
        kosten_privat: cols[3]?.textContent?.trim() || '',
        kosten_gruppe: cols[4]?.textContent?.trim() || '',
      };
    }).filter(Boolean);
  });

  for (const row of weeklyRows) {
    if (!row || !row.title) continue;

    // Preis parsen: "2'420 CHF" → 2420
    const parsePrice = (p: string) => {
      const match = p.replace(/'/g, '').match(/(\d+)/);
      return match ? parseInt(match[1]) : null;
    };

    courses.push({
      provider_id: PROVIDER_ID,
      title: row.title,
      price_chf: parsePrice(row.kosten_gruppe || ''),
      location: 'Zürich, Winterthur, Basel',
      occurrence: row.lektionen,
      course_type: courseType,
      course_url: pageUrl,
      last_scraped_at: new Date().toISOString(),
    });
  }

  console.log(`  → ${courses.length} Kurse gefunden auf ${pageUrl}`);
  return courses;
}

// ─────────────────────────────────────────────
// Hauptfunktion
// ─────────────────────────────────────────────

async function scrapeNachhilfeAkademie(): Promise<void> {
  let browser: Browser | null = null;

  const runId = await startScrapeRun();
  if (!runId) { console.error('Konnte keinen Scrape-Run starten. Abbruch.'); return; }

  try {
    console.log('Starte Nachhilfe Akademie Scraper...');
    browser = await puppeteer.launch({ headless: true });

    // Alte Kurse löschen
    await supabase.from('courses').delete().eq('provider_id', PROVIDER_ID);
    console.log('Alte Kurse gelöscht.');

    for (const entry of urls) {
      let page: Page | null = null;
      try {
        page = await browser.newPage();
        await page.goto(entry.url, { waitUntil: 'networkidle2', timeout: 60000 });

        const courses = await scrapeCoursesFromPage(page, entry.url, entry.course_type);

        if (courses.length === 0) {
          await logScrapeError(runId, PROVIDER_ID, 'NO_COURSES_FOUND', `Keine Kurse gefunden auf ${entry.url}`);
          continue;
        }

        const { error } = await supabase.from('courses').insert(courses);
        if (error) {
          console.error('Fehler beim Speichern:', error.message);
          await logScrapeError(runId, PROVIDER_ID, 'INSERT_ERROR', error.message);
        } else {
          console.log(`✓ ${courses.length} Kurse gespeichert für ${entry.url}`);
        }

      } catch (error: any) {
        console.error(`Fehler beim Scraping von ${entry.url}:`, error.message);
        await logScrapeError(runId, PROVIDER_ID, 'SCRAPING_ERROR', error.message);
      } finally {
        if (page) await page.close();
      }
    }

    await finishScrapeRun(runId, 'success');
    console.log('\nNachhilfe Akademie Scraping abgeschlossen!');

  } catch (error: any) {
    console.error('Allgemeiner Fehler:', error.message);
    await finishScrapeRun(runId, 'error');
  } finally {
    if (browser) await browser.close();
    console.log('Browser geschlossen.');
  }
}

scrapeNachhilfeAkademie().catch(error =>
  console.error('Fehler beim Starten:', error.message)
);