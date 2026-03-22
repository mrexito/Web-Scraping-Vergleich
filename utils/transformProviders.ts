import type { GymiProvider } from '@/schemas/gymiProviderSchema';
import type { TransformedGymiProviders } from '@/components/UtilityAnalysisInteraction';

type CourseRow = {
  provider_id: number;
  price_chf: number | null;
  course_type: string | null;
  location: string | null;
  occurrence: string | null;
  start_date: string | null;
  verfuegbarkeit: string | null;
  is_online: boolean | null;
  course_url: string | null;
};

function getPriceRange(courses: CourseRow[], providerId: number, courseType: string): string | number {
  const filtered = courses.filter(
    c => c.provider_id === providerId &&
    c.course_type === courseType &&
    c.price_chf !== null
  );
  if (filtered.length === 0) return 'Nicht verfügbar';
  const prices = filtered.map(c => c.price_chf as number);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return min;
  return `CHF ${min.toLocaleString('de-CH')} – ${max.toLocaleString('de-CH')}`;
}

function getVerfuegbarkeit(courses: CourseRow[], providerId: number, courseType: string): string | null {
  const grouped = courses.filter(
    c => c.provider_id === providerId &&
    c.course_type === courseType &&
    !c.location?.toLowerCase().includes('absprache')
  );
  const relevant = grouped.length > 0
    ? grouped
    : courses.filter(c => c.provider_id === providerId && c.course_type === courseType);
  if (relevant.length === 0) return null;
  if (relevant.some(c => c.verfuegbarkeit === 'viele')) return 'Viele Plätze verfügbar';
  if (relevant.some(c => c.verfuegbarkeit === 'wenige')) return 'Wenige Plätze verfügbar';
  if (relevant.some(c => c.verfuegbarkeit === 'ausgebucht')) return 'Einige Kurse ausgebucht';
  return null;
}

function getCourseUrl(courses: CourseRow[], providerId: number, courseType: string): string | null {
  const course = courses.find(
    c => c.provider_id === providerId && c.course_type === courseType && c.course_url
  );
  return course?.course_url ?? null;
}

const WEEKDAY_MAP: Record<string, string> = {
  'mo': 'Montag', 'di': 'Dienstag', 'mi': 'Mittwoch',
  'do': 'Donnerstag', 'fr': 'Freitag', 'sa': 'Samstag',
  'so': 'Sonntag', 'montag': 'Montag', 'dienstag': 'Dienstag',
  'mittwoch': 'Mittwoch', 'donnerstag': 'Donnerstag', 'freitag': 'Freitag',
  'samstag': 'Samstag', 'sonntag': 'Sonntag',
};

const WEEKDAY_ORDER = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function getUnterrichtstage(courses: CourseRow[], providerId: number, courseType: string): string | null {
  const filtered = courses.filter(
    c => c.provider_id === providerId &&
    c.course_type === courseType &&
    c.occurrence !== null
  );


  if (filtered.length === 0) return null;

  const found = new Set<string>();

  for (const course of filtered) {
    const raw = course.occurrence || '';
    const tokens = raw.split(/[,&\s]+/);
    for (const token of tokens) {
      const clean = token.trim().toLowerCase().replace(/[^a-züäö]/g, '');
      if (WEEKDAY_MAP[clean]) {
        found.add(WEEKDAY_MAP[clean]);
      }
    }
  }


  if (found.size === 0) return null;

  const sorted = WEEKDAY_ORDER.filter(d => found.has(d));
  return sorted.join(', ');
}

export function transformProviders(
  providers: GymiProvider[],
  courses: CourseRow[] = []
): TransformedGymiProviders[] {
  return providers.map((provider) => {
    const hasCourses = courses.some(c => c.provider_id === provider.ID);

    return {
      id: provider.ID,
      name: provider.Name,
      pricePerformance: hasCourses
        ? getPriceRange(courses, provider.ID, 'langgymi')
        : provider['Preis Langzeit Kurs'] ?? 'Nicht verfügbar',
      priceIntensiv: hasCourses
        ? getPriceRange(courses, provider.ID, 'kurzgymi')
        : provider['Preis Intensiver Kurs'] ?? 'Nicht verfügbar',
      additionalServices:
        provider['E-Learning'] || provider.Aufsatzkorrektur || provider.Einzelkurse
          ? 'Ja'
          : 'Nein',
      URL: provider.URL ?? [],
      urlLanggymi: hasCourses ? getCourseUrl(courses, provider.ID, 'langgymi') : null,
      urlKurzgymi: hasCourses ? getCourseUrl(courses, provider.ID, 'kurzgymi') : null,
      verfuegbarkeitLanggymi: getVerfuegbarkeit(courses, provider.ID, 'langgymi'),
      verfuegbarkeitKurzgymi: getVerfuegbarkeit(courses, provider.ID, 'kurzgymi'),
      Unterrichttag: getUnterrichtstage(courses, provider.ID, 'langgymi') ?? getUnterrichtstage(courses, provider.ID, 'kurzgymi') ?? null,
      'Maximale Anzahl der Teilnehmer': provider['Maximale Anzahl der Teilnehmer'],
      'E-Learning': provider['E-Learning'],
      Aufsatzkorrektur: provider.Aufsatzkorrektur,
      Einzelkurse: provider.Einzelkurse,
      Einstufungstest: provider.Einstufungstest,
      Onlinepruefung: provider.Onlinepruefung,
      Pruefungssimultaion: provider.Pruefungssimultaion ?? false,
    };
  });
}