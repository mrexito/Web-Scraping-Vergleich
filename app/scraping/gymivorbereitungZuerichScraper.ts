import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { startScrapeRun, finishScrapeRun, logScrapeError, recordPriceHistory } from './scrapeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROVIDER_ID = 1;
const PROVIDER_NAME = 'Gymivorbereitung Zuerich';
const BASE_URL = 'https://gymivorbereitung-zuerich.ch';

const WEEKDAY_ORDER = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WEEKDAY_MAP: Record<string, string> = {
  mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch',
  do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag', so: 'Sonntag',
  montag: 'Montag', dienstag: 'Dienstag', mittwoch: 'Mittwoch',
  donnerstag: 'Donnerstag', freitag: 'Freitag', samstag: 'Samstag', sonntag: 'Sonntag',
  montags: 'Montag', dienstags: 'Dienstag', mittwochs: 'Mittwoch',
  donnerstags: 'Donnerstag', freitags: 'Freitag', samstags: 'Samstag', sonntags: 'Sonntag',
};

const urls = [
  {
    url: `${BASE_URL}/langzeit/halbjahreskurs`,
    course_type: 'langgymi',
    registrationUrl: `${BASE_URL}/langzeit/halbjahreskurs#popup:schulbegleitend_LG`,
  },
  {
    url: `${BASE_URL}/kurzzeit/halbjahreskurs`,
    course_type: 'kurzgymi',
    registrationUrl: `${BASE_URL}/kurzzeit/halbjahreskurs#popup:schulbegleitend_KG`,
  },
];

