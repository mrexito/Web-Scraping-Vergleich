import { Hero } from '@/components/lovable/hero';
import { ComparisonSection } from '@/components/lovable/comparison-section';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { parseGymiProviders } from '@/schemas/gymiProviderSchema';
import { parseCourseDetails } from '@/schemas/courseDetailSchema';
import { parseCourses } from '@/schemas/courseSchema';
import { transformProviders } from '@/utils/transformProviders';

const PRIMARY_SCRAPER_METHOD = 'scrapegraphai' as const;

const UtilityAnalysis = async () => {
  const supabase = await createServerSupabaseClient();
  const [
    { data: rawProviders, error: errorProviders },
    { data: rawCourseDetails, error: errorCourseDetails },
    { data: rawCourses, error: errorCourses },
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

  if (errorProviders) console.error('Fehler beim Laden der GymiProviders:', errorProviders);
  if (errorCourseDetails) console.error('Fehler beim Laden der CourseDetails:', errorCourseDetails);
  if (errorCourses) console.error('Fehler beim Laden der Courses:', errorCourses);

  const validProviders = parseGymiProviders(rawProviders ?? []);
  const validCourseDetails = parseCourseDetails(rawCourseDetails ?? []);
  const validCourses = parseCourses(rawCourses ?? []);
  const transformedProviders = transformProviders(validProviders, validCourses, validCourseDetails);

  return (
    <>
      <Hero
        providerCount={transformedProviders.length}
        courseCount={validCourses.length}
        lastUpdated={new Date()}
      />
      <ComparisonSection />
    </>
  );
};

export default UtilityAnalysis;