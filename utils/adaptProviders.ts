import type { GymiProvider } from '@/schemas/gymiProviderSchema';
import type { Course as DbCourse } from '@/schemas/courseSchema';
import type { CourseDetail } from '@/schemas/courseDetailSchema';
import type { Provider, Course as ProviderCourse, Availability } from '@/lib/mock-providers';

// =====================================================================
// TYPES
// =====================================================================

export type CourseTypeFilter = 'langgymi' | 'kurzgymi';

export interface CriteriaWeights {
  price: number;
  quality: number;
  location: number;
  flex: number;
  services: number;
  digital: number;
}

export interface SubScores {
  price: number;       // 0..1
  quality: number;     // 0..1
  location: number;    // 0..1
  flex: number;        // 0..1
  services: number;    // 0..1
  digital: number;     // 0..1
}

// =====================================================================
// DEFAULTS & URL-PARAMETER-PARSER
// =====================================================================

export const DEFAULT_WEIGHTS: CriteriaWeights = {
  price: 17,
  quality: 17,
  location: 16,
  flex: 17,
  services: 17,
  digital: 16,
};

export const DEFAULT_COURSE_TYPE: CourseTypeFilter = 'langgymi';

export function parseWeightsFromString(raw: string | undefined): CriteriaWeights {
  if (!raw) return DEFAULT_WEIGHTS;
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 6 || parts.some((n) => isNaN(n))) return DEFAULT_WEIGHTS;
  return {
    price: parts[0],
    quality: parts[1],
    location: parts[2],
    flex: parts[3],
    services: parts[4],
    digital: parts[5],
  };
}

export function serializeWeights(w: CriteriaWeights): string {
  return [w.price, w.quality, w.location, w.flex, w.services, w.digital].join(',');
}

export function parseCourseTypeFromString(raw: string | undefined): CourseTypeFilter {
  if (raw === 'kurzgymi' || raw === 'langgymi') return raw;
  return DEFAULT_COURSE_TYPE;
}

// =====================================================================
// HILFSFUNKTIONEN
// =====================================================================

function mapAvailability(courses: DbCourse[]): Availability {
  if (courses.some((c) => c.verfuegbarkeit === 'viele')) return 'viele_plaetze';
  if (courses.some((c) => c.verfuegbarkeit === 'wenige')) return 'wenige_plaetze';
  if (courses.some((c) => c.verfuegbarkeit === 'ausgebucht')) return 'ausgebucht';
  return 'viele_plaetze';
}

function uniqueLocations(courses: DbCourse[]): string[] {
  const set = new Set<string>();
  for (const c of courses) {
    if (c.location && !c.location.toLowerCase().includes('absprache')) {
      set.add(c.location);
    }
  }
  return Array.from(set);
}

function uniqueTeachingDays(courses: DbCourse[]): string[] {
  const days = new Set<string>();
  for (const c of courses) {
    if (!c.occurrence) continue;
    const tokens = c.occurrence.split(/[,&\s]+/);
    for (const t of tokens) {
      const clean = t.trim().toLowerCase().replace(/[^a-zäöü]/g, '');
      if (clean.startsWith('mo')) days.add('Mo');
      else if (clean.startsWith('di')) days.add('Di');
      else if (clean.startsWith('mi')) days.add('Mi');
      else if (clean.startsWith('do')) days.add('Do');
      else if (clean.startsWith('fr')) days.add('Fr');
      else if (clean.startsWith('sa')) days.add('Sa');
      else if (clean.startsWith('so')) days.add('So');
    }
  }
  const order = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  return order.filter((d) => days.has(d));
}

// =====================================================================
// KURSTYP-LOGIK
// =====================================================================

/**
 * Liefert den passenden Preis abhängig vom gewählten Kurstyp.
 */
function getProviderPrice(provider: GymiProvider, courseType: CourseTypeFilter): number | null {
  if (courseType === 'langgymi') return provider['Preis Langzeit Kurs'] ?? null;
  return provider['Preis Intensiver Kurs'] ?? null;
}

function filterCoursesByType(courses: DbCourse[], courseType: CourseTypeFilter): DbCourse[] {
  return courses.filter((c) => c.course_type === courseType);
}

/**
 * Prüft, ob ein Anbieter den gewählten Kurstyp anbietet.
 * Quelle: CourseDetails.'Kursart (Intensiv- oder Langzeitkurs)'
 *   - 'Beides'   → bietet beide Typen an
 *   - 'Lang'     → nur Langzeit
 *   - 'Intensiv' → nur Kurzzeit
 *   - null       → unbekannt: defensiv anzeigen
 */
