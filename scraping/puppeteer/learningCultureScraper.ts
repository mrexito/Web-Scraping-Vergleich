import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { startScrapeRun, finishScrapeRun, logScrapeError, recordPriceHistory } from './scrapeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROVIDER_ID = 4;
const PROVIDER_NAME = 'Learning Culture';

const urls = [
  { url: 'https://www.learningculture.ch/kurse/langgymi-pruefung', course_type: 'langgymi' },
  { url: 'https://www.learningculture.ch/kurse/kurzgymi-pruefung', course_type: 'kurzgymi' },
];

// Konvertiert "21.03.2026" → "2026-03-21"
function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  let year = parts[2];
  if (year.length === 2) year = '20' + year;
  return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

async function scrapeProviderMetadata(page: Page, pageUrl: string): Promise<{
  aufsatzkorrektur: boolean;
  simulationspruefung: boolean;
  eLearning: boolean;
  lernunterlagen: boolean;
  beratungsgespraech: boolean;
  einstufungstest: boolean;
}> {
  console.log(`Lese Anbieter-Metadaten von ${pageUrl}...`);
  await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  return await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    const bodyHtml = document.body.innerHTML.toLowerCase();

    return {
      aufsatzkorrektur:
        bodyText.includes('aufsatztraining') || bodyText.includes('aufsatzkorrektur'),
      simulationspruefung:
        bodyText.includes('simulationsprüfung') || bodyText.includes('simulationspruefung'),
      eLearning: bodyHtml.includes('online-kurs') || bodyHtml.includes('e-learning'),
      lernunterlagen: bodyText.includes('lehrmittel') || bodyText.includes('lernunterlagen'),
      beratungsgespraech:
        bodyText.includes('elterngespräch') || bodyText.includes('pädagogische leitung'),
      einstufungstest: bodyText.includes('einstufungstest') || bodyText.includes('standortbestimmung'),
    };
  });
}

