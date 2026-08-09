import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { startScrapeRun, finishScrapeRun, logScrapeError, recordPriceHistory } from './scrapeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROVIDER_ID = 6;
const PROVIDER_NAME = 'Nachhilfe Akademie';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const METADATA_URL = 'https://nachhilfeakademie.ch/langzeitgymnasium/';

const urls = [
  {
    url: 'https://nachhilfeakademie.ch/preise-gymivorbereitung-langgymnasium/',
    course_type: 'langgymi',
    anmeldungUrl: 'https://nachhilfeakademie.ch/langzeitgymnasium/',
  },
  {
    url: 'https://nachhilfeakademie.ch/preise-gymivorbereitung-kurzgymnasium/',
    course_type: 'kurzgymi',
    anmeldungUrl: 'https://nachhilfeakademie.ch/kurzgymnasium/',
  },
];

async function scrapeProviderMetadata(page: Page): Promise<{
  eLearning: boolean;
  aufsatzkorrektur: boolean;
  einstufungstest: boolean;
  pruefungssimulation: boolean;
  lernunterlagen: boolean;
  beratungsgespraech: boolean;
  standorte: string;
  unterrichtstage: string;
}> {
  console.log(`Lese Anbieter-Metadaten von ${METADATA_URL}...`);
  await page.goto(METADATA_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  return await page.evaluate(() => {
    const featureTexts = Array.from(document.querySelectorAll('.feature_info'))
      .map(el => el.textContent?.toLowerCase() || '');
    const eLearning = featureTexts.some(t =>
      t.includes('digital classroom') || t.includes('digitale klassenräume')
    );

    const accordionBodies = Array.from(document.querySelectorAll('.vc_tta-panel-body'))
      .map(el => el.textContent?.toLowerCase() || '');
    const aufsatzkorrektur = accordionBodies.some(t => t.includes('aufsatztraining'));

    const links = Array.from(document.querySelectorAll('a'))
      .map(a => a.getAttribute('href') || '');
    const einstufungstest = links.some(h => h.includes('/einstufungstest'));

    const bodyText = document.body.innerText.toLowerCase();
    const pruefungssimulation = bodyText.includes('simulationsprüfung');

    const lernunterlagen = featureTexts.some(t =>
      t.includes('lehrmittel') || t.includes('achtung, fertig, gymi')
    );

    const beratungsgespraech = bodyText.includes('beratungsgespräch');

    const cities = new Set<string>();
    const panels = Array.from(document.querySelectorAll('.vc_tta-panel'));
    for (const panel of panels) {
      const title = panel.querySelector('.vc_tta-title-text')?.textContent || '';
      if (!title.toLowerCase().includes('standort')) continue;
      const pTexts = Array.from(panel.querySelectorAll('p'))
        .map(p => p.textContent || '');
      for (const p of pTexts) {
        const match = p.match(/\d{4}\s+(Zürich|Winterthur|Basel|Bern|Luzern)/);
        if (match) cities.add(match[1]);
      }
      break;
    }
    const standorte = cities.size > 0
      ? Array.from(cities).join(', ')
      : 'Zürich, Winterthur, Basel';

    const WEEKDAY_ORDER = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const foundDays = new Set<string>();
    for (const panel of panels) {
      const title = panel.querySelector('.vc_tta-title-text')?.textContent || '';
      if (!title.toLowerCase().includes('unterrichtszeit')) continue;
      const strongTags = Array.from(panel.querySelectorAll('strong'))
        .map(s => s.textContent?.trim() || '');
      for (const tag of strongTags) {
        if (WEEKDAY_ORDER.includes(tag)) foundDays.add(tag);
      }
      break;
    }
    const unterrichtstage = WEEKDAY_ORDER.filter(d => foundDays.has(d)).join(', ');

    return {
      eLearning,
      aufsatzkorrektur,
      einstufungstest,
      pruefungssimulation,
      lernunterlagen,
      beratungsgespraech,
      standorte,
      unterrichtstage,
    };
  });
}

function parsePerLessonPrice(raw: string): number | null {
  const cleaned = raw.replace(/['’`\s]/g, '').replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return num > 0 && num <= 500 ? num : null;
}

/**
 * Seit dem Website-Redesign (Aug 2026) gibt es keine tablepress-Tabellen mit
 * festen Kursterminen mehr, sondern nur noch Elementor-"Icon-Box"-Preiskarten
 * ohne Datum/Wochentag/Verfügbarkeit. Nur "Gruppenunterricht" (2er/4er Gruppe)
 * wird gescrapt, da das am ehesten mit den Gruppenkursen der anderen Anbieter
 * vergleichbar ist. Einzelunterricht (Pro-Lektion-Tarif) und Ferienkurse
 * (ebenfalls ohne feste Termine) werden bewusst ausgelassen.
 */
async function scrapeGruppenunterricht(
  page: Page,
  courseType: string,
  standorte: string,
  anmeldungUrl: string,
): Promise<any[]> {
  const courses: any[] = [];

  try {
    await page.waitForSelector('.elementor-icon-box-title', { timeout: 15000 });
  } catch {
    console.warn('  Warnung: Preiskarten (.elementor-icon-box-title) nicht innerhalb 15s gefunden.');
    return courses;
  }

  const tiers = await page.evaluate(() => {
    const results: { title: string; description: string; priceText: string }[] = [];
    const titleEls = Array.from(document.querySelectorAll('.elementor-icon-box-title'));
    for (const titleEl of titleEls) {
      const title = titleEl.textContent?.trim() || '';
      if (!/^(2er|4er) Gruppe$/.test(title)) continue;

      const description = titleEl.parentElement
        ?.querySelector('.elementor-icon-box-description')
        ?.textContent?.trim() || '';

      const container = titleEl.closest('.e-child');
      const priceText = container
        ? Array.from(container.querySelectorAll('.elementor-widget-text-editor p'))
            .map(p => p.textContent?.trim() || '')
            .find(t => /CHF/i.test(t)) || ''
        : '';

      results.push({ title, description, priceText });
    }
    return results;
  });

  for (const tier of tiers) {
    const price = parsePerLessonPrice(tier.priceText);
    if (price === null) continue;
    courses.push({
      provider_id:     PROVIDER_ID,
      title:           `Gruppenunterricht ${tier.title} (${tier.description})`,
      price_chf:       price,
      location:        standorte,
      occurrence:      tier.description,
      course_type:     courseType,
      course_url:      anmeldungUrl,
      is_online:        false,
      verfuegbarkeit:  null,
      last_scraped_at: new Date().toISOString(),
      scraper_method:  'puppeteer',
    });
  }

  console.log(`  → ${courses.length} Gruppenunterricht-Tarif(e)`);
  return courses;
}

async function scrapeNachhilfeAkademie(): Promise<void> {
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
    await metaPage.setUserAgent(USER_AGENT);
    const metadata = await scrapeProviderMetadata(metaPage);
    await metaPage.close();
    console.log('Anbieter-Metadaten:', metadata);

    const { error: metaProviderError } = await supabase
      .from('GymiProviders')
      .update({
        'E-Learning':        metadata.eLearning,
        Aufsatzkorrektur:    metadata.aufsatzkorrektur,
        Einstufungstest:     metadata.einstufungstest,
        Pruefungssimultaion: metadata.pruefungssimulation,
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
        'Eigene Lernunterlagen': metadata.lernunterlagen,
        Beratungsgespraech:      metadata.beratungsgespraech,
        Pruefungsarchiv:         false,
        Standort:                metadata.standorte,
        Unterrichttag:           metadata.unterrichtstage,
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
        await page.setUserAgent(USER_AGENT);

        console.log(`\nLade: ${entry.url}`);
        await page.goto(entry.url, { waitUntil: 'networkidle2', timeout: 60000 });

        const allCourses = await scrapeGruppenunterricht(
          page,
          entry.course_type,
          metadata.standorte,
          entry.anmeldungUrl
        );

        if (allCourses.length === 0) {
          await logScrapeError(
            runId, PROVIDER_ID, 'NO_COURSES_FOUND',
            `Keine Kurse gefunden auf ${entry.url}`
          );
          errorCount++;
          continue;
        }

        if (!oldCoursesDeleted) {
          await supabase.from('courses').delete()
            .eq('provider_id', PROVIDER_ID)
            .eq('scraper_method', 'puppeteer');
          console.log('Alte Kurse gelöscht.');
          oldCoursesDeleted = true;
        }

        const { error } = await supabase.from('courses').insert(allCourses);
        if (error) {
          console.error('Fehler beim Speichern:', error.message);
          await logScrapeError(runId, PROVIDER_ID, 'INSERT_ERROR', error.message);
          errorCount++;
        } else {
          console.log(`✓ ${allCourses.length} Kurse gespeichert`);
          coursesFound += allCourses.length;
          allCourses.slice(0, 3).forEach((c: any) => {
            console.log(
              `  -> "${c.title.substring(0, 55)}" | CHF ${c.price_chf ?? 'N/A'} | ${c.location}`
            );
          });
          if (allCourses.length > 3) {
            console.log(`  ... und ${allCourses.length - 3} weitere Kurse`);
          }

          const coursesWithPrice = allCourses.filter(c => c.price_chf !== null);
          if (coursesWithPrice.length > 0) {
            const avgPrice = Math.round(
              coursesWithPrice.reduce((sum: number, c: any) => sum + c.price_chf, 0) / coursesWithPrice.length
            );
            await recordPriceHistory(PROVIDER_ID, entry.course_type, avgPrice);
          }
        }
      } catch (error: any) {
        console.error(`Fehler beim Scraping von ${entry.url}:`, error.message);
        await logScrapeError(runId, PROVIDER_ID, 'SCRAPING_ERROR', error.message);
        errorCount++;
      } finally {
        if (page) await page.close();
      }
    }

    const finalStatus = errorCount === 0 ? 'success' : (coursesFound > 0 ? 'partial' : 'failed');
    await finishScrapeRun(runId, finalStatus, coursesFound, errorCount);
    console.log(`\n${PROVIDER_NAME} Scraping abgeschlossen! (${coursesFound} Kurse, ${errorCount} Fehler)`);

  } catch (error: any) {
    console.error('Allgemeiner Fehler:', error.message);
    errorCount++;
    await finishScrapeRun(runId, 'failed', coursesFound, errorCount);
  } finally {
    if (browser) await browser.close();
    console.log('Browser geschlossen.');
  }
}

scrapeNachhilfeAkademie().catch(error =>
  console.error('Fehler beim Starten:', error.message)
);