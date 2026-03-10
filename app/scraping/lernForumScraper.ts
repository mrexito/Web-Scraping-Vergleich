import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { startScrapeRun, finishScrapeRun, logScrapeError } from './scrapeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROVIDER_ID = 2;
const PROVIDER_NAME = 'Lern-Forum';

const urls = [
  { url: 'https://www.lern-forum.ch/gymivorbereitung-zuerich/langgymnasium', course_type: 'langgymi' },
  { url: 'https://www.lern-forum.ch/gymivorbereitung-zuerich/kurzgymnasium', course_type: 'kurzgymi' },
];

function convertDate(raw: string): string | null {
  var trimmed = raw.trim();
  var parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  var day = parts[0];
  var month = parts[1];
  var year = parts[2];
  if (year.length === 2) year = '20' + year;
  return year + '-' + month + '-' + day;
}

async function scrapeCoursesFromPage(page: Page, pageUrl: string, courseType: string) {
  const courses: any[] = [];

  await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  try {
    await page.waitForSelector('table.kurstbl', { timeout: 10000 });
  } catch (e) {
    console.warn('  Warnung: Kurstabelle nicht gefunden innerhalb 10s, fahre fort...');
  }

  const data = await page.evaluate(function(args: { pageUrl: string; courseType: string }) {
    var pageUrl = args.pageUrl;
    var courseType = args.courseType;
    var results: any[] = [];

    var table = document.querySelector('table.kurstbl');
    if (!table) table = document.querySelector('table');
    if (!table) return results;

    var rows = table.querySelectorAll('tbody tr');

    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].querySelectorAll('td');
      if (cells.length < 9) continue;

      var titleRaw = (cells[0].textContent || '').trim();
      if (!titleRaw) continue;

      var titleLines = titleRaw.split('\n');
      var titleLine0 = titleLines[0].trim();
      var titleLine1 = titleLines.length > 1 ? titleLines[1].trim() : '';

      var weekday = '';
      var daysDE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      for (var d = 0; d < daysDE.length; d++) {
        if (titleRaw.indexOf(daysDE[d]) !== -1) { weekday = daysDE[d]; break; }
      }

      var lessonMatch = titleRaw.match(/\((\d+)\s*mal\)/);
      var lessonCount = lessonMatch ? lessonMatch[1] + 'x' : '';

      var isOnline = titleRaw.indexOf('Online') !== -1 || titleRaw.indexOf('online') !== -1;

      var title = titleLine0;
      if (titleLine1) title += ' | ' + titleLine1;
      if (weekday && lessonCount) title += ' | ' + weekday + ' ' + lessonCount;
      else if (weekday) title += ' | ' + weekday;

      var startDateRaw = (cells[3].textContent || '').trim();
      var kurszeit = (cells[4].textContent || '').trim().replace(/(\d{2})\.(\d{2})/g, '$1:$2');

      var ortLink = cells[5].querySelector('a');
      var location = ortLink ? (ortLink.textContent || '').trim() : (cells[5].textContent || '').trim();
      if (!location) location = 'Zürich';
      if (isOnline || location.indexOf('Hause') !== -1 || location.indexOf('hause') !== -1) {
        location = 'Online';
      }

      var preisRaw = (cells[8].textContent || '').trim();
      var price_chf: number | null = null;
      var preisClean = preisRaw.replace(/[^0-9]/g, '');
      if (preisClean) {
        var preisNum = parseInt(preisClean, 10);
        if (preisNum >= 100 && preisNum <= 99999) price_chf = preisNum;
      }

      results.push({
        title, price_chf, location,
        start_date_raw: startDateRaw,
        occurrence: weekday ? weekday + (kurszeit ? ', ' + kurszeit : '') : kurszeit,
        course_type: courseType,
        course_url: pageUrl,
        is_online: isOnline,
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
          courses.slice(0, 3).forEach(function(c: any) {
            console.log('  -> "' + c.title.substring(0, 60) + '..." | CHF ' + (c.price_chf ?? 'N/A') + ' | ' + c.location + ' | Start: ' + (c.start_date ?? 'N/A'));
          });
          if (courses.length > 3) console.log('  ... und ' + (courses.length - 3) + ' weitere Kurse');
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