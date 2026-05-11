import {setRequestLocale} from 'next-intl/server';
import {createServerSupabaseClient} from '@/utils/supabase/server';
import {parseGymiProviders, type GymiProvider} from '@/schemas/gymiProviderSchema';
import {parseCourseDetails, type CourseDetail} from '@/schemas/courseDetailSchema';
import {parseCourses, type Course as DbCourse} from '@/schemas/courseSchema';
import {NutzwertanalyseInteractive} from '@/components/lovable/nutzwertanalyse-interactive';

const PRIMARY_SCRAPER_METHOD = 'scrapegraphai' as const;

export default async function NutzwertanalysePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const supabase = await createServerSupabaseClient();

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

  const validProviders: GymiProvider[] = parseGymiProviders(rawProviders ?? []);
  const validCourseDetails: CourseDetail[] = parseCourseDetails(rawCourseDetails ?? []);
  const validCourses: DbCourse[] = parseCourses(rawCourses ?? []);

  return (
    <NutzwertanalyseInteractive
      providers={validProviders}
      courseDetails={validCourseDetails}
      courses={validCourses}
    />
  );
}