async function scrapeCoursesFromPage(
  page: Page,
  pageUrl: string,
  courseType: string,
  runId: string
): Promise<any[]> {
  const courses: any[] = [];

  await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  const allTabIds = await page.$$eval('.tab-list-item a.tab-heading', (links) =>
    links.map((link) => (link.getAttribute('href') || '').replace('#', '')).filter(Boolean)
  );
  const tabIds = allTabIds.filter(id =>
    id.startsWith('2026') || id.startsWith('20')
  );

  console.log(`  Gefundene Tabs: ${tabIds.join(', ')}`);

  for (const tabId of tabIds) {
    try {
      await page.click(`.tab-list-item a[href="#${tabId}"]`);
      await page.waitForSelector('.div-table-row', { timeout: 5000 });
      console.log(`  Tab "${tabId}" geöffnet`);
    } catch (e) {
      console.warn(`  Konnte Tab "${tabId}" nicht anklicken`);
      await logScrapeError(runId, PROVIDER_ID, 'TAB_CLICK_ERROR', `Tab ${tabId} nicht anklickbar auf ${pageUrl}`);
      continue;
    }

    const tabCourses = await page.evaluate(
      (args: { tabId: string; pageUrl: string; courseType: string }) => {
        const { tabId, pageUrl, courseType } = args;
        const container = document.getElementById(tabId);
        if (!container) return [];

        const rows = Array.from(container.querySelectorAll('.div-table-row'));
        let lastSubcat = '';
        const results: any[] = [];

        for (const row of rows) {
          const subcatEl = row.querySelector('.course-subcat:not(.no-content) h4');
          if (subcatEl?.textContent?.trim()) {
            lastSubcat = subcatEl.textContent.trim();
          }

          const infoEl = row.querySelector('[data-item-name]');
          if (!infoEl) continue;

          const itemName = infoEl.getAttribute('data-item-name') || lastSubcat || '';
          const priceRaw = infoEl.getAttribute('data-item-price') || '';
          const occurrence = infoEl.getAttribute('data-item-occurrence') || '';
          const locationAddress = infoEl.getAttribute('data-item-location-address') || '';
          const locationTextEl = row.querySelector('.course-location');
          const locationText = locationTextEl?.textContent?.trim() || '';
          const startDateRaw = infoEl.getAttribute('data-item-course-start-date') || '';
          const courseDates = (infoEl.getAttribute('data-item-course-dates') || '')
            .split(';')
            .map((d) => d.trim())
            .filter(Boolean);

          if (!itemName && !occurrence) continue;

          const price = priceRaw ? parseInt(priceRaw, 10) : null;

          let location = locationText;
          if (!location || location.toLowerCase().includes('ort wie') || location.toLowerCase().includes('ort in planung')) {
            location = locationAddress
              .replace(/^ort in planung:\s*/i, '')
              .replace(/^ort:\s*/i, '')
              .split(',')[0]
              .trim();
          }
          if (!location || location.toLowerCase().includes('voraussichtlich')) {
            location = 'Zürich Stadelhofen';
          }

          let verfuegbarkeit: string | null = null;
          const btn = row.querySelector('button.add-to-cart');
          if (btn) {
            const btnText = btn.textContent?.trim().toLowerCase() || '';
            const isDisabled = btn.hasAttribute('disabled');
            if (btnText.includes('ausgebucht') || isDisabled) {
              verfuegbarkeit = 'ausgebucht';
            } else if (btnText.includes('anmelden')) {
              verfuegbarkeit = 'viele';
            }
          }

          let startDate: string | null = null;
          if (startDateRaw) {
            const match = startDateRaw.match(/(\d{4}-\d{2}-\d{2})/);
            startDate = match ? match[1] : null;
          }
          let endDate: string | null = null;
          if (courseDates.length > 0) {
            const lastRaw = courseDates[courseDates.length - 1];
            const parts = lastRaw.split('.');
            if (parts.length === 3) {
              endDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }

          const title = `${itemName} | ${occurrence}`;

          results.push({
            title,
            price_chf: isNaN(price as number) ? null : price,
            location,
            start_date: startDate,
            end_date: endDate,
            occurrence,
            course_type: courseType,
            course_url: pageUrl,
            verfuegbarkeit,
            scraper_method: 'puppeteer',
          });
        }

        return results;
      },
      { tabId, pageUrl, courseType }
    );

    console.log(`  → ${tabCourses.length} Kurs(e) in Tab "${tabId}" gefunden`);

    courses.push(
      ...tabCourses.map((c) => ({
        provider_id: PROVIDER_ID,
        ...c,
        last_scraped_at: new Date().toISOString(),
      }))
    );
  }

  if (courses.length === 0) {
    await logScrapeError(
      runId,
      PROVIDER_ID,
      'NO_COURSES_FOUND',
      `Keine Kurse gefunden auf ${pageUrl}`
    );
  }

  console.log(`  → Total ${courses.length} Kurs(e) auf ${pageUrl}`);
  return courses;
}

async function scrapeLearningCulture(): Promise<void> {
  let browser: Browser | null = null;
  let coursesFound = 0;
  let errorCount = 0;
  let oldCoursesDeleted = false;

  const runId = await startScrapeRun('puppeteer', PROVIDER_ID);
  if (!runId) {
    console.error('Konnte keinen Scrape-Run starten. Abbruch.');
    return;
  }

  try {
    console.log(`Starte ${PROVIDER_NAME} Scraper...`);
    browser = await puppeteer.launch({ headless: true });

    const metaPage = await browser.newPage();
    await metaPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
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
        'Pruefungsarchiv': metadata.simulationspruefung,
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

    // Alte Kurse werden erst gelöscht, sobald der erste erfolgreiche Scrape
    // neue Daten liefert (siehe unten) - verhindert, dass ein komplett
    // fehlgeschlagener Lauf die Datenbank leer lässt.
    for (const entry of urls) {
      let page: Page | null = null;
      try {
        page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        console.log(`\nLade: ${entry.url}`);
        const courses = await scrapeCoursesFromPage(page, entry.url, entry.course_type, runId);

        if (courses.length === 0) {
          continue;
        }

        if (!oldCoursesDeleted) {
          await supabase.from('courses').delete()
            .eq('provider_id', PROVIDER_ID)
            .eq('scraper_method', 'puppeteer');
          console.log('Alte Kurse gelöscht.');
          oldCoursesDeleted = true;
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
            console.log(
              `  -> "${c.title.substring(0, 55)}" | CHF ${c.price_chf ?? 'N/A'} | ${c.verfuegbarkeit ?? 'N/A'}`
            );
          });
          if (courses.length > 3) console.log(`  ... und ${courses.length - 3} weitere Kurse`);

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

scrapeLearningCulture().catch((error) => {
  console.error('Fehler beim Starten:', error.message);
});