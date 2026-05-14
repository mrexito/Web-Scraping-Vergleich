import {setRequestLocale} from 'next-intl/server';
import {getTranslations} from 'next-intl/server';
import {createServerSupabaseClient} from '@/utils/supabase/server';
import {parseGymiProviders} from '@/schemas/gymiProviderSchema';
import {parseCourseDetails} from '@/schemas/courseDetailSchema';
import {parseCourses} from '@/schemas/courseSchema';
import {adaptProviders, DEFAULT_WEIGHTS} from '@/utils/adaptProviders';
import {CompareView} from '@/components/lovable/compare-view';
import {PageShell} from '@/components/lovable/page-shell';

const PRIMARY_SCRAPER_METHOD = 'scrapegraphai' as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'compareSelect'});

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: 'compareSelect'});

  const supabase = await createServerSupabaseClient();

  // Alle Provider-Daten laden (Client filtert dann nach Auswahl)
  const [
    {data: rawProviders},
    {data: rawCourseDetails},
    {data: rawCourses},
  ] = await Promise.all([
    supabase
      .from('GymiProviders')
      .select(
        `ID, Name,
         "Preis Langzeit Kurs", "Preis Intensiver Kurs",
         "E-Learning", Aufsatzkorrektur, Einzelkurse, URL,
         "Maximale Anzahl der Teilnehmer",
         Einstufungstest, Onlinepruefung, Pruefungssimultaion`
      ),
    supabase
      .from('CourseDetails')
      .select(
        `ID,
         "Kursart (Intensiv- oder Langzeitkurs)",
         "Dauer der Kurse in Wochen Langzeitkurs",
         "Dauer der Kurse in Std. Kurzzeitkurs",
         "Eigene Lernunterlagen",
         Unterrichttag, Standort, Pruefungsarchiv, Beratungsgespraech,
         Qualitaetsbewertung,
         "info freien Plaetze?",
         "Unterstuezung ausserhalb Unterrichtszeit", Spezielles`
      ),
    supabase
      .from('courses')
      .select(
        `provider_id, title, price_chf, price_regular_chf, discount_valid_until,
         course_type, location, occurrence, course_time, start_date, end_date,
         verfuegbarkeit, is_online, course_url`
      )
      .eq('scraper_method', PRIMARY_SCRAPER_METHOD),
  ]);

  const validProviders = parseGymiProviders(rawProviders ?? []);
  const validCourseDetails = parseCourseDetails(rawCourseDetails ?? []);
  const validCourses = parseCourses(rawCourses ?? []);

  // Alle Provider laden mit Default-Gewichten
  // (Compare-Seite zeigt absolute Werte, kein gewichtetes Ranking)
  const allProviders = adaptProviders(
    validProviders,
    validCourses,
    validCourseDetails,
    DEFAULT_WEIGHTS,
    'langgymi',
  );

  return (
    <PageShell title={t('title')} subtitle={t('subtitle')}>
      <CompareView allProviders={allProviders} />
    </PageShell>
  );
}