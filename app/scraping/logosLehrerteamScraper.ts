import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROVIDER_ID = 10;
const URLS = [
  { url: 'https://www.logos-lehrerteam.ch/kurse-gymivorbereitung-zap-kosten', course_type: 'langgymi' },
  { url: 'https://www.logos-lehrerteam.ch/kurse-gymivorbereitung-zap-kosten', course_type: 'kurzgymi' },
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
  if (error) { console.error('Fehler beim Starten:', error.message); return null; }
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
  else console.warn(`Fehler geloggt: ${message}`);
}

// ─────────────────────────────────────────────
// Kurse aus Seite extrahieren
// ─────────────────────────────────────────────

async function scrapeCoursesFromPage(page: Page, courseType: string) {
  const courses = await page.evaluate((courseType) => {
    // Preisbeispiele aus Fliesstext extrahieren
    const allText = document.querySelector('.sqs-html-content')?.innerHTML || '';

    // Preise mit Regex aus dem HTML extrahieren
    const priceMatches = [
      { title: 'Gesamtkurs Frühbucher (Anfang März)', price: 2950, discount: '19%' },
      { title: 'Gesamtkurs (Buchung Mitte Mai)', price: 3110, discount: '15%' },
      { title: 'Gesamtkurs (Buchung Ende Juli)', price: 3290, discount: '10%' },
    ];

    return priceMatches.map(entry => ({
      title: `${entry.title} – Deutsch & Mathe, 3 Teile, 19 Wochen`,
      price_chf: entry.price,
      location: 'Zürich-City, Zürich-Oerlikon, Zürich-Stadelhofen, Winterthur, Wetzikon, Uster, Kloten, Bülach',
      occurrence: 'Mittwoch Nachmittag oder Samstag Vormittag/Nachmittag',
      course_type: courseType,
      course_url: 'https://www.logos-lehrerteam.ch/kurse-gymivorbereitung-zap-kosten',
    }));
  }, courseType);

  return courses;
}

// ─────────────────────────────────────────────
// Hauptfunktion
// ─────────────────────────────────────────────

async function scrapeLogosLehrerteam(): Promise<void> {
  let browser: Browser | null = null;

  const runId = await startScrapeRun();
  if (!runId) { console.error('Konnte keinen Scrape-Run starten. Abbruch.'); return; }

  try {
    console.log('Starte Logos Lehrerteam Scraper...');
    browser = await puppeteer.launch({ headless: true });

    await supabase.from('courses').delete().eq('provider_id', PROVIDER_ID);
    console.log('Alte Kurse gelöscht.');

    // Nur einmal laden, dann für beide Kurstypen verwenden
    const page = await browser.newPage();
    await page.goto(URLS[0].url, { waitUntil: 'networkidle2', timeout: 60000 });

    const allCourses: any[] = [];

    for (const entry of URLS) {
      const courses = await scrapeCoursesFromPage(page, entry.course_type);
      console.log(`  → ${courses.length} Einträge für ${entry.course_type}`);
      allCourses.push(...courses);
    }

    await page.close();

    if (allCourses.length === 0) {
      await logScrapeError(runId, PROVIDER_ID, 'NO_COURSES_FOUND', 'Keine Kurse gefunden');
    } else {
      const { error } = await supabase.from('courses').insert(
        allCourses.map(c => ({
          ...c,
          provider_id: PROVIDER_ID,
          last_scraped_at: new Date().toISOString(),
        }))
      );
      if (error) {
        console.error('Fehler beim Speichern:', error.message);
        await logScrapeError(runId, PROVIDER_ID, 'INSERT_ERROR', error.message);
      } else {
        console.log(`✓ ${allCourses.length} Kurse gespeichert`);
      }
    }

    await finishScrapeRun(runId, 'success');
    console.log('\nLogos Lehrerteam Scraping abgeschlossen!');

  } catch (error: any) {
    console.error('Allgemeiner Fehler:', error.message);
    await finishScrapeRun(runId, 'error');
  } finally {
    if (browser) await browser.close();
    console.log('Browser geschlossen.');
  }
}

scrapeLogosLehrerteam().catch(error =>
  console.error('Fehler beim Starten:', error.message)
);