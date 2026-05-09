import {setRequestLocale} from 'next-intl/server';
import {Hero} from '@/components/lovable/hero';
import {ComparisonSection} from '@/components/lovable/comparison-section';
import {ZapTimeline} from '@/components/lovable/zap-timeline';
import {adaptProviders, parseWeightsFromString} from '@/utils/adaptProviders';
import {createServerSupabaseClient} from '@/utils/supabase/server';
import {parseGymiProviders} from '@/schemas/gymiProviderSchema';
import {parseCourseDetails} from '@/schemas/courseDetailSchema';
import {parseCourses} from '@/schemas/courseSchema';
import {parseZapInfos} from '@/schemas/zapInfoSchema';

const PRIMARY_SCRAPER_METHOD = 'scrapegraphai' as const;

function formatDate(dateString: string | null | undefined, locale: string): string | null {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  const dateLocale = locale === 'en' ? 'en-GB' : 'de-CH';
  return d.toLocaleDateString(dateLocale, {day: '2-digit', month: 'long', year: 'numeric'});
}

const HomePage = async ({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{w?: string}>;
}) => {
  const {locale} = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const weights = parseWeightsFromString(sp.w);

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    {data: rawProviders},
    {data: rawCourseDetails},
    {data: rawCourses},
    {data: rawNextZap},
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
    supabase
      .from('zap_info')
      .select('*')
      .gte('exam_date', today)
      .order('exam_date', {ascending: true})
      .limit(1),
  ]);

  const validProviders = parseGymiProviders(rawProviders ?? []);
  const validCourseDetails = parseCourseDetails(rawCourseDetails ?? []);
  const validCourses = parseCourses(rawCourses ?? []);
  const nextZap = parseZapInfos(rawNextZap ?? []);

  const providers = adaptProviders(validProviders, validCourses, validCourseDetails, weights);
  const nextExamDate = nextZap[0]?.exam_date
    ? formatDate(nextZap[0].exam_date, locale)
    : null;

  return (
    <>
      <Hero
        providerCount={providers.length}
        courseCount={validCourses.length}
        lastUpdated={new Date()}
        nextExamDate={nextExamDate}
      />
      <ComparisonSection providers={providers} />
      <ZapTimeline locale={locale} />
    </>
  );
};

export default HomePage;
