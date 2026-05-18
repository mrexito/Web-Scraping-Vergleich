// =====================================================================
// provider-types.ts
// =====================================================================
// Zentrale TypeScript-Typen für die Provider-Domäne des Vergleichsportals.
//
// Diese Typen beschreiben die im UI verwendete Provider-Repräsentation
// (Output von utils/adaptProviders.ts) und werden von allen UI-
// Komponenten konsumiert (ProviderCard, ProviderSheet, CompareView,
// ComparisonSection).
//
// Hinweis: Die Datei hiess ursprünglich `mock-providers.ts` und enthielt
// zusätzlich ein Mock-Dataset für die initiale Entwicklungsphase.
// Sobald der Adapter (utils/adaptProviders.ts) mit echten Supabase-Daten
// arbeitete, wurden die Mocks obsolet — nur die Typen sind erhalten.
// =====================================================================

export type Availability = "viele_plaetze" | "wenige_plaetze" | "ausgebucht";

export interface Course {
  id: string;
  label: string;
  type: "langgymi" | "kurzgymi";
  location: string;
  day: string;
  time: string;
  startDate: string;
  price: number;
  originalPrice?: number;
  discountUntil?: string;
  availability: Availability;
}

export interface Provider {
  id: string;
  name: string;
  shortDescription?: string;
  shortDescriptionEn?: string;
  logoUrl: string | null;
  score: number;
  price: number | null;
  priceRange?: { min: number; max: number };
  originalPrice?: number;
  discountUntil?: string;
  locations: string[];
  teachingDays: string[];
  availability: Availability;
  quality: 1 | 2 | 3;
  maxParticipants: string;
  websiteUrl: string;
  hasELearning: boolean;
  hasEinstufungstest: boolean;
  hasPruefungsarchiv: boolean;
  hasAufsatzkorrektur: boolean;
  hasLernunterlagen: boolean;
  hasBeratungsgespraech: boolean;
  hasDistanceLearning: boolean;
  hasDigitalMaterials: boolean;
  hasCatchUpOptions: boolean;
  courses: Course[];
}