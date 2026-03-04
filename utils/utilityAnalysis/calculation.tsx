// utils/utilityAnalysis/calculation.tsx
import type { GymiProvider } from '@/schemas/gymiProviderSchema';
import type { CourseDetail } from '@/schemas/courseDetailSchema';

// 1. Preis-Leistungs-Verhältnis
export const calculatePricePerformance = (provider: GymiProvider, weight: number): number => {
  let score = 0;

  if (provider['Preis-Kategorie'] === 'A') score += 3;
  else if (provider['Preis-Kategorie'] === 'B') score += 2;
  else if (provider['Preis-Kategorie'] === 'C') score += 1;

  const maxParticipants = parseInt(provider['Maximale Anzahl der Teilnehmer'] ?? '0', 10);
  if (maxParticipants >= 1 && maxParticipants <= 5) score += 3;
  else if (maxParticipants >= 6 && maxParticipants <= 10) score += 2;
  else if (maxParticipants >= 11 && maxParticipants <= 15) score += 1;

  const normalized = score >= 5 ? 3 : score >= 3 ? 2 : 1;
  return Math.round((normalized / 3) * weight);
};

// 2. Qualität des Unterrichts
export const calculateQuality = (courseDetail: Partial<CourseDetail>, weight: number): number => {
  let score = 0;

  if (courseDetail.Qualitaetsbewertung === 1) score = 3;
  else if (courseDetail.Qualitaetsbewertung === 2) score = 2;
  else if (courseDetail.Qualitaetsbewertung === 3) score = 1;

  return Math.round((score / 3) * weight);
};

// 3. Flexibilität der Kursgestaltung
export const calculateFlexibility = (courseDetail: Partial<CourseDetail>, weight: number): number => {
  let score = 0;

  const unterrichttag = courseDetail['Unterrichttag'];
  const days = Array.isArray(unterrichttag)
    ? unterrichttag.length
    : unterrichttag
    ? unterrichttag.split(',').length
    : 0;

  if (days === 4) score += 3;
  else if (days === 3) score += 2;
  else if (days >= 1) score += 1;

  if (courseDetail['Kursart (Intensiv- oder Langzeitkurs)'] === 'Beides') score += 2;
  else if (courseDetail['Kursart (Intensiv- oder Langzeitkurs)'] === 'Lang') score += 1;

  const normalized = score >= 4 ? 3 : score === 3 ? 2 : 1;
  return Math.round((normalized / 3) * weight);
};

// 4. Zusatzleistungen
export const calculateAdditionalServices = (
  provider: GymiProvider,
  courseDetail: Partial<CourseDetail>,
  weight: number
): number => {
  let score = 0;

  score += provider['E-Learning'] ? 2 : 1;
  score += courseDetail['Eigene Lernunterlagen'] ? 2 : 1;
  score += courseDetail['Nachholmoeglichkeiten'] ? 2 : 1;
  score += courseDetail['Unterstuezung ausserhalb Unterrichtszeit'] ? 2 : 1;
  score += courseDetail['Pruefungsarchiv'] ? 2 : 1;
  score += provider.Aufsatzkorrektur ? 2 : 1;

  const normalized = score >= 5 ? 3 : score >= 3 ? 2 : 1;
  return Math.round((normalized / 3) * weight);
};

// 5. Standort
export const calculateLocation = (courseDetail: Partial<CourseDetail>, weight: number): number => {
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
