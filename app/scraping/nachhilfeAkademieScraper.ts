import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { startScrapeRun, finishScrapeRun, logScrapeError } from './scrapeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROVIDER_ID = 6;
const PROVIDER_NAME = 'Nachhilfe Akademie';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Metadaten von der Infoseite (reichhaltigerer Content als die Preisseiten)
const METADATA_URL = 'https://nachhilfeakademie.ch/langzeitgymnasium/';

const urls = [
  {
    url: 'https://nachhilfeakademie.ch/preise-gymivorbereitung-langgymnasium/',
    course_type: 'langgymi',
    intensivTableId: 'tablepress-3',
    // Korrekte Info-/Angebotsseite (nicht die Anmeldungsseite)
    anmeldungUrl: 'https://nachhilfeakademie.ch/langzeitgymnasium/',
  },
  {
    url: 'https://nachhilfeakademie.ch/preise-gymivorbereitung-kurzgymnasium/',
    course_type: 'kurzgymi',
    intensivTableId: 'tablepress-4',
    // Korrekte Info-/Angebotsseite (nicht die Anmeldungsseite)
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
    // eLearning: "Digital Classroom" in den Feature-Boxen (.feature_info)
    const featureTexts = Array.from(document.querySelectorAll('.feature_info'))
      .map(el => el.textContent?.toLowerCase() || '');
    const eLearning = featureTexts.some(t =>
      t.includes('digital classroom') || t.includes('digitale klassenräume')
    );

    // Aufsatzkorrektur: "Aufsatztraining" im Accordion-Body
    const accordionBodies = Array.from(document.querySelectorAll('.vc_tta-panel-body'))
      .map(el => el.textContent?.toLowerCase() || '');
    const aufsatzkorrektur = accordionBodies.some(t => t.includes('aufsatztraining'));

    // Einstufungstest: CTA-Button mit href="/einstufungstest/" sichtbar
    const links = Array.from(document.querySelectorAll('a'))
      .map(a => a.getAttribute('href') || '');
    const einstufungstest = links.some(h => h.includes('/einstufungstest'));

    // Simulationsprüfungen: eigene Section vorhanden
    const bodyText = document.body.innerText.toLowerCase();
    const pruefungssimulation = bodyText.includes('simulationsprüfung');

    // Lernunterlagen: Feature-Box mit "Lehrmittel" oder "ACHTUNG, FERTIG, GYMI!"
    const lernunterlagen = featureTexts.some(t =>
      t.includes('lehrmittel') || t.includes('achtung, fertig, gymi')
    );

    // Beratungsgespräch: kein dediziertes Angebot auf dieser Seite
    const beratungsgespraech = bodyText.includes('beratungsgespräch');

    // Standorte: aus Accordion-Panel "Standorte und Kontakt"

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

    // Unterrichtstage aus Accordion "Unterrichtszeiten"
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


function parseChfPrice(raw: string): number | null {
  const cleaned = raw.replace(/['\u2019\u0060\s]/g, '').replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return num >= 100 && num <= 50000 ? num : null;
}


function parseDateRange(raw: string): { start: string | null; end: string | null } {
  const matches = raw.match(/(\d{2}\.\d{2}\.\d{4})/g);
  if (!matches || matches.length === 0) return { start: null, end: null };
  const toISO = (d: string) => {
    const [day, month, year] = d.split('.');
    return `${year}-${month}-${day}`;
  };
  return {
    start: toISO(matches[0]),
    end: matches.length > 1 ? toISO(matches[matches.length - 1]) : toISO(matches[0]),
  };
}


async function scrapeWochenkurse(
  page: Page,
  courseType: string,
  standorte: string,
  pageUrl: string,
  anmeldungUrl: string,
): Promise<any[]> {
  const courses: any[] = [];

   try {
    await page.waitForSelector('table#tablepress-2 tbody tr', { timeout: 15000 });
  } catch {
    console.warn('  Warnung: tablepress-2 (Wochenkurse) nicht innerhalb 15s gefunden.');
    return courses;
  }

  const rows = await page.evaluate(() => {
  
    const table = document.querySelector('table#tablepress-2');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tbody tr')).map(row => {
      const cols = row.querySelectorAll('td');
      if (cols.length < 6) return null;
      return {
        lektionenProWoche: cols[0].textContent?.trim() || '',
        fach:              cols[1].textContent?.trim() || '',
        totalLektionen:    cols[2].textContent?.trim() || '',
        kostenPrivat:      cols[3].textContent?.trim() || '',
        kosten2er:         cols[4].textContent?.trim() || '',
        kosten4er:         cols[5].textContent?.trim() || '',
      };
    }).filter(Boolean);
  });

  for (const row of rows) {
    if (!row || !row.fach) continue;
    courses.push({
      provider_id: PROVIDER_ID,
      title: `Wöchentlicher Kurs – ${row.fach} (${row.lektionenProWoche})`,
      price_chf: parseChfPrice(row.kosten4er),
      location: standorte,
      occurrence: row.lektionenProWoche,
      course_type: courseType,
      course_url: anmeldungUrl,
      is_online: false,
      verfuegbarkeit: null,
      last_scraped_at: new Date().toISOString(),
    });
  }

  console.log(`  → ${courses.length} Wochenkurs-Zeilen (tablepress-2)`);
  return courses;
}


// Intensivkurse aus kurstyp-spezifischer Tabelle scrapen
async function scrapeIntensivkurse(
  page: Page,
  courseType: string,
  standorte: string,
  pageUrl: string,
  anmeldungUrl: string,
  tableId: string,   
): Promise<any[]> {
  const courses: any[] = [];

  try {
    await page.waitForSelector(`table#${tableId} tbody tr`, { timeout: 10000 });
  } catch {
    console.warn(`  Warnung: ${tableId} (Intensivkurse) nicht innerhalb 10s gefunden.`);
    return courses;
  }

  const rows = await page.evaluate((tid: string) => {
    const table = document.querySelector(`table#${tid}`);
    if (!table) return [];
    return Array.from(table.querySelectorAll('tbody tr')).map(row => {
      const cols = row.querySelectorAll('td');
      if (cols.length < 5) return null;
      return {
        name:         cols[0].textContent?.trim() || '',
        datum:        cols[1].textContent?.trim() || '',
        lektionen:    cols[2].textContent?.trim() || '',
        kostenPrivat: cols[3].textContent?.trim() || '',
        kostenGruppe: cols[4].textContent?.trim() || '',
      };
    }).filter(Boolean);
  }, tableId);

  for (const row of rows) {
    if (!row || !row.name) continue;
    const { start, end } = parseDateRange(row.datum);
    courses.push({
      provider_id: PROVIDER_ID,
      title: `Intensivkurs ${row.name} – ${row.lektionen}`,
      price_chf: parseChfPrice(row.kostenGruppe),
      location: standorte,
      occurrence: row.datum,
      course_type: courseType,
      course_url: anmeldungUrl,
      start_date: start,
      end_date: end,
      is_online: false,
      verfuegbarkeit: null,
      last_scraped_at: new Date().toISOString(),
    });
  }

  console.log(`  → ${courses.length} Intensivkurse (${tableId})`);
  return courses;
}


async function scrapeNachhilfeAkademie(): Promise<void> {
  let browser: Browser | null = null;

  const runId = await startScrapeRun();
  if (!runId) {
    console.error('Konnte keinen Scrape-Run starten. Abbruch.');
    return;
  }

  try {
    console.log(`Starte ${PROVIDER_NAME} Scraper...`);
    browser = await puppeteer.launch({ headless: true });

    // Metadaten von der Infoseite lesen 
    const metaPage = await browser.newPage();
    await metaPage.setUserAgent(USER_AGENT);
    const metadata = await scrapeProviderMetadata(metaPage);
    await metaPage.close();
    console.log('Anbieter-Metadaten:', metadata);

    // GymiProviders aktualisieren
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
    } else {
      console.log('✓ GymiProviders Metadaten aktualisiert');
    }

    // CourseDetails aktualisieren 
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
    } else {
      console.log('✓ CourseDetails Metadaten aktualisiert');
    }

    // Alte Kurse löschen 
    await supabase.from('courses').delete().eq('provider_id', PROVIDER_ID);
    console.log('Alte Kurse gelöscht.');

    // Kurse für Langgymi und Kurzgymi scrapen
    for (const entry of urls) {
      let page: Page | null = null;
      try {
        page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);

        console.log(`\nLade: ${entry.url}`);
        await page.goto(entry.url, { waitUntil: 'networkidle2', timeout: 60000 });

        
        const [wochenkurse, intensivkurse] = await Promise.all([
          scrapeWochenkurse(
            page,
            entry.course_type,
            metadata.standorte,
            entry.url,
            entry.anmeldungUrl
          ),
          scrapeIntensivkurse(
            page,
            entry.course_type,
            metadata.standorte,
            entry.url,
            entry.anmeldungUrl,
            entry.intensivTableId   
          ),
        ]);

        const allCourses = [...wochenkurse, ...intensivkurse];

        if (allCourses.length === 0) {
          await logScrapeError(
            runId, PROVIDER_ID, 'NO_COURSES_FOUND',
            `Keine Kurse gefunden auf ${entry.url}`
          );
          continue;
        }

        const { error } = await supabase.from('courses').insert(allCourses);
        if (error) {
          console.error('Fehler beim Speichern:', error.message);
          await logScrapeError(runId, PROVIDER_ID, 'INSERT_ERROR', error.message);
        } else {
          console.log(
            `✓ ${allCourses.length} Kurse gespeichert` +
            ` (${wochenkurse.length} Wochen + ${intensivkurse.length} Intensiv)`
          );
          allCourses.slice(0, 3).forEach((c: any) => {
            console.log(
              `  -> "${c.title.substring(0, 55)}" | CHF ${c.price_chf ?? 'N/A'} | ${c.location}`
            );
          });
          if (allCourses.length > 3) {
            console.log(`  ... und ${allCourses.length - 3} weitere Kurse`);
          }
        }
      } catch (error: any) {
        console.error(`Fehler beim Scraping von ${entry.url}:`, error.message);
        await logScrapeError(runId, PROVIDER_ID, 'SCRAPING_ERROR', error.message);
      } finally {
        if (page) await page.close();
      }
    }

    await finishScrapeRun(runId, 'success');
    console.log(`\n${PROVIDER_NAME} Scraping abgeschlossen!`);

  } catch (error: any) {
    console.error('Allgemeiner Fehler:', error.message);
    await finishScrapeRun(runId, 'error');
  } finally {
    if (browser) await browser.close();
    console.log('Browser geschlossen.');
  }
}

scrapeNachhilfeAkademie().catch(error =>
  console.error('Fehler beim Starten:', error.message)
);