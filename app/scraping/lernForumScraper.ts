import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { startScrapeRun, finishScrapeRun, logScrapeError, recordPriceHistory } from './scrapeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROVIDER_ID = 2;
const PROVIDER_NAME = 'Lern-Forum';
const BASE_URL = 'https://www.lern-forum.ch';
const OVERVIEW_URL = `${BASE_URL}/gymivorbereitung-zuerich`;

const urls = [
  { url: `${BASE_URL}/gymivorbereitung-zuerich/langgymnasium`, course_type: 'langgymi' },
  { url: `${BASE_URL}/gymivorbereitung-zuerich/kurzgymnasium`, course_type: 'kurzgymi' },
];

function convertDate(raw: string): string | null {
  const trimmed = raw.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  let year = parts[2];
  if (year.length === 2) year = '20' + year;
  return `${year}-${parts[1]}-${parts[0]}`;
}

async function scrapeProviderMetadata(page: Page): Promise<{
  pruefungssimultaion: boolean;
  aufsatzkorrektur: boolean;
  pruefungsarchiv: boolean;
  eLearning: boolean;
  einzelkurse: boolean;
  lernunterlagen: boolean;
  beratungsgespraech: boolean;
  einstufungstest: boolean;
}> {
  console.log(`Lese Anbieter-Metadaten von ${OVERVIEW_URL}...`);
  await page.goto(OVERVIEW_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'))
      .map(a => a.getAttribute('href') || '');
    const bodyText = document.body.innerText.toLowerCase();

    return {
      pruefungssimultaion: links.some(h => h.includes('/pruefungssimulation')),
      aufsatzkorrektur: links.some(h => h.includes('/aufsatztraining')),
      pruefungsarchiv: links.some(h => h.includes('/pruefungsarchiv')),
      eLearning: links.some(h => h.includes('/gymivorbereitung-online')),
      einzelkurse: links.some(h => h.includes('/private-gymivorbereitung')),
      lernunterlagen: links.some(h => h.includes('/kursmaterial')),
      beratungsgespraech: false,
      einstufungstest: bodyText.includes('einstufungstest'),
    };
  });
}

async function scrapeCoursesFromPage(page: Page, pageUrl: string, courseType: string) {
  const courses: any[] = [];

  await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  try {
    await page.waitForSelector('table.kurstbl', { timeout: 10000 });
  } catch (e) {
    console.warn('  Warnung: Kurstabelle nicht gefunden innerhalb 10s, fahre fort...');
  }

  const data = await page.evaluate((args: { pageUrl: string; courseType: string; baseUrl: string }) => {
    const { pageUrl, courseType, baseUrl } = args;
    const results: any[] = [];

    const table = document.querySelector('table.kurstbl') || document.querySelector('table');
    if (!table) return results;

    const rows = table.querySelectorAll('tbody tr');

    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].querySelectorAll('td');
      if (cells.length < 9) continue;

      const titleRaw = (cells[0].textContent || '').trim();
      if (!titleRaw) continue;

      const titleLines = titleRaw.split('\n').map((l: string) => l.trim()).filter(Boolean);

      const daysDE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      let weekday = '';
      for (const day of daysDE) {
        if (titleRaw.includes(day)) { weekday = day; break; }
      }

      const lessonMatch = titleRaw.match(/\((\d+)\s*mal\)/);
      const lessonCount = lessonMatch ? lessonMatch[1] + 'x' : '';

      const isOnline = titleRaw.includes('Online') || titleRaw.includes('online');

      const titlePart0 = titleLines[0] || '';
      const titlePart1 = titleLines[1] || '';
      let title = titlePart0;
      if (titlePart1) title += ' | ' + titlePart1;
      if (weekday && lessonCount) title += ' | ' + weekday + ' ' + lessonCount;
      else if (weekday) title += ' | ' + weekday;

      const startDateRaw = (cells[3].textContent || '').trim();
      const kurszeit = (cells[4].textContent || '').trim().replace(/(\d{2})\.(\d{2})/g, '$1:$2');

      const ortLink = cells[5].querySelector('a');
      let location = ortLink ? (ortLink.textContent || '').trim() : (cells[5].textContent || '').trim();
      if (!location) location = 'Zürich';
      if (isOnline || location.includes('Hause') || location.includes('hause')) {
        location = 'Online';
      }

      const preisRaw = (cells[8].textContent || '').trim();
      let price_chf: number | null = null;
      const preisClean = preisRaw.replace(/[^0-9]/g, '');
      if (preisClean) {
        const preisNum = parseInt(preisClean, 10);
        if (preisNum >= 100 && preisNum <= 99999) price_chf = preisNum;
      }

      const freiCell = cells[9] || null;
      let verfuegbarkeit: string | null = null;
      if (freiCell) {
        const freiText = freiCell.textContent?.trim().toLowerCase() || '';
        if (freiText.includes('ausgebucht')) verfuegbarkeit = 'ausgebucht';
        else if (freiText.includes('wenige')) verfuegbarkeit = 'wenige';
        else if (freiText.includes('viele')) verfuegbarkeit = 'viele';
      }

      const course_url = pageUrl + '/anmeldung';

      results.push({
        title,
        price_chf,
        location,
        start_date_raw: startDateRaw,
        occurrence: weekday ? weekday + (kurszeit ? ', ' + kurszeit : '') : kurszeit,
        course_type: courseType,
        course_url,
        is_online: isOnline,
        verfuegbarkeit,
      });
    }

    return results;
  }, { pageUrl, courseType, baseUrl: BASE_URL });

  for (const item of data) {
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
      verfuegbarkeit: item.verfuegbarkeit,
      last_scraped_at: new Date().toISOString(),
    });
  }

  console.log(`  -> ${courses.length} Kurs(e) gefunden auf ${pageUrl}`);
  return courses;
}

