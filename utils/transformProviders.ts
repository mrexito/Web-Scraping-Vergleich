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
  // Einzelkurse ausschliessen über Standort "absprache" (gilt für alle Provider)
  const grouped = courses.filter(
    c => c.provider_id === providerId &&
    c.course_type === courseType &&
    !c.location?.toLowerCase().includes('absprache')
  );

  // Falls keine Gruppenkurse gefunden, alle Kurse verwenden
  const relevant = grouped.length > 0
    ? grouped
    : courses.filter(c => c.provider_id === providerId && c.course_type === courseType);

  if (relevant.length === 0) return null;

  // Schlechtesten Wert nehmen: ausgebucht > wenige > viele
  if (relevant.some(c => c.verfuegbarkeit === 'ausgebucht')) return 'Einige Kurse ausgebucht';
  if (relevant.some(c => c.verfuegbarkeit === 'wenige')) return 'Wenige Plätze verfügbar';
  if (relevant.some(c => c.verfuegbarkeit === 'viele')) return 'Viele Plätze verfügbar';
  return null;
}

function getCourseUrl(courses: CourseRow[], providerId: number, courseType: string): string | null {
  const course = courses.find(
    c => c.provider_id === providerId && c.course_type === courseType && c.course_url
  );
  return course?.course_url ?? null;
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