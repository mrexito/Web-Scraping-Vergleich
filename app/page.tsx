import UtilityAnalysisInteraction from '../components/UtilityAnalysisInteraction';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { parseGymiProviders } from '@/schemas/gymiProviderSchema';
import { parseCourseDetails } from '@/schemas/courseDetailSchema';
import { transformProviders } from '@/utils/transformProviders';

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
         Qualitaetsbewertung, Nachholmoeglichkeiten,
         "info freien Plaetze?", "Info zur Erfolgsquote",
         "Unterstuezung ausserhalb Unterrichtszeit", Spezielles`
      ),
    supabase
      .from('courses')
      .select(
        `provider_id, price_chf, course_type, location,
         occurrence, start_date, verfuegbarkeit, is_online, course_url`
      ),
  ]);

  if (errorProviders) console.error('Fehler beim Laden der GymiProviders:', errorProviders);
  if (errorCourseDetails) console.error('Fehler beim Laden der CourseDetails:', errorCourseDetails);
  if (errorCourses) console.error('Fehler beim Laden der Courses:', errorCourses);

  const validProviders = parseGymiProviders(rawProviders ?? []);
  const validCourseDetails = parseCourseDetails(rawCourseDetails ?? []);
  const transformedProviders = transformProviders(validProviders, rawCourses ?? []);

  return (
    <div className="container mx-auto px-4 sm:px-8">
      <div className="py-8">
        <UtilityAnalysisInteraction
          GymiProviders={transformedProviders}
          CourseDetails={validCourseDetails}
        />
      </div>
    </div>
  );
};

export default UtilityAnalysis;