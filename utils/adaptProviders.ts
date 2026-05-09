import type { GymiProvider } from '@/schemas/gymiProviderSchema';
import type { Course as DbCourse } from '@/schemas/courseSchema';
import type { CourseDetail } from '@/schemas/courseDetailSchema';
import type { Provider, Course as ProviderCourse, Availability } from '@/lib/mock-providers';

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

function calculateScore(
  provider: GymiProvider,
  detail: CourseDetail | undefined,
  providerCourses: DbCourse[],
  priceRangeContext: { minPrice: number; maxPrice: number },
): number {
  const price = provider['Preis Langzeit Kurs'] ?? provider['Preis Intensiver Kurs'] ?? null;
  let priceScore = 0.5;
  if (price !== null && priceRangeContext.maxPrice > priceRangeContext.minPrice) {
    priceScore = 1 - (price - priceRangeContext.minPrice) / (priceRangeContext.maxPrice - priceRangeContext.minPrice);
  }

  const qualityScore = (detail?.Qualitaetsbewertung ?? 2) / 3;

  const locCount = uniqueLocations(providerCourses).length;
  const locScore = Math.min(1, locCount / 5);

  const hasFlexBools = [
    providerCourses.some((c) => c.is_online === true),
    detail?.['Unterstuezung ausserhalb Unterrichtszeit'] ?? false,
  ];
  const flexScore = hasFlexBools.filter(Boolean).length / hasFlexBools.length;

  const hasServiceBools = [
    provider.Einstufungstest,
    provider.Aufsatzkorrektur,
    detail?.Beratungsgespraech ?? false,
    detail?.['Eigene Lernunterlagen'] ?? false,
    detail?.Pruefungsarchiv ?? false,
  ];
  const serviceScore = hasServiceBools.filter(Boolean).length / hasServiceBools.length;

  const hasDigitalBools = [provider['E-Learning'], provider.Onlinepruefung];
  const digitalScore = hasDigitalBools.filter(Boolean).length / hasDigitalBools.length;

  const total =
    0.20 * priceScore +
    0.20 * qualityScore +
    0.15 * locScore +
    0.15 * flexScore +
    0.15 * serviceScore +
    0.15 * digitalScore;

  return Math.round(total * 100);
}

export function adaptProviders(
  providers: GymiProvider[],
  courses: DbCourse[],
  courseDetails: CourseDetail[],
): Provider[] {
  const allPrices = providers
    .map((p) => p['Preis Langzeit Kurs'] ?? p['Preis Intensiver Kurs'])
    .filter((p): p is number => p !== null && p !== undefined);
  const priceCtx = {
    minPrice: allPrices.length ? Math.min(...allPrices) : 0,
    maxPrice: allPrices.length ? Math.max(...allPrices) : 1,
  };

  return providers.map((provider) => {
    const providerCourses = courses.filter((c) => c.provider_id === provider.ID);
    const detail = courseDetails.find((d) => d.ID === provider.ID);

    const locations = uniqueLocations(providerCourses);
    const teachingDays = uniqueTeachingDays(providerCourses);

    const sampleCourses: ProviderCourse[] = providerCourses.slice(0, 3).map((c, i) => ({
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
        c.verfuegbarkeit === 'viele' ? 'viele_plaetze'
        : c.verfuegbarkeit === 'wenige' ? 'wenige_plaetze'
        : c.verfuegbarkeit === 'ausgebucht' ? 'ausgebucht'
        : 'viele_plaetze',
    }));

    const score = calculateScore(provider, detail, providerCourses, priceCtx);

    return {
      id: String(provider.ID),
      name: provider.Name,
      shortDescription: `Gymi-Vorbereitungsanbieter im Kanton Zürich mit ${locations.length || 'mehreren'} Standorten.`,
      shortDescriptionEn: `Gymi prep provider in Canton Zürich with ${locations.length || 'multiple'} locations.`,
      logoUrl: null,
      score,
      price: provider['Preis Langzeit Kurs'] ?? provider['Preis Intensiver Kurs'] ?? null,
      locations: locations.length > 0 ? locations : ['Zürich'],
      teachingDays: teachingDays.length > 0 ? teachingDays : ['—'],
      availability: mapAvailability(providerCourses),
      quality: (detail?.Qualitaetsbewertung ?? 2) as 1 | 2 | 3,
      maxParticipants: provider['Maximale Anzahl der Teilnehmer'] ?? '—',
      websiteUrl: (provider.URL && provider.URL[0]) || '#',
      hasELearning: provider['E-Learning'],
      hasEinstufungstest: provider.Einstufungstest,
      hasPruefungsarchiv: detail?.Pruefungsarchiv ?? false,
      hasAufsatzkorrektur: provider.Aufsatzkorrektur,
      hasLernunterlagen: detail?.['Eigene Lernunterlagen'] ?? false,
      hasBeratungsgespraech: detail?.Beratungsgespraech ?? false,
      hasDistanceLearning: providerCourses.some((c) => c.is_online === true),
      hasDigitalMaterials: provider['E-Learning'],
      hasCatchUpOptions: detail?.['Unterstuezung ausserhalb Unterrichtszeit'] ?? false,
      courses: sampleCourses,
    };
  });
}
