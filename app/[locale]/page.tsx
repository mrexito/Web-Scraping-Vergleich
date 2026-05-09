import { Hero } from '@/components/lovable/hero';
import { ComparisonSection } from '@/components/lovable/comparison-section';
import { adaptProviders, parseWeightsFromString } from '@/utils/adaptProviders';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { parseGymiProviders } from '@/schemas/gymiProviderSchema';
import { parseCourseDetails } from '@/schemas/courseDetailSchema';
import { parseCourses } from '@/schemas/courseSchema';

const PRIMARY_SCRAPER_METHOD = 'scrapegraphai' as const;

const HomePage = async ({ searchParams }: { searchParams: Promise<{ w?: string }> }) => {
  const params = await searchParams;
  const weights = parseWeightsFromString(params.w);

  const supabase = await createServerSupabaseClient();
  const [
    { data: rawProviders },
    { data: rawCourseDetails },
    { data: rawCourses },
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

  const providers = adaptProviders(validProviders, validCourses, validCourseDetails, weights);

  return (
    <>
      <Hero
        providerCount={providers.length}
        courseCount={validCourses.length}
        lastUpdated={new Date()}
      />
      <ComparisonSection providers={providers} />
    </>
  );
};

export default HomePage;