async function scrapeProviderMetadata(page: Page, url: string): Promise<{
  preis: number | null;
  preisRegular: number | null;
  discountValidUntil: string | null;
  maxTeilnehmer: string | null;
  aufsatzkorrektur: boolean;
  einstufungstest: boolean;
  eLearning: boolean;
  pruefungsarchiv: boolean;
  beratungsgespraech: boolean;
  lernunterlagen: boolean;
  standorte: string[];
}> {
  console.log(`  Lese Metadaten von ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  return await page.evaluate(() => {
    const liTexts = Array.from(document.querySelectorAll('li'))
      .map(el => el.textContent?.trim() ?? '');
    const bodyText = document.body.innerText.toLowerCase();
    const bodyHtml = document.body.innerHTML.toLowerCase();

    let preis: number | null = null;
    let preisRegular: number | null = null;
    const preisLi = liTexts.find(t => t.includes('Teilnahmegebühr') || t.includes('CHF'));
    if (preisLi) {
      const matches = Array.from(preisLi.matchAll(/(\d{3,5})\s*CHF/g));
      if (matches.length >= 1) preis = parseInt(matches[0][1], 10);
      if (matches.length >= 2) preisRegular = parseInt(matches[1][1], 10);
      if (matches.length === 1) preisRegular = preis;
    }

    let discountValidUntil: string | null = null;
    const MONTHS: Record<string, string> = {
      januar: '01', februar: '02', märz: '03', april: '04',
      mai: '05', juni: '06', juli: '07', august: '08',
      september: '09', oktober: '10', november: '11', dezember: '12',
    };
    if (preisLi) {
      const discountMatch = preisLi.toLowerCase().match(/bis\s+(\w+)/);
      if (discountMatch) {
        const month = MONTHS[discountMatch[1]];
        if (month) {
          const year = new Date().getFullYear();
          discountValidUntil = `${year}-${month}-30`;
        }
      }
    }

    let maxTeilnehmer: string | null = null;
    const teilnehmerLi = liTexts.find(t => t.includes('max.') && t.includes('Personen'));
    if (teilnehmerLi) {
      const rangeMatch = teilnehmerLi.match(/(\d+)\s*bis\s*max\.\s*(\d+)\s*Personen/);
      const singleMatch = teilnehmerLi.match(/max\.\s*(\d+)\s*Personen/);
      if (rangeMatch) {
        maxTeilnehmer = `${rangeMatch[1]}\u2013${rangeMatch[2]}`;
      } else if (singleMatch) {
        maxTeilnehmer = singleMatch[1];
      }
    }

    const aufsatzkorrektur =
      bodyText.includes('aufsatzkorrekturen') ||
      bodyText.includes('aufsatzkorrektur');

    const einstufungstest =
      bodyText.includes('standortbestimmung') ||
      bodyText.includes('einstufungstest');

    const eLearning =
      bodyText.includes('e-learning') ||
      bodyText.includes('lerncockpit') ||
      bodyText.includes('google classroom') ||
      bodyText.includes('online-lernplattform') ||
      bodyText.includes('kursplattform') ||
      bodyText.includes('lernvideos') ||
      bodyText.includes('digitale lernkarten');

    const pruefungsarchiv =
      bodyText.includes('prüfungsarchiv') ||
      bodyText.includes('alte prüfungen') ||
      bodyText.includes('prüfungstraining');

    const beratungsgespraech =
      bodyHtml.includes('erstgespräch') ||
      bodyHtml.includes('erstgesprach') ||
      bodyText.includes('beratungsgespräch');

    const lernunterlagen =
      bodyText.includes('kursmaterial') ||
      bodyText.includes('lernmaterial') ||
      bodyText.includes('lernunterlagen') ||
      bodyText.includes('skript');

    const standortLi = liTexts.find(t => t.startsWith('Kursort:'));
    const standorte: string[] = [];
    if (standortLi) {
      if (standortLi.includes('HB')) standorte.push('Zürich HB');
      if (standortLi.includes('Stadelhofen')) standorte.push('Stadelhofen');
      if (standortLi.includes('Winterthur')) standorte.push('Winterthur');
      if (standortLi.toLowerCase().includes('online')) standorte.push('Online');
    }

    return {
      preis,
      preisRegular,
      discountValidUntil,
      maxTeilnehmer,
      aufsatzkorrektur,
      einstufungstest,
      eLearning,
      pruefungsarchiv,
      beratungsgespraech,
      lernunterlagen,
      standorte,
    };
  });
}

async function scrapeCoursesFromPage(
  page: Page,
  entry: (typeof urls)[0],
  runId: string
): Promise<any[]> {
  const courses: any[] = [];

  await page.goto(entry.url, { waitUntil: 'networkidle2', timeout: 60000 });

  try {
    await page.waitForSelector('table.t431__table', { timeout: 10000 });
  } catch {
    console.warn(`  Warnung: Keine .t431__table gefunden auf ${entry.url}`);
    await logScrapeError(runId, PROVIDER_ID, 'NO_COURSES_FOUND', `Kurstabelle nicht gefunden auf ${entry.url}`);
    return courses;
  }

  const rawCourses = await page.evaluate(
    (args: { courseType: string; registrationUrl: string }) => {
      const { courseType, registrationUrl } = args;
      const results: any[] = [];

      const allTables = Array.from(
        document.querySelectorAll('table.t431__table')
      ) as HTMLTableElement[];

      let targetTable: HTMLTableElement | null = null;
      for (const tbl of allTables) {
        const parent = tbl.closest('[data-screen-min="980px"]');
        if (!parent) continue;
        const isHidden =
          parent.getAttribute('aria-hidden') === 'true' ||
          parent.classList.contains('t397__off');
        if (!isHidden) {
          targetTable = tbl;
          break;
        }
      }

      if (!targetTable) return results;

      const rows = targetTable.querySelectorAll('tbody tr');

      for (const row of Array.from(rows)) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) continue;

        const kursName = (cells[0].textContent ?? '').trim();
        const zeitRaw = (cells[1].textContent ?? '').trim();
        const standort = (cells[2].textContent ?? '').trim();

        let verfuegbarkeit: string | null = null;
        if (cells[3]) {
          const span = cells[3].querySelector('span');
          if (span) {
            const text = (span.textContent ?? '').toLowerCase().trim();
            const style = (span.getAttribute('style') ?? '').toLowerCase();

            if (text.includes('ausgebucht')) {
              verfuegbarkeit = 'ausgebucht';
            } else if (text.includes('wenige')) {
              verfuegbarkeit = 'wenige';
            } else if (
              text.includes('freie') ||
              text.includes('plätze') ||
              style.includes('green')
            ) {
              verfuegbarkeit = 'viele';
            }
          }
        }

        const zeitParts = zeitRaw.split(',').map((s: string) => s.trim());
        const wochentag = zeitParts[0] ?? '';
        const uhrzeit = zeitParts[1] ?? '';

        const isOnline =
          standort.toLowerCase().includes('online') ||
          wochentag.toLowerCase().includes('online');

        results.push({
          title: `${kursName} | ${wochentag}${uhrzeit ? ', ' + uhrzeit : ''}`,
          location: isOnline ? 'Online' : standort,
          occurrence: zeitRaw,
          course_type: courseType,
          course_url: registrationUrl,
          is_online: isOnline,
          verfuegbarkeit,
        });
      }

      return results;
    },
    { courseType: entry.course_type, registrationUrl: entry.registrationUrl }
  );

  for (const item of rawCourses) {
    courses.push({
      provider_id: PROVIDER_ID,
      title: item.title,
      price_chf: null,
      location: item.location,
      start_date: null,
      end_date: null,
      occurrence: item.occurrence,
      course_type: item.course_type,
      course_url: item.course_url,
      is_online: item.is_online,
      verfuegbarkeit: item.verfuegbarkeit,
      last_scraped_at: new Date().toISOString(),
    });
  }

  console.log(`  -> ${courses.length} Kurs(e) gefunden auf ${entry.url}`);
  return courses;
}

function extractUnterrichttage(courses: any[]): string | null {
  const foundDays = new Set<string>();

  for (const course of courses) {
    const tokens = (course.occurrence ?? '').split(/[,&\s]+/);
    for (const token of tokens) {
      const clean = token.trim().toLowerCase().replace(/[^a-züäö]/g, '');
      const mapped = WEEKDAY_MAP[clean];
      if (mapped) foundDays.add(mapped);
    }
  }

  if (foundDays.size === 0) return null;

  const ordered = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
    .filter(d => foundDays.has(d));

  return ordered.join(', ');
}

async function scrapeGymivorbereitungZuerich(): Promise<void> {
  let browser: Browser | null = null;

  const runId = await startScrapeRun();
  if (!runId) {
    console.error('Konnte keinen Scrape-Run starten. Abbruch.');
    return;
  }

  try {
    console.log(`Starte ${PROVIDER_NAME} Scraper...`);
    browser = await puppeteer.launch({ headless: true });

    const metaPage = await browser.newPage();
    await metaPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    const metaLang = await scrapeProviderMetadata(metaPage, urls[0].url);
    console.log('Metadaten Langzeit:', metaLang);

    const metaKurz = await scrapeProviderMetadata(metaPage, urls[1].url);
    console.log('Metadaten Kurzzeit:', metaKurz);
    await metaPage.close();

    const { error: metaProviderError } = await supabase
      .from('GymiProviders')
      .update({
        'Aufsatzkorrektur': metaLang.aufsatzkorrektur,
        'Einstufungstest': metaLang.einstufungstest,
        'E-Learning': metaLang.eLearning,
        'Maximale Anzahl der Teilnehmer': metaLang.maxTeilnehmer,
        'Preis Langzeit Kurs': metaLang.preis,
        'Preis Intensiver Kurs': metaKurz.preis,
      })
      .eq('ID', PROVIDER_ID);

    if (metaProviderError) {
      console.error('Fehler beim Aktualisieren der GymiProviders:', metaProviderError.message);
      await logScrapeError(runId, PROVIDER_ID, 'METADATA_ERROR', metaProviderError.message);
    } else {
      console.log('✓ GymiProviders Metadaten aktualisiert');
    }

    const { error: metaDetailError } = await supabase
      .from('CourseDetails')
      .update({
        'Pruefungsarchiv': metaLang.pruefungsarchiv,
        'Beratungsgespraech': metaLang.beratungsgespraech,
        'Eigene Lernunterlagen': metaLang.lernunterlagen,
        'Standort': metaLang.standorte.join(', ') || null,
      })
      .eq('ID', PROVIDER_ID);

    if (metaDetailError) {
      console.error('Fehler beim Aktualisieren der CourseDetails:', metaDetailError.message);
      await logScrapeError(runId, PROVIDER_ID, 'METADATA_ERROR', metaDetailError.message);
    } else {
      console.log('✓ CourseDetails Metadaten aktualisiert');
    }

    await supabase.from('courses').delete().eq('provider_id', PROVIDER_ID);
    console.log('Alte Kurse gelöscht.');

    const allScrapedCourses: any[] = [];

    for (const entry of urls) {
      let page: Page | null = null;
      try {
        page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        console.log(`\nLade: ${entry.url}`);
        const courses = await scrapeCoursesFromPage(page, entry, runId);

        if (courses.length === 0) {
          await logScrapeError(
            runId, PROVIDER_ID, 'NO_COURSES_FOUND',
            `Keine Kurse gefunden auf ${entry.url}`
          );
          continue;
        }

        const meta = entry.course_type === 'langgymi' ? metaLang : metaKurz;

        const coursesWithPrice = courses.map(c => ({
          ...c,
          price_chf: meta.preis,
          price_regular_chf: meta.preisRegular,
          discount_valid_until: meta.discountValidUntil,
        }));

        const { error } = await supabase.from('courses').insert(coursesWithPrice);
        if (error) {
          console.error('Fehler beim Speichern:', error.message);
          await logScrapeError(runId, PROVIDER_ID, 'INSERT_ERROR', error.message);
        } else {
          console.log(`✓ ${courses.length} Kurs(e) [${entry.course_type}] gespeichert`);
          coursesWithPrice.slice(0, 3).forEach((c: any) => {
            console.log(
              `  -> "${c.title}" | CHF ${c.price_chf ?? 'N/A'} (regulär CHF ${c.price_regular_chf ?? 'N/A'}) | ` +
              `Rabatt bis: ${c.discount_valid_until ?? 'N/A'} | ${c.location} | ${c.verfuegbarkeit ?? 'N/A'}`
            );
          });
          if (courses.length > 3) {
            console.log(`  ... und ${courses.length - 3} weitere Kurse`);
          }

          allScrapedCourses.push(...courses);

          // NEU: Preisverlauf speichern (Frühbucherpreis)
          if (meta.preis !== null) {
            await recordPriceHistory(PROVIDER_ID, entry.course_type, meta.preis);
          }
        }

      } catch (err: any) {
        console.error(`Fehler beim Scraping von ${entry.url}:`, err.message);
        await logScrapeError(runId, PROVIDER_ID, 'SCRAPING_ERROR', err.message);
      } finally {
        if (page) await page.close();
      }
    }

    const unterrichttag = extractUnterrichttage(allScrapedCourses);
    if (unterrichttag) {
      const { error: unterrichttagError } = await supabase
        .from('CourseDetails')
        .update({ Unterrichttag: unterrichttag })
        .eq('ID', PROVIDER_ID);

      if (unterrichttagError) {
        console.error('Fehler beim Speichern des Unterrichttags:', unterrichttagError.message);
        await logScrapeError(runId, PROVIDER_ID, 'METADATA_ERROR', unterrichttagError.message);
      } else {
        console.log(`✓ Unterrichttag gesetzt: ${unterrichttag}`);
      }
    } else {
      console.warn('  Kein Unterrichttag aus Kursen ableitbar.');
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

scrapeGymivorbereitungZuerich().catch((error) =>
  console.error('Fehler beim Starten:', error.message)
);