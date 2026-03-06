import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROVIDER_ID = 2;
const PROVIDER_NAME = 'Lern-Forum';

// Lern-Forum hat separate Seiten für Kurzgymi und Langgymi.
// Die Kursliste steht direkt auf den Hauptseiten in einer Tabelle
// mit der CSS-Klasse "kurstbl".
const urls = [
  {
    url: 'https://www.lern-forum.ch/gymivorbereitung-zuerich/langgymnasium',
    course_type: 'langgymi',
  },
  {
    url: 'https://www.lern-forum.ch/gymivorbereitung-zuerich/kurzgymnasium',
    course_type: 'kurzgymi',
  },
];

// ─────────────────────────────────────────────
// Logging Hilfsfunktionen (identisch zu anderen Scrapern)
// ─────────────────────────────────────────────

async function startScrapeRun(): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_runs')
    .insert({ scraper_type: 'puppeteer', status: 'running' })
    .select('id')
    .single();
  if (error) { console.error('Fehler beim Starten des Scrape-Runs:', error.message); return null; }
  console.log('Scrape-Run gestartet mit ID: ' + data.id);
  return data.id;
}

async function finishScrapeRun(runId: string, status: 'success' | 'error'): Promise<void> {
  const { error } = await supabase
    .from('scrape_runs')
    .update({ finished_at: new Date().toISOString(), status })
    .eq('id', runId);
  if (error) console.error('Fehler beim Beenden:', error.message);
  else console.log('Scrape-Run ' + runId + ' beendet mit Status: ' + status);
}

async function logScrapeError(runId: string, providerId: number, errorType: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('scrape_errors')
    .insert({ run_id: runId, provider_id: providerId, error_type: errorType, message });
  if (error) console.error('Fehler beim Loggen:', error.message);
  else console.warn('Fehler geloggt fuer Provider ' + providerId + ': ' + message);
}

// ─────────────────────────────────────────────
// Datumskonvertierung: "21.03.26" → "2026-03-21"
// ─────────────────────────────────────────────
function convertDate(raw: string): string | null {
  // Format: DD.MM.YY
  var trimmed = raw.trim();
  var parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  var day   = parts[0];
  var month = parts[1];
  var year  = parts[2];
  // Zweistelliges Jahr → 2000er
  if (year.length === 2) year = '20' + year;
  return year + '-' + month + '-' + day;
}

// ─────────────────────────────────────────────
// Kursdaten aus "kurstbl"-Tabelle extrahieren
//
// HTML-Struktur jeder Zeile (10–11 td's):
//   td[0]  = Kursname + Wochentag + "(XX mal)"
//   td[1]  = Anmelden-Button (leer/"-" wenn ausgebucht)
//   td[2]  = Stufe (z.B. "1./2./3. Sek." oder "6. Kl.")
//   td[3]  = Beginndatum (z.B. "21.03.26")
//   td[4]  = Kurszeit (z.B. "09:30 - 12:00")
//   td[5]  = Ort (Link-Text, z.B. "Zürich Stadelhoferplatz")
//   td[6]  = Flyer-Link
//   td[7]  = Details-Link
//   td[8]  = Preis (z.B. "5280.--")
//   td[9]  = Verfügbarkeit ("viele" / "wenige" / "ausgebucht")
//   td[10] = Anmelden-Button (Duplikat)
// ─────────────────────────────────────────────

