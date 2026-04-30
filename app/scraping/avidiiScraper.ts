import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { startScrapeRun, finishScrapeRun, logScrapeError, recordPriceHistory } from './scrapeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROVIDER_ID = 3;
const PROVIDER_NAME = 'Avidii';

const urls = [
  { url: 'https://avidii.ch/gymivorbereitung-langzeitgymnasium', course_type: 'langgymi' },
  { url: 'https://avidii.ch/gymivorbereitung-kurzzeitgymnasium', course_type: 'kurzgymi' },
];

// Konvertiert "27. August 2025" → "2025-08-27"
function parseDateDE(raw: string): string | null {
  const months: Record<string, string> = {
    Januar: '01', Februar: '02', März: '03', April: '04',
    Mai: '05', Juni: '06', Juli: '07', August: '08',
    September: '09', Oktober: '10', November: '11', Dezember: '12',
  };
  const match = raw.trim().match(/(\d{1,2})\.\s+(\w+)\s+(\d{4})/);
  if (!match) return null;
  const month = months[match[2]];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
}

async function scrapeProviderMetadata(page: Page, pageUrl: string): Promise<{
  einstufungstest: boolean;
  pruefungsarchiv: boolean;
  beratungsgespraech: boolean;
  eLearning: boolean;
  aufsatzkorrektur: boolean;
  lernunterlagen: boolean;
}> {
  console.log(`Lese Anbieter-Metadaten von ${pageUrl}...`);
  await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  return await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    const bodyHtml = document.body.innerHTML.toLowerCase();

    return {
      einstufungstest: bodyText.includes('standortbestimmung'),
      pruefungsarchiv: bodyText.includes('alte prüfungen') || bodyText.includes('prüfungstraining'),
      beratungsgespraech: bodyHtml.includes('erstgespräch') || bodyHtml.includes('erstgesprach'),
      eLearning: bodyText.includes('lerncockpit') || bodyText.includes('google classroom'),
      aufsatzkorrektur: bodyText.includes('aufsatztraining') || bodyText.includes('aufsatzkorrektur'),
      lernunterlagen: bodyText.includes('kursmaterial') || bodyText.includes('lernmaterial'),
    };
  });
}

