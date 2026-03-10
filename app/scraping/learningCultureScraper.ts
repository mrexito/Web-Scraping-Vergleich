import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { startScrapeRun, finishScrapeRun, logScrapeError } from './scrapeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROVIDER_ID = 4;
const PROVIDER_NAME = 'Learning Culture';

const urls = [
  { url: 'https://www.learningculture.ch/kurse/langgymi-pruefung', course_type: 'langgymi' },
  { url: 'https://www.learningculture.ch/kurse/kurzgymi-pruefung', course_type: 'kurzgymi' },
];

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

  const tabIds = await page.$$eval('.tab-list-item a.tab-heading', (links) =>
    links.map(link => link.getAttribute('href')?.replace('#', '') || '')
  );

  console.log(`Gefundene Tabs: ${tabIds.join(', ')}`);

  for (const tabId of tabIds) {
    if (!tabId) continue;

    try {
      await page.click(`.tab-list-item a[href="#${tabId}"]`);
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`Tab "${tabId}" geöffnet`);
    } catch (e) {
      console.warn(`Konnte Tab "${tabId}" nicht anklicken`);
      continue;
    }

    const tabCourses = await page.$$eval(
      `[id="${tabId}"] .div-table-row`,
      (rows, args) => {
        const { pageUrl, courseType } = args;
        let lastSubcat = '';
        return rows.map(row => {
          const subcatEl = row.querySelector('.course-subcat:not(.no-content) h4');
          if (subcatEl?.textContent?.trim()) {
            lastSubcat = subcatEl.textContent.trim();
          }

          const priceEl = row.querySelector('[data-item-price]');
          const price = priceEl ? parseInt(priceEl.getAttribute('data-item-price') || '0') : null;

          const locationEl = row.querySelector('.course-location');
          const location = locationEl?.textContent?.trim() || 'Unbekannt';

          const datesEl = row.querySelector('.course-dates');
          const datesText = datesEl?.textContent?.trim() || '';
          const dateParts = datesText.split(' - ');

          const parseDate = (d: string) => {
            const parts = d.trim().split('.');
            if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return null;
          };

          const occurrenceEl = row.querySelector('.course-occurrence');
          const occurrence = occurrenceEl?.textContent?.trim() || '';

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
        }).filter(c => c.title && c.occurrence);
      },
      { pageUrl, courseType }
    );

    console.log(`  → ${tabCourses.length} Kurse in Tab "${tabId}" gefunden`);
    courses.push(...tabCourses);
  }

  return courses;
}

async function scrapeLearningCulture(): Promise<void> {
  let browser: Browser | null = null;

  const runId = await startScrapeRun();
  if (!runId) { console.error('Konnte keinen Scrape-Run starten. Abbruch.'); return; }

  try {
    console.log('Starte ' + PROVIDER_NAME + ' Scraper...');
    browser = await puppeteer.launch({ headless: true });

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
    console.log('\n' + PROVIDER_NAME + ' Scraping abgeschlossen!');

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