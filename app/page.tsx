import UtilityAnalysisInteraction from '../components/UtilityAnalysisInteraction';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import {Database} from "@/database.types";

// Interfaces für GymiProviders
// interface GymiProviders {
//   ID: number;
//   Name: string;
//   "Preis Langzeit Kurs"?: number;
//   "Preis Intensiver Kurs"?: number;
//   "E-Learning"?: boolean;
//   Aufsatzkorrektur?: boolean;
//   Einzelkurse?: boolean;
// }

// Interface für CourseDetails
// interface CourseDetails {
//   ID: number;
//   "Preis pro Woche Langzeitkurs"?: number;
//   "Dauer der Kurse in Wochen Langzeitkurs"?: number;
//   "Eigene Lernunterlagen"?: boolean;
//   "Kursart (Intensiv- oder Langzeitkurs)"?: string;
//   Unterrichttag?: string;
//   Standort?: string;
//   Pruefungsarchiv?: boolean;
//   Beratungsgespraech?: boolean;
//   Qualitaetsbewertung?: number;
//   Nachholmoeglichkeiten?: boolean;
// }

// Typen für GymiProviders und CourseDetails
type GymiProviders = Database['public']['Tables']['GymiProviders']['Row'];
type CourseDetails = Database['public']['Tables']['CourseDetails']['Row'];

const UtilityAnalysis = async () => {
  const supabase = await createServerSupabaseClient();

  // GymiProviders-Daten abrufen
  const { data: GymiProviders, error: errorProviders } = await supabase
    .from("GymiProviders")
    .select(`ID, Name, "Preis Langzeit Kurs", "Preis Intensiver Kurs", "E-Learning", Aufsatzkorrektur, Einzelkurse`) as { data: GymiProviders[]; error: any };

  if (errorProviders) {
    console.error("Error fetching Gymi providers data:", errorProviders);
  }

  // CourseDetails-Daten abrufen
  const { data: CourseDetails, error: errorCourseDetails } = await supabase
    .from("CourseDetails")
    .select(`ID, "Preis pro Woche Langzeitkurs", "Dauer der Kurse in Wochen Langzeitkurs", "Eigene Lernunterlagen", "Kursart (Intensiv- oder Langzeitkurs)", Unterrichttag, Standort, Pruefungsarchiv, Beratungsgespraech, Qualitaetsbewertung, Nachholmoeglichkeiten`) as { data: CourseDetails[]; error: any };

  if (errorCourseDetails) {
    console.error("Error fetching Course details data:", errorCourseDetails);
  }

  // Daten-Transformation für GymiProviders
  const transformedGymiProviders = GymiProviders?.map((provider: GymiProviders) => ({
    id: provider.ID,
    name: provider.Name || 'Name nicht verfügbar',
    pricePerformance: provider["Preis Langzeit Kurs"] || provider["Preis Intensiver Kurs"] || 'Nicht verfügbar',
    additionalServices: provider["E-Learning"] || provider.Aufsatzkorrektur || provider.Einzelkurse ? 'Ja' : 'Nein',
  })) || [];

  return (
    <div className="container mx-auto px-4 sm:px-8">
      <div className="py-8">
        <UtilityAnalysisInteraction GymiProviders={transformedGymiProviders} CourseDetails={CourseDetails || []} />
      </div>
    </div>
  );
};

export default UtilityAnalysis;