async function scrapeLernForum(): Promise<void> {
  let browser: Browser | null = null;

  const runId = await startScrapeRun();
  if (!runId) { console.error('Konnte keinen Scrape-Run starten. Abbruch.'); return; }

  try {
    console.log(`Starte ${PROVIDER_NAME} Scraper...`);
    browser = await puppeteer.launch({ headless: true });

    const metaPage = await browser.newPage();
    await metaPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    const metadata = await scrapeProviderMetadata(metaPage);
    await metaPage.close();

    console.log('Anbieter-Metadaten:', metadata);

    const { error: metaError } = await supabase
      .from('GymiProviders')
      .update({
        'Pruefungssimultaion': metadata.pruefungssimultaion,
        'Aufsatzkorrektur': metadata.aufsatzkorrektur,
        'E-Learning': metadata.eLearning,
        'Einzelkurse': metadata.einzelkurse,
        'Einstufungstest': metadata.einstufungstest,
      })
      .eq('ID', PROVIDER_ID);

    if (metaError) {
      console.error('Fehler beim Aktualisieren der GymiProviders Metadaten:', metaError.message);
      await logScrapeError(runId, PROVIDER_ID, 'METADATA_ERROR', metaError.message);
    } else {
      console.log('✓ GymiProviders Metadaten aktualisiert');
    }

    const { error: detailError } = await supabase
      .from('CourseDetails')
      .update({
        'Pruefungsarchiv': metadata.pruefungsarchiv,
        'Eigene Lernunterlagen': metadata.lernunterlagen,
        'Beratungsgespraech': metadata.beratungsgespraech,
      })
      .eq('ID', PROVIDER_ID);

    if (detailError) {
      console.error('Fehler beim Aktualisieren der CourseDetails Metadaten:', detailError.message);
      await logScrapeError(runId, PROVIDER_ID, 'METADATA_ERROR', detailError.message);
    } else {
      console.log('✓ CourseDetails Metadaten aktualisiert');
    }

    await supabase.from('courses').delete().eq('provider_id', PROVIDER_ID);
    console.log('Alte Kurse gelöscht.');

    for (const entry of urls) {
      let page: Page | null = null;
      try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`\nLade: ${entry.url}`);
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
          console.log(`✓ ${courses.length} Kurs(e) gespeichert`);
          courses.slice(0, 3).forEach((c: any) => {
            console.log(`  -> "${c.title.substring(0, 60)}..." | CHF ${c.price_chf ?? 'N/A'} | ${c.location} | ${c.verfuegbarkeit ?? 'N/A'}`);
          });
          if (courses.length > 3) console.log(`  ... und ${courses.length - 3} weitere Kurse`);

          // NEU: Preisverlauf speichern — Durchschnittspreis aller Kurse dieses Typs
          const coursesWithPrice = courses.filter(c => c.price_chf !== null);
          if (coursesWithPrice.length > 0) {
            const avgPrice = Math.round(
              coursesWithPrice.reduce((sum: number, c: any) => sum + c.price_chf, 0) / coursesWithPrice.length
            );
            await recordPriceHistory(PROVIDER_ID, entry.course_type, avgPrice);
          }
        }

      } catch (err: any) {
        console.error(`Fehler beim Scraping von ${entry.url}:`, err.message);
        await logScrapeError(runId, PROVIDER_ID, 'SCRAPING_ERROR', err.message);
      } finally {
        if (page) await page.close();
      }
    }

    await finishScrapeRun(runId, 'success');
    console.log(`\n${PROVIDER_NAME} Scraping abgeschlossen!`);

  } catch (err: any) {
    console.error('Allgemeiner Fehler:', err.message);
    await finishScrapeRun(runId, 'error');
  } finally {
    if (browser) await browser.close();
    console.log('Browser geschlossen.');
  }
}

scrapeLernForum().catch((error) => {
  console.error('Fehler beim Starten:', error.message);
});