export function offersCourseType(
  detail: CourseDetail | undefined,
  courseType: CourseTypeFilter,
): boolean {
  const kursart = detail?.['Kursart (Intensiv- oder Langzeitkurs)'];
  if (!kursart) return true;
  if (kursart === 'Beides') return true;
  if (courseType === 'langgymi') return kursart === 'Lang';
  return kursart === 'Intensiv';
}

// =====================================================================
// SUB-SCORE-BERECHNUNG (zentrale MCDA-Logik, kurstyp-aware)
// =====================================================================

function calculateSubScores(
  provider: GymiProvider,
  detail: CourseDetail | undefined,
  providerCourses: DbCourse[],
  courseType: CourseTypeFilter,
  priceRangeContext: { minPrice: number; maxPrice: number },
): SubScores {
  // 1. PREIS — kurstyp-aware
  const price = getProviderPrice(provider, courseType);
  let priceScore = 0.5;
  if (price !== null && priceRangeContext.maxPrice > priceRangeContext.minPrice) {
    priceScore =
      1 - (price - priceRangeContext.minPrice) / (priceRangeContext.maxPrice - priceRangeContext.minPrice);
  }

  // 2. QUALITÄT — Q=1 (beste) → 1.0, Q=2 → 0.66, Q=3 → 0.33
  const q = detail?.Qualitaetsbewertung ?? 2;
  const qualityScore = q === 1 ? 1 : q === 2 ? 2 / 3 : 1 / 3;

  // 3. STANDORT — Anzahl unique Locations (max 5 → 1.0)
  const locCount = uniqueLocations(providerCourses).length;
  const locScore = Math.min(1, locCount / 5);

  // 4. FLEXIBILITÄT — online + ausserhalb-Unterstützung + mehrere Wochentage
  const flexBools = [
    providerCourses.some((c) => c.is_online === true),
    detail?.['Unterstuezung ausserhalb Unterrichtszeit'] ?? false,
    uniqueTeachingDays(providerCourses).length >= 3,
  ];
  const flexScore = flexBools.filter(Boolean).length / flexBools.length;

  // 5. SERVICES — 6 Bools (Unterstützung ausserhalb wird in Flex gezählt, nicht hier)
  const serviceBools = [
    provider.Einstufungstest,
    provider.Aufsatzkorrektur,
    provider.Pruefungssimultaion ?? false,
    detail?.Beratungsgespraech ?? false,
    detail?.['Eigene Lernunterlagen'] ?? false,
    detail?.Pruefungsarchiv ?? false,
  ];
  const serviceScore = serviceBools.filter(Boolean).length / serviceBools.length;

  // 6. DIGITAL — E-Learning + Online-Prüfungen
  const digitalBools = [provider['E-Learning'], provider.Onlinepruefung];
  const digitalScore = digitalBools.filter(Boolean).length / digitalBools.length;

  return {
    price: priceScore,
    quality: qualityScore,
    location: locScore,
    flex: flexScore,
    services: serviceScore,
    digital: digitalScore,
  };
}

function applyWeights(sub: SubScores, w: CriteriaWeights): number {
  const totalWeight = w.price + w.quality + w.location + w.flex + w.services + w.digital;
  if (totalWeight === 0) return 0;
  const weighted =
    (w.price / totalWeight) * sub.price +
    (w.quality / totalWeight) * sub.quality +
    (w.location / totalWeight) * sub.location +
    (w.flex / totalWeight) * sub.flex +
    (w.services / totalWeight) * sub.services +
    (w.digital / totalWeight) * sub.digital;
  return Math.round(weighted * 100);
}

/**
 * Liefert die einzelnen GEWICHTETEN Sub-Scores (für Breakdown-Anzeige
 * in der Nutzwertanalyse-Page). Summe ergibt den Gesamt-Score.
 */
export function applyWeightsBreakdown(
  sub: SubScores,
  w: CriteriaWeights,
): {
  price: number;
  quality: number;
  location: number;
  flex: number;
  services: number;
  digital: number;
  total: number;
} {
  const totalWeight = w.price + w.quality + w.location + w.flex + w.services + w.digital;
  if (totalWeight === 0) {
    return { price: 0, quality: 0, location: 0, flex: 0, services: 0, digital: 0, total: 0 };
  }
  const price = Math.round((w.price / totalWeight) * sub.price * 100);
  const quality = Math.round((w.quality / totalWeight) * sub.quality * 100);
  const location = Math.round((w.location / totalWeight) * sub.location * 100);
  const flex = Math.round((w.flex / totalWeight) * sub.flex * 100);
  const services = Math.round((w.services / totalWeight) * sub.services * 100);
  const digital = Math.round((w.digital / totalWeight) * sub.digital * 100);
  const total = price + quality + location + flex + services + digital;
  return { price, quality, location, flex, services, digital, total };
}

