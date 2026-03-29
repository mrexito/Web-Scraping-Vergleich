import type { CourseDetail } from '@/schemas/courseDetailSchema';
import { getPreisKategorie } from '@/schemas/gymiProviderSchema';

export type Kurstyp = 'langgymi' | 'kurzgymi';

// 1. Preis-Leistungs-Verhältnis
// FIX: nimmt neu direkt preis + maxTeilnehmer statt GymiProvider
// So wird der dynamische Preis aus courses verwendet
export const calculatePricePerformance = (
  preis: string | number | null,
  maxTeilnehmer: string | null | undefined,
  weight: number
): number => {
  let score = 0;

  // Preis aus courses kann ein String sein (z.B. "CHF 3290 – 3490")
  // Wir nehmen den tiefsten Wert für die Kategorie
  let preisNum: number | null = null;
  if (typeof preis === 'number') {
    preisNum = preis;
  } else if (typeof preis === 'string') {
    const match = preis.replace(/['\s]/g, '').match(/\d+/);
    if (match) preisNum = parseInt(match[0], 10);
  }

  const kategorie = getPreisKategorie(preisNum);
  if (kategorie === 'A') score += 3;
  else if (kategorie === 'B') score += 2;
  else score += 1;

  const maxParticipants = parseInt(maxTeilnehmer ?? '0', 10);
  if (maxParticipants >= 1 && maxParticipants <= 5) score += 3;
  else if (maxParticipants >= 6 && maxParticipants <= 10) score += 2;
  else if (maxParticipants >= 11 && maxParticipants <= 15) score += 1;

  // Score-Range: 2–6 → normalisieren auf 1–3
  const normalized = score >= 5 ? 3 : score >= 3 ? 2 : 1;
  return Math.round((normalized / 3) * weight);
};

// 2. Qualität des Unterrichts
export const calculateQuality = (
  courseDetail: Partial<CourseDetail>,
  weight: number
): number => {
  let score = 0;

  if (courseDetail.Qualitaetsbewertung === 1) score = 3;
  else if (courseDetail.Qualitaetsbewertung === 2) score = 2;
  else if (courseDetail.Qualitaetsbewertung === 3) score = 1;

  return Math.round((score / 3) * weight);
};

// 3. Flexibilität der Kursgestaltung
export const calculateFlexibility = (
  courseDetail: Partial<CourseDetail>,
  weight: number,
  kurstyp: Kurstyp
): number => {
  let score = 0;

  const unterrichttag = courseDetail['Unterrichttag'];
  const days = Array.isArray(unterrichttag)
    ? unterrichttag.length
    : unterrichttag
    ? unterrichttag.split(',').length
    : 0;

  if (days >= 4) score += 3;
  else if (days === 3) score += 2;
  else if (days >= 1) score += 1;

  // Anbieter die beide Kurstypen anbieten bekommen Bonus
  const kursart = courseDetail['Kursart (Intensiv- oder Langzeitkurs)'];
  if (kursart === 'Beides') score += 2;
  else if (
    (kurstyp === 'langgymi' && kursart === 'Lang') ||
    (kurstyp === 'kurzgymi' && kursart === 'Intensiv')
  ) {
    score += 1;
  }

  const normalized = score >= 4 ? 3 : score >= 2 ? 2 : 1;
  return Math.round((normalized / 3) * weight);
};

// 4. Zusatzleistungen
// FIX: 7 Kriterien gezählt (war vorher 6, Einstufungstest fehlte)
export const calculateAdditionalServices = (
  provider: {
    'E-Learning': boolean;
    Aufsatzkorrektur: boolean;
    Pruefungssimultaion?: boolean | null;
    Einstufungstest: boolean;  // NEU
  },
  courseDetail: Partial<CourseDetail>,
  weight: number
): number => {
  let score = 0;

  if (provider['E-Learning']) score++;
  if (courseDetail['Eigene Lernunterlagen']) score++;
  if (courseDetail['Unterstuezung ausserhalb Unterrichtszeit']) score++;
  if (courseDetail['Pruefungsarchiv']) score++;
  if (provider.Aufsatzkorrektur) score++;
  if (provider.Pruefungssimultaion) score++;
  if (provider.Einstufungstest) score++;  // NEU: war vorher vergessen

  // Score 0–7 → 3 Stufen
  const normalized = score >= 5 ? 3 : score >= 3 ? 2 : 1;
  return Math.round((normalized / 3) * weight);
};

// 5. Standort
export const calculateLocation = (
  courseDetail: Partial<CourseDetail>,
  weight: number
): number => {
  const standort = courseDetail['Standort'];
  const locations = Array.isArray(standort)
    ? standort.length
    : standort
    ? standort.split(',').length
    : 0;

  let score = 0;
  if (locations >= 4) score = 3;
  else if (locations === 3) score = 2;
  else if (locations >= 1) score = 1;

  return Math.round((score / 3) * weight);
};
