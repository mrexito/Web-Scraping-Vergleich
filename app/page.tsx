import UtilityAnalysisInteraction from '../components/UtilityAnalysisInteraction';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { parseGymiProviders } from '@/schemas/gymiProviderSchema';
import { parseCourseDetails } from '@/schemas/courseDetailSchema';
import { transformProviders } from '@/utils/transformProviders';

const UtilityAnalysis = async () => {
  const supabase = await createServerSupabaseClient();

  const { data: rawProviders, error: errorProviders } = await supabase
    .from('GymiProviders')
    .select(
      `ID, Name, "Preis Langzeit Kurs", "Preis Intensiver Kurs", "Preis-Kategorie",
       "E-Learning", Aufsatzkorrektur, Einzelkurse, URL,
       "Maximale Anzahl der Teilnehmer", "Intensiver Kurs",
       Mathematik, Deutsch, Franzoesisch, Einstufungstest,
       Onlinepruefung, Mitarbeiter, Pruefungssimultaion`
    );

  if (errorProviders) {
    console.error('Fehler beim Laden der GymiProviders:', errorProviders);
  }

  const { data: rawCourseDetails, error: errorCourseDetails } = await supabase
    .from('CourseDetails')
    .select(
      `ID, "Preis pro Woche Langzeitkurs", "Dauer der Kurse in Wochen Langzeitkurs",
       "Eigene Lernunterlagen", "Kursart (Intensiv- oder Langzeitkurs)",
       Unterrichttag, Standort, Pruefungsarchiv, Beratungsgespraech,
       Qualitaetsbewertung, Nachholmoeglichkeiten, Experten, FAQ,
       "info freien Plaetze?", "Info zur Erfolgsquote",
       "Unterstuezung ausserhalb Unterrichtszeit", Spezielles,
       "Dauer der Kurse in Std. Kurzzeitkurs", "Preis pro Std. Intensiverkurs"`
    );

  if (errorCourseDetails) {
    console.error('Fehler beim Laden der CourseDetails:', errorCourseDetails);
  }

  const validProviders = parseGymiProviders(rawProviders ?? []);
  const validCourseDetails = parseCourseDetails(rawCourseDetails ?? []);
  const transformedProviders = transformProviders(validProviders);

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