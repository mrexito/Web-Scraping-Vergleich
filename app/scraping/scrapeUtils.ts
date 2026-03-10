import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function startScrapeRun(scraperType: string = 'puppeteer'): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_runs')
    .insert({ scraper_type: scraperType, status: 'running' })
    .select('id')
    .single();

  if (error) {
    console.error('Fehler beim Starten des Scrape-Runs:', error.message);
    return null;
  }

  console.log(`Scrape-Run gestartet mit ID: ${data.id}`);
  return data.id;
}

export async function finishScrapeRun(runId: string, status: 'success' | 'error'): Promise<void> {
  const { error } = await supabase
    .from('scrape_runs')
    .update({ finished_at: new Date().toISOString(), status })
    .eq('id', runId);

  if (error) {
    console.error('Fehler beim Beenden des Scrape-Runs:', error.message);
  } else {
    console.log(`Scrape-Run ${runId} beendet mit Status: ${status}`);
  }
}

export async function logScrapeError(
  runId: string,
  providerId: number,
  errorType: string,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from('scrape_errors')
    .insert({ run_id: runId, provider_id: providerId, error_type: errorType, message });

  if (error) {
    console.error('Fehler beim Loggen des Scrape-Fehlers:', error.message);
  } else {
    console.warn(`Fehler geloggt für Provider ${providerId}: ${message}`);
  }
}