// =====================================================================
// EXTENDED PROVIDER-TYP (mit Sub-Scores für Nutzwertanalyse-Page)
// =====================================================================

export interface ProviderWithBreakdown extends Provider {
  subScores: SubScores;
  weightedBreakdown: {
    price: number;
    quality: number;
    location: number;
    flex: number;
    services: number;
    digital: number;
    total: number;
  };
  offersSelectedType: boolean;
}

// =====================================================================
// HAUPT-FUNKTION
// =====================================================================

/**
 * Wandelt rohe Supabase-Daten in UI-Provider um (kurstyp-gefiltert).
 *
 * Anbieter, die den gewählten Typ nicht anbieten, werden ausgeblendet.
 */
export function adaptProviders(
  providers: GymiProvider[],
  courses: DbCourse[],
  courseDetails: CourseDetail[],
  weights: CriteriaWeights = DEFAULT_WEIGHTS,
  courseType: CourseTypeFilter = DEFAULT_COURSE_TYPE,
): ProviderWithBreakdown[] {
  // 1. Anbieter, die den gewählten Typ nicht anbieten, AUSBLENDEN
  const visibleProviders = providers.filter((p) => {
    const detail = courseDetails.find((d) => d.ID === p.ID);
    return offersCourseType(detail, courseType);
  });

  // 2. Preis-Range über die SICHTBAREN Anbieter (für faire Normalisierung)
  const allPrices = visibleProviders
    .map((p) => getProviderPrice(p, courseType))
    .filter((price): price is number => price !== null && price !== undefined);

  const priceCtx = {
    minPrice: allPrices.length ? Math.min(...allPrices) : 0,
    maxPrice: allPrices.length ? Math.max(...allPrices) : 1,
  };

  // 3. Adapter pro Anbieter
  return visibleProviders.map((provider) => {
    const allProviderCourses = courses.filter((c) => c.provider_id === provider.ID);
    const filteredCourses = filterCoursesByType(allProviderCourses, courseType);
    const detail = courseDetails.find((d) => d.ID === provider.ID);

    const sub = calculateSubScores(provider, detail, filteredCourses, courseType, priceCtx);
    const score = applyWeights(sub, weights);
    const breakdown = applyWeightsBreakdown(sub, weights);

    const locations = uniqueLocations(filteredCourses);
    const teachingDays = uniqueTeachingDays(filteredCourses);

    const sampleCourses: ProviderCourse[] = filteredCourses.map((c, i) => ({
      id: `${provider.ID}-${i}`,
      label: c.title ?? `Kurs ${String.fromCharCode(65 + i)}`,
      type: c.course_type === 'kurzgymi' ? 'kurzgymi' : 'langgymi',
      location: c.location ?? '—',
      day: c.occurrence ?? '—',
      time: c.course_time ?? '—',
      startDate: c.start_date ?? '—',
      price: c.price_chf ?? 0,
      originalPrice: c.price_regular_chf ?? undefined,
      discountUntil: c.discount_valid_until ?? undefined,
      availability:
        c.verfuegbarkeit === 'viele'
          ? 'viele_plaetze'
          : c.verfuegbarkeit === 'wenige'
          ? 'wenige_plaetze'
          : c.verfuegbarkeit === 'ausgebucht'
          ? 'ausgebucht'
          : 'viele_plaetze',
    }));

    return {
      id: String(provider.ID),
      name: provider.Name,
      logoUrl: null,
      score,
      price: getProviderPrice(provider, courseType),
      locations: locations.length > 0 ? locations : ['Zürich'],
      teachingDays: teachingDays.length > 0 ? teachingDays : ['—'],
      availability: mapAvailability(filteredCourses),
      quality: (detail?.Qualitaetsbewertung ?? 2) as 1 | 2 | 3,
      maxParticipants: provider['Maximale Anzahl der Teilnehmer'] ?? '—',
      websiteUrl: (provider.URL && provider.URL[0]) || '#',
      hasELearning: provider['E-Learning'],
      hasEinstufungstest: provider.Einstufungstest,
      hasPruefungsarchiv: detail?.Pruefungsarchiv ?? false,
      hasAufsatzkorrektur: provider.Aufsatzkorrektur,
      hasLernunterlagen: detail?.['Eigene Lernunterlagen'] ?? false,
      hasBeratungsgespraech: detail?.Beratungsgespraech ?? false,
      hasDistanceLearning: filteredCourses.some((c) => c.is_online === true),
      hasDigitalMaterials: provider['E-Learning'],
      hasCatchUpOptions: detail?.['Unterstuezung ausserhalb Unterrichtszeit'] ?? false,
      courses: sampleCourses,
      subScores: sub,
      weightedBreakdown: breakdown,
      offersSelectedType: true,
    };
  });
}