async function scrapeCoursesFromPage(
  page: Page,
  pageUrl: string,
  courseType: string,
  runId: string
): Promise<{ courses: any[]; groupPrice: number | null }> {
  const courses: any[] = [];

  await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // 1. Preis dynamisch aus der Preissektion lesen
  let groupPrice: number | null = null;
  try {
    await page.waitForSelector('.pricing-box', { timeout: 10000 });
    groupPrice = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('.pricing-box'));
      for (const box of boxes) {
        const tag = box.querySelector('.discount.tag-color');
        const priceEl = box.querySelector('span.price');
        if (!tag || !priceEl) continue;
        const tagText = tag.textContent?.toLowerCase() || '';
        if (tagText.includes('gruppe') && !priceEl.textContent?.includes('/h')) {
          const raw = priceEl.textContent?.replace(/[^0-9]/g, '') || '';
          const num = parseInt(raw, 10);
          if (!isNaN(num) && num > 100) return num;
        }
      }
      return null;
    });
    console.log(`  Gruppenkurs-Preis: CHF ${groupPrice ?? 'nicht gefunden'}`);
  } catch (e) {
    console.warn('  Warnung: Preis nicht gefunden.');
    await logScrapeError(runId, PROVIDER_ID, 'MISSING_FIELD', `Preis nicht gefunden auf ${pageUrl}`);
  }

  // 2. Kursdaten aus den Accordion-Einträgen lesen
  const dateMap: Record<string, { start: string | null; end: string | null }> = {};
  try {
    const accordionDates = await page.evaluate(() => {
      const result: Record<string, { start: string | null; end: string | null }> = {};
      const accordions = Array.from(document.querySelectorAll('.accordion'));
      for (const acc of accordions) {
        const titleEl = acc.querySelector('.accordion__title a');
        const title = titleEl?.textContent?.toLowerCase() || '';
        const content = acc.querySelector('.accordion__content');
        if (!content) continue;
        const rawHtml = content.innerHTML || '';
        const cleanText = rawHtml
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ');
        let allDates: string[] = [];
        const dateRegex = /\d{1,2}\.\s+\w+\s+\d{4}/g;
        let m;
        while ((m = dateRegex.exec(cleanText)) !== null) {
          allDates.push(m[0].trim());
        }
        if (allDates.length === 0) continue;
        let key = '';
        if (title.includes('mittwoch')) key = 'mittwoch';
        else if (title.includes('samstag')) key = 'samstag';
        else key = title.trim();
        result[key] = { start: allDates[0], end: allDates[allDates.length - 1] };
      }
      return result;
    });
    Object.assign(dateMap, accordionDates);
    console.log('  Kursdaten:', JSON.stringify(dateMap));
  } catch (e) {
    console.warn('  Warnung: Kursdaten nicht gefunden.');
    await logScrapeError(runId, PROVIDER_ID, 'MISSING_FIELD', `Kursdaten nicht gefunden auf ${pageUrl}`);
  }

  // 3. Kurstabelle lesen
  try {
    await page.waitForSelector('table.table', { timeout: 10000 });
  } catch (e) {
    console.warn('  Warnung: Kurstabelle nicht gefunden.');
    await logScrapeError(runId, PROVIDER_ID, 'NO_COURSES_FOUND', `Kurstabelle nicht gefunden auf ${pageUrl}`);
    return { courses, groupPrice };
  }

  const rows = await page.evaluate((args: { pageUrl: string; courseType: string }) => {
    const { pageUrl, courseType } = args;
    const table = document.querySelector('table.table');
    if (!table) return [];
    const results: any[] = [];

    const trows = Array.from(table.querySelectorAll('tbody tr'));
    for (const row of trows) {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 5) continue;

      const gruppe = cells[0]?.textContent?.trim() || '';
      if (!gruppe) continue;

      const location = cells[1]?.textContent?.trim() || 'Zürich Stadelhofen';
      const weekday = cells[2]?.textContent?.trim() || '';
      const uhrzeit = cells[3]?.textContent?.trim().replace(/\s*Uhr\s*$/i, '').trim() || '';

      const verfSpan = cells[4]?.querySelector('span');
      const spanColor = (verfSpan?.getAttribute('style') || '').toLowerCase();
      const verfText = verfSpan?.textContent?.trim().toLowerCase() || '';
      let verfuegbarkeit: string | null = null;
      if (spanColor.includes('fecc32') || verfText.includes('wenige')) {
        verfuegbarkeit = 'wenige';
      } else if (spanColor.includes('7fffd8') || verfText.includes('frei')) {
        verfuegbarkeit = 'viele';
      } else if (verfText.includes('ausgebucht')) {
        verfuegbarkeit = 'ausgebucht';
      }

      const isEinzelkurs = gruppe.toLowerCase().includes('einzel');
      const occurrence = weekday && uhrzeit ? `${weekday}, ${uhrzeit}` : weekday;

      results.push({
        gruppe,
        location: location || 'Zürich Stadelhofen',
        weekday: weekday.trim().toLowerCase(),
        uhrzeit,
        occurrence,
        verfuegbarkeit,
        isEinzelkurs,
        course_type: courseType,
        course_url: pageUrl,
      });
    }
    return results;
  }, { pageUrl, courseType });

  for (const row of rows) {
    const price = row.isEinzelkurs ? null : groupPrice;
    const weekdayKey = row.weekday;
    const dates = dateMap[weekdayKey] || { start: null, end: null };
    const startDate = dates.start ? parseDateDE(dates.start) : null;
    const endDate = dates.end ? parseDateDE(dates.end) : null;

    const typeLabel = courseType === 'langgymi' ? 'Langzeitgymnasium' : 'Kurzzeitgymnasium';
    let title = `Gymivorbereitung ${typeLabel} | ${row.gruppe}`;
    const weekdayClean = row.weekday.trim();
    if (!row.isEinzelkurs && weekdayClean && weekdayClean !== 'nach absprache') {
      title += ` | ${weekdayClean.charAt(0).toUpperCase() + weekdayClean.slice(1)}`;
    }

    courses.push({
      provider_id: PROVIDER_ID,
      title,
      price_chf: price,
      location: row.location,
      start_date: startDate,
      end_date: endDate,
      occurrence: row.occurrence,
      course_type: row.course_type,
      course_url: row.course_url,
      is_online: false,
      verfuegbarkeit: row.verfuegbarkeit,
      last_scraped_at: new Date().toISOString(),
      scraper_method: 'puppeteer',
    });
  }

  console.log(`  -> ${courses.length} Kurs(e) gefunden auf ${pageUrl}`);
  return { courses, groupPrice };
}

