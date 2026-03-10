import 'dotenv/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database.types';
import { startScrapeRun, finishScrapeRun, logScrapeError } from './scrapeUtils';

type ScrapedDataGymiProviders = Database['public']['Tables']['GymiProviders']['Insert'];
type ScrapedDataCourseDetails = Database['public']['Tables']['CourseDetails']['Insert'];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const providers = [
  {
    id: 1,
    name: "Gymivorbereitung Zuerich",
    urls: [
      { type: "Intensiv", url: "https://gymivorbereitung-zuerich.ch/kurzzeit/sportferien" },
      { type: "Langzeit", url: "https://gymivorbereitung-zuerich.ch/langzeit/sportferien" }
    ]
  }
];

async function scrapeWebsite(): Promise<void> {
  let browser: Browser | null = null;

  const runId = await startScrapeRun();
  if (!runId) {
    console.error('Konnte keinen Scrape-Run starten. Abbruch.');
    return;
  }

  try {
    console.log('Starte den Scraping-Prozess...');
    browser = await puppeteer.launch({ headless: true });

    for (const provider of providers) {
      console.log(`Scraping für Anbieter: ${provider.name}`);

      for (const entry of provider.urls) {
        console.log(`Besuche URL: ${entry.url}`);
        let page: Page | null = null;

        try {
          page = await browser.newPage();
          await page.goto(entry.url, { waitUntil: 'networkidle2', timeout: 60000 });

          const standortText = await page.$$eval('li', (elements) => {
            return elements
              .map(el => el.textContent?.trim())
              .find(text => text?.includes('Kursort:')) || null;
          });

          let standort = 'Unbekannt';
          if (standortText) {
            standort = standortText.replace('Kursort:', '').trim();
            console.log(`Standort gefunden: ${standort}`);
          } else {
            await logScrapeError(runId, provider.id, 'MISSING_FIELD', `Standort nicht gefunden auf ${entry.url}`);
          }

          const teilnehmerText = await page.$$eval('li', (elements) => {
            return elements
              .map(el => el.textContent?.trim())
              .find(text => text?.includes('max. 10 Personen')) || null;
          });

          let maximaleTeilnehmer = null;
          if (teilnehmerText) {
            const match = teilnehmerText.match(/(\d+)\s*bis\s*max\.\s*(\d+)\s*Personen/);
            maximaleTeilnehmer = match ? parseInt(match[2], 10) : null;
            console.log(`Maximale Teilnehmerzahl gefunden: ${maximaleTeilnehmer}`);
          } else {
            await logScrapeError(runId, provider.id, 'MISSING_FIELD', `Teilnehmerzahl nicht gefunden auf ${entry.url}`);
          }

          const preisText = await page.$$eval('li', (elements) => {
            return elements
              .map(el => el.textContent?.trim())
              .find(text => text?.includes('Teilnahmegebühr')) || null;
          });

          let preis = null;
          if (preisText) {
            const match = preisText.match(/(\d{1,5})\s*CHF/);
            preis = match ? parseInt(match[1], 10) : null;
            console.log(`Preis gefunden: ${preis} CHF`);
          } else {
            await logScrapeError(runId, provider.id, 'MISSING_FIELD', `Preis nicht gefunden auf ${entry.url}`);
          }

          const { data: existingGymiProvider } = await supabase
            .from('GymiProviders')
            .select('*')
            .eq('ID', provider.id)
            .maybeSingle();

          if (!existingGymiProvider) {
            await logScrapeError(runId, provider.id, 'PROVIDER_NOT_FOUND', `Kein GymiProvider gefunden für: ${provider.name}`);
            continue;
          }

          await supabase
            .from('GymiProviders')
            .update({
              "Maximale Anzahl der Teilnehmer": maximaleTeilnehmer,
              ...(entry.type === "Intensiv" && { "Preis Intensiver Kurs": preis }),
              ...(entry.type === "Langzeit" && { "Preis Langzeit Kurs": preis }),
            })
            .eq('ID', provider.id);
          console.log(`Preis für ${entry.type}-Kurs aktualisiert.`);

          await supabase
            .from('CourseDetails')
            .update({ Standort: standort })
            .eq('ID', provider.id);
          console.log('CourseDetails aktualisiert.');

        } catch (error: any) {
          console.error(`Fehler beim Scraping von ${entry.url}:`, error.message);
          await logScrapeError(runId, provider.id, 'SCRAPING_ERROR', error.message);
        } finally {
          if (page) await page.close();
        }
      }
    }

    await finishScrapeRun(runId, 'success');
    console.log('Scraping-Prozess abgeschlossen!');

  } catch (error: any) {
    console.error('Allgemeiner Fehler beim Scraping:', error.message);
    await finishScrapeRun(runId, 'error');
  } finally {
    if (browser) await browser.close();
    console.log('Browser geschlossen.');
  }
}

scrapeWebsite().catch((error) =>
  console.error('Fehler beim Starten von scrapeWebsite:', error.message)
);