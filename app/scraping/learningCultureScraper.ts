import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database.types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROVIDER_ID = 4; // Learning Culture ID in GymiProviders
const PROVIDER_NAME = 'Learning Culture';

const urls = [
  { url: 'https://www.learningculture.ch/kurse/langgymi-pruefung', course_type: 'langgymi' },
  { url: 'https://www.learningculture.ch/kurse/kurzgymi-pruefung', course_type: 'kurzgymi' },
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
  if (error) console.error('Fehler beim Beenden des Scrape-Runs:', error.message);
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
// Kurs-Zeilen aus einer Seite/Tab extrahieren
// ─────────────────────────────────────────────

interface ScrapedCourse {
  title: string;
  price_chf: number | null;
  location: string;
  start_date: string | null;
  end_date: string | null;
  occurrence: string;
  course_type: string;
  course_url: string;
}

async function scrapeCoursesFromPage(page: Page, pageUrl: string, courseType: string): Promise<ScrapedCourse[]> {
  const courses: ScrapedCourse[] = [];

  // Alle Tab-IDs auf der Seite finden
  const tabIds = await page.$$eval('.tab-list-item a.tab-heading', (links) =>
    links.map(link => link.getAttribute('href')?.replace('#', '') || '')
  );

  console.log(`Gefundene Tabs: ${tabIds.join(', ')}`);

  for (const tabId of tabIds) {
    if (!tabId) continue;

    // Tab anklicken um Inhalt zu laden
    try {
      await page.click(`.tab-list-item a[href="#${tabId}"]`);
      await new Promise(resolve => setTimeout(resolve, 500)); // kurz warten
      console.log(`Tab "${tabId}" geöffnet`);
    } catch (e) {
      console.warn(`Konnte Tab "${tabId}" nicht anklicken`);
      continue;
    }

    // Kurszeilen im aktiven Tab extrahieren
    const tabCourses = await page.$$eval(
      `[id="${tabId}"] .div-table-row`,
      (rows, args) => {
        const { pageUrl, courseType } = args;
        let lastSubcat = '';
        return rows.map(row => {
          // Kursname (Subkategorie) - nur wenn vorhanden
          const subcatEl = row.querySelector('.course-subcat:not(.no-content) h4');
          if (subcatEl?.textContent?.trim()) {
            lastSubcat = subcatEl.textContent.trim();
          }

          // Preis aus data-item-price Attribut
          const priceEl = row.querySelector('[data-item-price]');
          const price = priceEl ? parseInt(priceEl.getAttribute('data-item-price') || '0') : null;

          // Standort
          const locationEl = row.querySelector('.course-location');
          const location = locationEl?.textContent?.trim() || 'Unbekannt';

          // Daten
          const datesEl = row.querySelector('.course-dates');
          const datesText = datesEl?.textContent?.trim() || '';
          const dateParts = datesText.split(' - ');

          // Datum von DD.MM.YYYY zu YYYY-MM-DD konvertieren
          const parseDate = (d: string) => {
            const parts = d.trim().split('.');
            if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return null;
          };

          // Uhrzeit/Wochentag
          const occurrenceEl = row.querySelector('.course-occurrence');
          const occurrence = occurrenceEl?.textContent?.trim() || '';

          // data-item-name für vollständigen Kurstitel
          const infoEl = row.querySelector('[data-item-name]');
          const itemName = infoEl?.getAttribute('data-item-name') || lastSubcat;

          return {
            title: itemName || lastSubcat,
            price_chf: price,
            location,
            start_date: dateParts[0] ? parseDate(dateParts[0]) : null,
            end_date: dateParts[1] ? parseDate(dateParts[1]) : null,
            occurrence,
            course_type: courseType,
            course_url: pageUrl,
          };
        }).filter(c => c.title && c.occurrence); // leere Zeilen rausfiltern
      },
      { pageUrl, courseType }
    );

    console.log(`  → ${tabCourses.length} Kurse in Tab "${tabId}" gefunden`);
    courses.push(...tabCourses);
  }

  return courses;
}

// ─────────────────────────────────────────────
// Hauptfunktion
// ─────────────────────────────────────────────

async function scrapeLearningCulture(): Promise<void> {
  let browser: Browser | null = null;

  const runId = await startScrapeRun();
  if (!runId) { console.error('Konnte keinen Scrape-Run starten. Abbruch.'); return; }

  try {
    console.log('Starte Learning Culture Scraper...');
    browser = await puppeteer.launch({ headless: true });

    // Alte Kurse für diesen Anbieter löschen (damit keine Duplikate entstehen)
    await supabase.from('courses').delete().eq('provider_id', PROVIDER_ID);
    console.log('Alte Kurse gelöscht.');

    for (const entry of urls) {
      console.log(`\nScraping URL: ${entry.url}`);
      let page: Page | null = null;

      try {
        page = await browser.newPage();
        await page.goto(entry.url, { waitUntil: 'networkidle2', timeout: 60000 });

        const courses = await scrapeCoursesFromPage(page, entry.url, entry.course_type);

        if (courses.length === 0) {
          await logScrapeError(runId, PROVIDER_ID, 'NO_COURSES_FOUND', `Keine Kurse gefunden auf ${entry.url}`);
          continue;
        }

        // Kurse in Supabase speichern
        const coursesToInsert = courses.map(c => ({
          provider_id: PROVIDER_ID,
          title: c.title,
          price_chf: c.price_chf,
          location: c.location,
          start_date: c.start_date,
          end_date: c.end_date,
          occurrence: c.occurrence,
          course_type: c.course_type,
          course_url: c.course_url,
          last_scraped_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from('courses').insert(coursesToInsert);
        if (error) {
          console.error('Fehler beim Speichern der Kurse:', error.message);
          await logScrapeError(runId, PROVIDER_ID, 'INSERT_ERROR', error.message);
        } else {
          console.log(`✓ ${coursesToInsert.length} Kurse gespeichert für ${entry.url}`);
        }

      } catch (error: any) {
        console.error(`Fehler beim Scraping von ${entry.url}:`, error.message);
        await logScrapeError(runId, PROVIDER_ID, 'SCRAPING_ERROR', error.message);
      } finally {
        if (page) await page.close();
      }
    }

    await finishScrapeRun(runId, 'success');
    console.log('\nLearning Culture Scraping abgeschlossen!');

  } catch (error: any) {
    console.error('Allgemeiner Fehler:', error.message);
    await finishScrapeRun(runId, 'error');
  } finally {
    if (browser) await browser.close();
    console.log('Browser geschlossen.');
  }
}

scrapeLearningCulture().catch(error =>
  console.error('Fehler beim Starten:', error.message)
);