async function scrapeAvidii(): Promise<void> {
  let browser: Browser | null = null;
  let coursesFound = 0;
  let errorCount = 0;

  const runId = await startScrapeRun('puppeteer', PROVIDER_ID);
  if (!runId) { console.error('Konnte keinen Scrape-Run starten. Abbruch.'); return; }

  try {
    console.log(`Starte ${PROVIDER_NAME} Scraper...`);
    browser = await puppeteer.launch({ headless: true });

    // 1. Metadaten scrapen
    const metaPage = await browser.newPage();
    await metaPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    const metadata = await scrapeProviderMetadata(metaPage, urls[0].url);
    await metaPage.close();
    console.log('Anbieter-Metadaten:', metadata);

    const { error: metaProviderError } = await supabase
      .from('GymiProviders')
      .update({
        'E-Learning': metadata.eLearning,
        'Aufsatzkorrektur': metadata.aufsatzkorrektur,
        'Einstufungstest': metadata.einstufungstest,
      })
      .eq('ID', PROVIDER_ID);

    if (metaProviderError) {
      console.error('Fehler GymiProviders:', metaProviderError.message);
      await logScrapeError(runId, PROVIDER_ID, 'METADATA_ERROR', metaProviderError.message);
      errorCount++;
    } else {
      console.log('✓ GymiProviders Metadaten aktualisiert');
    }

    const { error: metaDetailError } = await supabase
      .from('CourseDetails')
      .update({
        'Pruefungsarchiv': metadata.pruefungsarchiv,
        'Beratungsgespraech': metadata.beratungsgespraech,
        'Eigene Lernunterlagen': metadata.lernunterlagen,
      })
      .eq('ID', PROVIDER_ID);

    if (metaDetailError) {
      console.error('Fehler CourseDetails:', metaDetailError.message);
      await logScrapeError(runId, PROVIDER_ID, 'METADATA_ERROR', metaDetailError.message);
      errorCount++;
    } else {
      console.log('✓ CourseDetails Metadaten aktualisiert');
    }

    // 2. Alte Kurse löschen (nur puppeteer-Kurse)
    await supabase.from('courses').delete()
      .eq('provider_id', PROVIDER_ID)
      .eq('scraper_method', 'puppeteer');
    console.log('Alte Kurse gelöscht.');

    // 3. Kurse scrapen
    for (const entry of urls) {
      let page: Page | null = null;
      try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`\nLade: ${entry.url}`);

        const { courses, groupPrice } = await scrapeCoursesFromPage(page, entry.url, entry.course_type, runId);

        if (courses.length === 0) {
          await logScrapeError(runId, PROVIDER_ID, 'NO_COURSES_FOUND', `Keine Kurse gefunden auf ${entry.url}`);
          errorCount++;
          continue;
        }

        const { error } = await supabase.from('courses').insert(courses);
        if (error) {
          console.error('Fehler beim Speichern:', error.message);
          await logScrapeError(runId, PROVIDER_ID, 'INSERT_ERROR', error.message);
          errorCount++;
        } else {
          console.log(`✓ ${courses.length} Kurs(e) gespeichert`);
          coursesFound += courses.length;
          courses.slice(0, 3).forEach((c: any) => {
            console.log(`  -> "${c.title.substring(0, 50)}" | CHF ${c.price_chf ?? 'N/A'} | ${c.verfuegbarkeit ?? 'N/A'}`);
          });
          if (courses.length > 3) console.log(`  ... und ${courses.length - 3} weitere Kurse`);

          if (groupPrice !== null) {
            await recordPriceHistory(PROVIDER_ID, entry.course_type, groupPrice);
          }
        }
      } catch (err: any) {
        console.error(`Fehler beim Scraping von ${entry.url}:`, err.message);
        await logScrapeError(runId, PROVIDER_ID, 'SCRAPING_ERROR', err.message);
        errorCount++;
      } finally {
        if (page) await page.close();
      }
    }

    const finalStatus = errorCount === 0 ? 'success' : (coursesFound > 0 ? 'partial' : 'failed');
    await finishScrapeRun(runId, finalStatus, coursesFound, errorCount);
    console.log(`\n${PROVIDER_NAME} Scraping abgeschlossen! (${coursesFound} Kurse, ${errorCount} Fehler)`);

  } catch (err: any) {
    console.error('Allgemeiner Fehler:', err.message);
    errorCount++;
    await finishScrapeRun(runId, 'failed', coursesFound, errorCount);
  } finally {
    if (browser) await browser.close();
    console.log('Browser geschlossen.');
  }
}

scrapeAvidii().catch((error) => {
  console.error('Fehler beim Starten:', error.message);
});