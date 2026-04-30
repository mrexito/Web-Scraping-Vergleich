import { createServerSupabaseClient } from '@/utils/supabase/server';

// TYPES
export type ScraperMethod = 'scrapegraphai' | 'puppeteer' | 'brightdata';

export interface ProviderRow {
  id: number;
  name: string;
  scrapegraphai: number;
  puppeteer: number;
  brightdata: number;
  total: number;
}

export interface RunRow {
  run_id: string;
  scraper_method: ScraperMethod;
  provider_id: number | null;
  provider_name: string | null;
  status: 'success' | 'partial' | 'failed' | 'running' | string;
  courses_found: number | null;
  error_count: number | null;
  duration_seconds: number | null;
  started_at: string;
}

export interface ErrorRow {
  id: number | string;
  run_id: string | null;
  provider_id: number | null;
  provider_name: string | null;
  error_type: string | null;
  message: string | null;
  fixed_by_ai: boolean | null;
  created_at: string;
}

export interface MethodAggregate {
  method: ScraperMethod;
  total_runs: number;
  success_runs: number;
  failed_runs: number;
  partial_runs: number;
  total_courses: number;
  total_errors: number;
  avg_duration_s: number | null;
  median_duration_s: number | null;
  success_rate_pct: number;
}

export interface ReportData {
  providers: ProviderRow[];
  runs: RunRow[];
  errors: ErrorRow[];
  aggregates: MethodAggregate[];
  total_courses: number;
  total_runs: number;
}

// LOAD ALL DATA 
export async function loadReportData(): Promise<ReportData> {
  const supabase = await createServerSupabaseClient();

  const [providersResult, runsResult, errorsResult] = await Promise.all([
    supabase
      .from('GymiProviders')
      .select('ID, Name')
      .lte('ID', 12)
      .order('ID'),
    supabase
      .from('scrape_runs')
      .select('id, scraper_method, provider_id, status, courses_found, error_count, started_at, finished_at')
      .order('started_at', { ascending: false })
      .limit(500),
    supabase
      .from('scrape_errors')
      .select('id, run_id, provider_id, error_type, message, fixed_by_ai, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  // Courses pro Provider
  const coursesResult = await supabase
    .from('courses')
    .select('provider_id, scraper_method');

  const providersRaw = providersResult.data ?? [];
  const runsRaw = runsResult.data ?? [];
  const errorsRaw = errorsResult.data ?? [];
  const coursesRaw = coursesResult.data ?? [];

  // Provider-Lookup nach ID
  const providerNameById = new Map<number, string>();
  providersRaw.forEach((p: any) => providerNameById.set(p.ID, p.Name));

  // Provider-Matrix: Kurse pro Methode pro Provider
  const providers: ProviderRow[] = providersRaw.map((p: any) => {
    const myCourses = coursesRaw.filter((c: any) => c.provider_id === p.ID);
    const sgi = myCourses.filter((c: any) => c.scraper_method === 'scrapegraphai').length;
    const pup = myCourses.filter((c: any) => c.scraper_method === 'puppeteer').length;
    const bd  = myCourses.filter((c: any) => c.scraper_method === 'brightdata').length;
    return {
      id: p.ID,
      name: p.Name,
      scrapegraphai: sgi,
      puppeteer: pup,
      brightdata: bd,
      total: sgi + pup + bd,
    };
  });

  // Runs anreichern 
  const runs: RunRow[] = runsRaw.map((r: any) => {
    const dur = r.finished_at && r.started_at
      ? (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000
      : null;
    return {
      run_id: r.id,
      scraper_method: r.scraper_method,
      provider_id: r.provider_id,
      provider_name: r.provider_id ? providerNameById.get(r.provider_id) ?? null : null,
      status: r.status,
      courses_found: r.courses_found,
      error_count: r.error_count,
      duration_seconds: dur ? Math.round(dur) : null,
      started_at: r.started_at,
    };
  });

  // Errors anreichern
  const errors: ErrorRow[] = errorsRaw.map((e: any) => ({
    id: e.id,
    run_id: e.run_id,
    provider_id: e.provider_id,
    provider_name: e.provider_id ? providerNameById.get(e.provider_id) ?? null : null,
    error_type: e.error_type,
    message: e.message,
    fixed_by_ai: e.fixed_by_ai,
    created_at: e.created_at,
  }));

  // Aggregates pro Methode
  const methods: ScraperMethod[] = ['scrapegraphai', 'puppeteer', 'brightdata'];
  const aggregates: MethodAggregate[] = methods.map((method) => {
    const myRuns = runs.filter((r) => r.scraper_method === method);
    const successRuns = myRuns.filter((r) => r.status === 'success').length;
    const failedRuns  = myRuns.filter((r) => r.status === 'failed').length;
    const partialRuns = myRuns.filter((r) => r.status === 'partial').length;

    const durations = myRuns
      .map((r) => r.duration_seconds)
      .filter((d): d is number => d !== null);
    const avg = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;
    const median = durations.length
      ? [...durations].sort((a, b) => a - b)[Math.floor(durations.length / 2)]
      : null;

    const totalCourses = myRuns.reduce((sum, r) => sum + (r.courses_found ?? 0), 0);
    const totalErrors  = myRuns.reduce((sum, r) => sum + (r.error_count ?? 0), 0);

    return {
      method,
      total_runs: myRuns.length,
      success_runs: successRuns,
      failed_runs: failedRuns,
      partial_runs: partialRuns,
      total_courses: totalCourses,
      total_errors: totalErrors,
      avg_duration_s: avg !== null ? Math.round(avg) : null,
      median_duration_s: median,
      success_rate_pct: myRuns.length
        ? Math.round((successRuns / myRuns.length) * 100)
        : 0,
    };
  });

  const total_courses = providers.reduce((sum, p) => sum + p.total, 0);
  const total_runs = runs.length;

  return { providers, runs, errors, aggregates, total_courses, total_runs };
}

// HELPER: Method labels
export const METHOD_LABEL: Record<ScraperMethod, string> = {
  scrapegraphai: 'ScrapeGraphAI',
  puppeteer: 'Puppeteer',
  brightdata: 'Bright Data',
};

export const METHOD_COLOR: Record<ScraperMethod, string> = {
  scrapegraphai: '#7c3aed', // violet-600
  puppeteer: '#2563eb',     // blue-600
  brightdata: '#16a34a',    // green-600
};