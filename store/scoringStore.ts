import { create } from 'zustand';
import {
  calculateAdditionalServices,
  calculateFlexibility,
  calculateLocation,
  calculatePricePerformance,
  calculateQuality,
  type Kurstyp,
} from '@/utils/utilityAnalysis/calculation';
import { checkForm } from '@/utils/utilityAnalysis/checkForm';
import type { GymiProvider } from '@/schemas/gymiProviderSchema';
import type { CourseDetail } from '@/schemas/courseDetailSchema';
import type { TransformedGymiProviders } from '@/components/UtilityAnalysisInteraction';
import type { RatedGymiProviders } from '@/components/GymiProviderOverview';

export interface ScoringParam {
  id: number;
  weight: string;
  criteria: string;
}

interface ScoringStore {
  params: ScoringParam[];
  kurstyp: Kurstyp;
  ratedProviders: RatedGymiProviders[];
  providers: TransformedGymiProviders[];
  courseDetails: CourseDetail[];

  setProviders: (p: TransformedGymiProviders[]) => void;
  setCourseDetails: (d: CourseDetail[]) => void;
  setKurstyp: (k: Kurstyp) => void;
  updateParam: (index: number, field: 'weight' | 'criteria', value: string) => void;
  calculate: () => string | true;
  reset: () => void;
}

const initialParams: ScoringParam[] = [
  { id: 1, weight: '', criteria: '' },
  { id: 2, weight: '', criteria: '' },
  { id: 3, weight: '', criteria: '' },
  { id: 4, weight: '', criteria: '' },
  { id: 5, weight: '', criteria: '' },
];

export const useScoringStore = create<ScoringStore>((set, get) => ({
  params: initialParams,
  kurstyp: 'langgymi',
  ratedProviders: [],
  providers: [],
  courseDetails: [],

  setProviders: (p) => set({ providers: p }),
  setCourseDetails: (d) => set({ courseDetails: d }),
  setKurstyp: (k) => set({ kurstyp: k, ratedProviders: [] }),

  updateParam: (index, field, value) => {
    const updated = [...get().params];
    updated[index] = { ...updated[index], [field]: value };
    set({ params: updated });
  },

  calculate: () => {
    const { params, providers, courseDetails, kurstyp } = get();
    const valid = checkForm(params);
    if (valid !== true) return valid;
    if (!providers.length) return 'Keine Anbieterdaten verfügbar.';

    const getWeight = (criteria: string) =>
      Number(params.find((p) => p.criteria === criteria)?.weight) || 0;

    const rated: RatedGymiProviders[] = providers
      .filter((provider) => {
        const detail = courseDetails.find((d) => d.ID === provider.id);
        const kursart = detail?.['Kursart (Intensiv- oder Langzeitkurs)'];
        if (!kursart || kursart === 'Beides') return true;
        if (kurstyp === 'langgymi') return kursart === 'Lang';
        if (kurstyp === 'kurzgymi') return kursart === 'Intensiv';
        return true;
      })
      .map((provider) => {
        const detail = courseDetails.find((d) => d.ID === provider.id) ?? {};
        const pp = calculatePricePerformance(
          provider as unknown as GymiProvider,
          getWeight('price-performance'),
          kurstyp
        );
        const q = calculateQuality(detail, getWeight('quality'));
        const f = calculateFlexibility(detail, getWeight('flexibility'), kurstyp);
        const as = calculateAdditionalServices(
          provider as unknown as GymiProvider,
          detail,
          getWeight('additional-services')
        );
        const l = calculateLocation(detail, getWeight('location'));

        const preis =
          kurstyp === 'langgymi'
            ? provider.pricePerformance
            : provider.priceIntensiv;

        return {
          id: provider.id,
          provider: provider.name,
          pricePerformance: pp,
          quality: q,
          flexibility: f,
          additionalServices: as,
          location: l,
          totalScore: Math.round(pp + q + f + as + l),
          URL: provider.URL?.length ? provider.URL : [],
          urlLanggymi: provider.urlLanggymi ?? null,
          urlKurzgymi: provider.urlKurzgymi ?? null,
          verfuegbarkeitLanggymi: provider.verfuegbarkeitLanggymi ?? null,
          verfuegbarkeitKurzgymi: provider.verfuegbarkeitKurzgymi ?? null,
          'E-Learning': provider['E-Learning'],
          Aufsatzkorrektur: provider.Aufsatzkorrektur,
          Einstufungstest: provider.Einstufungstest,
          'Maximale Anzahl der Teilnehmer': provider['Maximale Anzahl der Teilnehmer'],
          rawPrice: preis,
          kurstyp,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);

    set({ ratedProviders: rated });
    return true;
  },

  reset: () => set({ params: initialParams, ratedProviders: [] }),
}));