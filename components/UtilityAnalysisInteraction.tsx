'use client';
import { useEffect } from 'react';
import { useScoringStore } from '@/store/scoringStore';
import GymiProviderOverview from './GymiProviderOverview';
import type { CourseDetail } from '@/schemas/courseDetailSchema';

export interface TransformedGymiProviders {
  id: number;
  name: string;
  pricePerformance: string | number;
  additionalServices: string;
  URL?: string[] | null;
  'Preis-Kategorie': 'A' | 'B' | 'C';
  'Maximale Anzahl der Teilnehmer'?: string | null;
  'E-Learning': boolean;
  Aufsatzkorrektur: boolean;
  Einzelkurse: boolean;
  'Intensiver Kurs': boolean;
  Einstufungstest: boolean;
  Onlinepruefung: boolean;
}

interface Props {
  GymiProviders: TransformedGymiProviders[];
  CourseDetails: CourseDetail[];
}

const CRITERIA_OPTIONS = [
  { value: 'price-performance', label: 'Preis-Leistungs-Verhältnis' },
  { value: 'quality', label: 'Qualität des Unterrichts' },
  { value: 'flexibility', label: 'Flexibilität der Kursgestaltung' },
  { value: 'additional-services', label: 'Zusatzleistungen' },
  { value: 'location', label: 'Standort' },
];

export default function UtilityAnalysisInteraction({ GymiProviders, CourseDetails }: Props) {
  const { params, ratedProviders, setProviders, setCourseDetails, updateParam, calculate, reset } = useScoringStore();

  useEffect(() => {
    setProviders(GymiProviders);
    setCourseDetails(CourseDetails);
  }, []);

  const handleCalculate = () => {
    const result = calculate();
    if (result !== true) alert(result);
  };

  if (ratedProviders.length > 0) {
    return (
      <>
        <button onClick={reset} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4">
          Neu ausrechnen
        </button>
        <GymiProviderOverview gymiProviders={ratedProviders} courseDetails={CourseDetails} />
      </>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-semibold leading-tight mb-2">Nutzwertanalyse</h2>
      </div>
      <p>
        Bitte wählen Sie Kriterien aus. Die Endsumme muss 100% ergeben.
      </p>
      <div className="-mx-4 sm:-mx-8 px-4 sm:px-8 py-4 overflow-x-auto">
        <div className="inline-block min-w-full shadow rounded-lg overflow-hidden">
          <table className="min-w-full leading-normal border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Kriterien
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Gewichtung (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {params.map((param, index) => (
                <tr key={param.id} className="hover:bg-gray-50">
                  <td className="px-5 py-5 border-b border-gray-200 text-sm">
                    <select
                      className="h-full rounded border-gray-300 py-2 px-4 block w-full"
                      value={param.criteria}
                      onChange={(e) => updateParam(index, 'criteria', e.target.value)}
                    >
                      <option value="" disabled hidden>Kriterium auswählen</option>
                      {CRITERIA_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 text-sm">
                    <input
                      type="number"
                      placeholder="Gewichtung"
                      value={param.weight}
                      onChange={(e) => updateParam(index, 'weight', e.target.value)}
                      className="w-full rounded border-gray-300 py-2 px-4"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button onClick={handleCalculate} className="bg-gray-700 text-white font-bold py-2 px-4 rounded mt-4 hover:bg-gray-800">
        Ausrechnen
      </button>
    </div>
  );
}