async function scrapeCoursesFromPage(page: Page, pageUrl: string, courseType: string) {
  const courses: any[] = [];

  await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // Warten bis die Kurstabelle geladen ist
  try {
    await page.waitForSelector('table.kurstbl', { timeout: 10000 });
  } catch (e) {
    console.warn('  Warnung: Kurstabelle nicht gefunden innerhalb 10s, fahre fort...');
  }

  const data = await page.evaluate(function(args: { pageUrl: string; courseType: string }) {
    var pageUrl = args.pageUrl;
    var courseType = args.courseType;
    var results: any[] = [];

    // Spezifisch die Tabelle mit Klasse "kurstbl" selektieren
    var table = document.querySelector('table.kurstbl');
    if (!table) {
      // Fallback: erste Tabelle auf der Seite
      table = document.querySelector('table');
    }
    if (!table) return results;

    var rows = table.querySelectorAll('tbody tr');

    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].querySelectorAll('td');
      if (cells.length < 9) continue;

      // ── td[0]: Kursname ──
      // z.B. "Gymivorbereitung Zürich - Kurzgymnasium & HMS\nMathe & Deutsch\nSamstag (18 mal)"
      var titleRaw = (cells[0].textContent || '').trim();
      if (!titleRaw) continue;

      // Erste Zeile des Titels (vor dem ersten \n)
      var titleLines = titleRaw.split('\n');
      var titleLine0 = titleLines[0].trim(); // "Gymivorbereitung Zürich - Kurzgymnasium & HMS"
      var titleLine1 = titleLines.length > 1 ? titleLines[1].trim() : ''; // "Mathe & Deutsch..."
      var titleLine2 = titleLines.length > 2 ? titleLines[2].trim() : ''; // "Samstag (18 mal)"

      // Wochentag aus letzter Zeile extrahieren
      var weekday = '';
      var daysDE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      for (var d = 0; d < daysDE.length; d++) {
        if (titleRaw.indexOf(daysDE[d]) !== -1) { weekday = daysDE[d]; break; }
      }

      // Anzahl Lektionen aus "(XX mal)" extrahieren
      var lessonMatch = titleRaw.match(/\((\d+)\s*mal\)/);
      var lessonCount = lessonMatch ? lessonMatch[1] + 'x' : '';

      // Online-Kurs erkennen
      var isOnline = titleRaw.indexOf('Online') !== -1 || titleRaw.indexOf('online') !== -1;

      // Vollständiger Titel
      var title = titleLine0;
      if (titleLine1) title += ' | ' + titleLine1;
      if (weekday && lessonCount) title += ' | ' + weekday + ' ' + lessonCount;
      else if (weekday) title += ' | ' + weekday;

      // ── td[3]: Beginndatum ──
      var startDateRaw = (cells[3].textContent || '').trim(); // "21.03.26"

      // ── td[4]: Kurszeit ──
      // Lern-Forum nutzt teils Punkte statt Doppelpunkte: "17.00 - 19.10" → "17:00 - 19:10"
      var kurszeit = (cells[4].textContent || '').trim().replace(/(\d{2})\.(\d{2})/g, '$1:$2');

      // ── td[5]: Ort ──
      var ortLink = cells[5].querySelector('a');
      var location = ortLink ? (ortLink.textContent || '').trim() : (cells[5].textContent || '').trim();
      if (!location) location = 'Zürich';
      // Online-Kurs: Ort auf "Online" setzen
      if (isOnline || location.indexOf('Hause') !== -1 || location.indexOf('hause') !== -1) {
        location = 'Online';
      }

      // ── td[8]: Preis ──
      var preisRaw = (cells[8].textContent || '').trim(); // "5280.--" oder "3140.--"
      var price_chf: number | null = null;
      var preisClean = preisRaw.replace(/[^0-9]/g, '');
      if (preisClean) {
        var preisNum = parseInt(preisClean, 10);
        if (preisNum >= 100 && preisNum <= 99999) price_chf = preisNum;
      }

      // ── td[9]: Verfügbarkeit ──
      var verfuegbar = (cells[9] ? cells[9].textContent || '' : '').trim().toLowerCase();
      // "viele", "wenige", "ausgebucht"

      results.push({
        title: title,
        price_chf: price_chf,
        location: location,
        start_date_raw: startDateRaw,
        occurrence: weekday ? weekday + (kurszeit ? ', ' + kurszeit : '') : kurszeit,
        lesson_count: lessonCount,
        course_type: courseType,
        course_url: pageUrl,
        is_online: isOnline,
        availability: verfuegbar,
      });
    }

    return results;
  }, { pageUrl, courseType });

  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    courses.push({
      provider_id: PROVIDER_ID,
      title: item.title,
      price_chf: item.price_chf,
      location: item.location,
      start_date: convertDate(item.start_date_raw),
      end_date: null,
      occurrence: item.occurrence,
      course_type: item.course_type,
      course_url: item.course_url,
      is_online: item.is_online,
      last_scraped_at: new Date().toISOString(),
    });
  }

  console.log('  -> ' + courses.length + ' Kurs(e) gefunden auf ' + pageUrl);
  return courses;
}

// ─────────────────────────────────────────────
// Hauptfunktion
// ─────────────────────────────────────────────

async function scrapeLernForum(): Promise<void> {
  let browser: Browser | null = null;

  const runId = await startScrapeRun();
  if (!runId) { console.error('Konnte keinen Scrape-Run starten. Abbruch.'); return; }

  try {
    console.log('Starte ' + PROVIDER_NAME + ' Scraper...');
    browser = await puppeteer.launch({ headless: true });

    await supabase.from('courses').delete().eq('provider_id', PROVIDER_ID);
    console.log('Alte Kurse geloescht.');

    for (const entry of urls) {
      let page: Page | null = null;
      try {
        page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        console.log('\nLade: ' + entry.url);
        const courses = await scrapeCoursesFromPage(page, entry.url, entry.course_type);

        if (courses.length === 0) {
          await logScrapeError(runId, PROVIDER_ID, 'NO_COURSES_FOUND', 'Keine Kurse gefunden auf ' + entry.url);
          continue;
        }

        const { error } = await supabase.from('courses').insert(courses);
        if (error) {
          console.error('Fehler beim Speichern:', error.message);
          await logScrapeError(runId, PROVIDER_ID, 'INSERT_ERROR', error.message);
        } else {
          console.log('✓ ' + courses.length + ' Kurs(e) gespeichert');
          // Erste 3 zur Kontrolle ausgeben
          courses.slice(0, 3).forEach(function(c: any) {
            console.log(
              '  -> "' + c.title.substring(0, 60) + '..."' +
              ' | CHF ' + (c.price_chf ?? 'N/A') +
              ' | ' + c.location +
              ' | Start: ' + (c.start_date ?? 'N/A') +
              ' | ' + (c.occurrence ?? '')
            );
          });
          if (courses.length > 3) {
            console.log('  ... und ' + (courses.length - 3) + ' weitere Kurse');
          }
        }

      } catch (err: any) {
        console.error('Fehler beim Scraping von ' + entry.url + ':', err.message);
        await logScrapeError(runId, PROVIDER_ID, 'SCRAPING_ERROR', err.message);
      } finally {
        if (page) await page.close();
      }
    }

    await finishScrapeRun(runId, 'success');
    console.log('\n' + PROVIDER_NAME + ' Scraping abgeschlossen!');

  } catch (err: any) {
    console.error('Allgemeiner Fehler:', err.message);
    await finishScrapeRun(runId, 'error');
  } finally {
    if (browser) await browser.close();
    console.log('Browser geschlossen.');
  }
}

scrapeLernForum().catch(function(error) {
  console.error('Fehler beim Starten:', error.message);
});