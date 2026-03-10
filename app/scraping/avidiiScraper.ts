import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { startScrapeRun, finishScrapeRun, logScrapeError } from './scrapeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROVIDER_ID = 3;
const PROVIDER_NAME = 'Avidii';

const urls = [
  { url: 'https://avidii.ch/gymivorbereitung-langzeitgymnasium', course_type: 'langgymi' },
  { url: 'https://avidii.ch/gymivorbereitung-kurzzeitgymnasium', course_type: 'kurzgymi' },
];

var PREISE: { [key: string]: number | null } = {
  'langgymi_gruppe': 2950,
  'kurzgymi_gruppe': 3650,
  'einzelkurs': null,
};

var START_DATES: { [key: string]: string } = {
  'mittwoch': '2025-08-27',
  'samstag': '2025-08-30',
};
var END_DATES: { [key: string]: string } = {
  'mittwoch': '2026-02-04',
  'samstag': '2026-02-07',
};

async function scrapeCoursesFromPage(page: Page, pageUrl: string, courseType: string) {
  const courses: any[] = [];

  await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  try {
    await page.waitForSelector('table', { timeout: 15000 });
  } catch (e) {
    console.warn('  Warnung: Tabelle nicht gefunden innerhalb 15s, fahre fort...');
  }

  const data = await page.evaluate(function(args: { pageUrl: string; courseType: string }) {
    var pageUrl = args.pageUrl;
    var courseType = args.courseType;
    var results: any[] = [];

    var tables = document.querySelectorAll('table');
    var courseTable: Element | null = null;

    for (var t = 0; t < tables.length; t++) {
      var headerText = (tables[t].querySelector('thead') || tables[t]).textContent || '';
      if (headerText.indexOf('Gruppe') !== -1 || headerText.indexOf('Wochentag') !== -1) {
        courseTable = tables[t];
        break;
      }
    }

    if (!courseTable && tables.length > 0) courseTable = tables[0];
    if (!courseTable) return results;

    var rows = courseTable.querySelectorAll('tbody tr');

    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].querySelectorAll('td');
      if (cells.length < 4) continue;

      var gruppe = (cells[0].textContent || '').trim();
      if (!gruppe) continue;

      var isEinzelkurs = gruppe.toLowerCase().indexOf('einzel') !== -1;

      var location = (cells[1].textContent || '').trim();
      if (!location || location.toLowerCase().indexOf('absprache') !== -1) {
        location = isEinzelkurs ? 'Nach Absprache' : 'Zürich Stadelhofen';
      }

      var weekday = (cells[2].textContent || '').trim();
      if (weekday.toLowerCase().indexOf('absprache') !== -1) weekday = 'Nach Absprache';

      var uhrzeit = (cells[3].textContent || '').trim().replace(/\s*Uhr\s*$/i, '').trim();
      if (uhrzeit.toLowerCase().indexOf('absprache') !== -1) uhrzeit = 'Nach Absprache';

      var availability = cells.length > 4 ? (cells[4].textContent || '').trim() : '';

      var typeLabel = courseType === 'langgymi' ? 'Langzeitgymnasium' : 'Kurzzeitgymnasium';
      var title = 'Gymivorbereitung ' + typeLabel + ' | ' + gruppe;
      if (!isEinzelkurs && weekday && weekday !== 'Nach Absprache') {
        title += ' | ' + weekday;
      }

      var occurrence = '';
      if (weekday && weekday !== 'Nach Absprache' && uhrzeit && uhrzeit !== 'Nach Absprache') {
        occurrence = weekday + ', ' + uhrzeit;
      } else if (weekday) {
        occurrence = weekday;
      }

      results.push({
        title, location, occurrence, availability, course_type: courseType, course_url: pageUrl,
        weekday: weekday.toLowerCase(), uhrzeit, is_einzelkurs: isEinzelkurs,
      });
    }

    return results;
  }, { pageUrl, courseType });

  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    var priceKey = item.is_einzelkurs ? 'einzelkurs' : (courseType + '_gruppe');
    var price = PREISE[priceKey] !== undefined ? PREISE[priceKey] : null;

    var startDate: string | null = null;
    var endDate: string | null = null;
    if (!item.is_einzelkurs) {
      if (item.weekday === 'mittwoch') { startDate = START_DATES['mittwoch']; endDate = END_DATES['mittwoch']; }
      else if (item.weekday === 'samstag') { startDate = START_DATES['samstag']; endDate = END_DATES['samstag']; }
    }

    courses.push({
      provider_id: PROVIDER_ID,
      title: item.title,
      price_chf: price,
      location: item.location,
      start_date: startDate,
      end_date: endDate,
      occurrence: item.occurrence,
      course_type: item.course_type,
      course_url: item.course_url,
      is_online: false,
      last_scraped_at: new Date().toISOString(),
    });
  }

  console.log('  -> ' + courses.length + ' Kurs(e) gefunden auf ' + pageUrl);
  return courses;
}

async function scrapeAvidii(): Promise<void> {
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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

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
          courses.forEach(function(c: any) {
            console.log('  -> "' + c.title + '" | ' + c.location + ' | ' + (c.occurrence || 'N/A'));
          });
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

scrapeAvidii().catch(function(error) {
  console.error('Fehler beim Starten:', error.message);
});