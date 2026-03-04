'use client';
import { useState } from 'react';
import {
  calculateAdditionalServices,
  calculateFlexibility,
  calculateLocation,
  calculatePricePerformance,
  calculateQuality
} from '../utils/utilityAnalysis/calculation';
import { checkForm } from '../utils/utilityAnalysis/checkForm';
import GymiProviderOverview, { RatedGymiProviders } from './GymiProviderOverview';
import type { GymiProvider } from '@/schemas/gymiProviderSchema';
import type { CourseDetail } from '@/schemas/courseDetailSchema';

export interface TransformedGymiProviders {
  id: number;
  name: string;
  pricePerformance: string | number;
  additionalServices: string;
  URL?: string[] | null;
  // Felder die calculation.tsx braucht
  'Preis-Kategorie': 'A' | 'B' | 'C';
  'Maximale Anzahl der Teilnehmer'?: string | null;
  'E-Learning': boolean;
  Aufsatzkorrektur: boolean;
  Einzelkurse: boolean;
  'Intensiver Kurs': boolean;
  Einstufungstest: boolean;
  Onlinepruefung: boolean;
}

interface UtilityAnalysisInteractionProps {
  GymiProviders: TransformedGymiProviders[];
  CourseDetails: CourseDetail[];
}

const UtilityAnalysisInteraction = ({ GymiProviders, CourseDetails }: UtilityAnalysisInteractionProps) => {
  const [ratedGymiProviders, setRatedGymiProviders] = useState<RatedGymiProviders[]>([]);
  const [params, setParams] = useState([
    { id: 1, weight: '', criteria: '' },
    { id: 2, weight: '', criteria: '' },
    { id: 3, weight: '', criteria: '' },
    { id: 4, weight: '', criteria: '' },
    { id: 5, weight: '', criteria: '' },
  ]);

  const handleTitleChange = (index: number, newWeight: string) => {
    const updatedParams = [...params];
    updatedParams[index].weight = newWeight;
    setParams(updatedParams);
  };

  const handleContentChange = (index: number, newCriteria: string) => {
    const updatedParams = [...params];
    updatedParams[index].criteria = newCriteria;
    setParams(updatedParams);
  };

  const saveChanges = () => {
    const correctForm = checkForm(params);
    if (correctForm === true) {
      if (GymiProviders && GymiProviders.length > 0) {
        const mappedProviders: RatedGymiProviders[] = GymiProviders.map((provider) => {
          const courseDetail = CourseDetails.find((detail) => detail.ID === provider.id) ?? {};

          const pricePerformance = calculatePricePerformance(provider as unknown as GymiProvider, Number(params.find(p => p.criteria === 'price-performance')?.weight) || 0);
          const quality = calculateQuality(courseDetail, Number(params.find(p => p.criteria === 'quality')?.weight) || 0);
          const flexibility = calculateFlexibility(courseDetail, Number(params.find(p => p.criteria === 'flexibility')?.weight) || 0);
          const additionalServices = calculateAdditionalServices(provider as unknown as GymiProvider, courseDetail, Number(params.find(p => p.criteria === 'additional-services')?.weight) || 0);
          const location = calculateLocation(courseDetail, Number(params.find(p => p.criteria === 'location')?.weight) || 0);

          const totalScore = Math.round(pricePerformance + quality + flexibility + additionalServices + location);

          return {
            id: provider.id,
            provider: provider.name,
            pricePerformance,
            quality,
            flexibility,
            additionalServices,
            location,
            totalScore,
            URL: provider.URL?.length ? provider.URL : []
          };
        });

        const ratedGymiProvidersList = mappedProviders.sort((a, b) => b.totalScore - a.totalScore);
        setRatedGymiProviders(ratedGymiProvidersList);
      } else {
        alert("Keine Daten für Gymi-Anbieter verfügbar.");
      }
    } else {
      alert(correctForm);
    }
  };

  const deleteList = () => {
    setRatedGymiProviders([]);
    setParams([
      { id: 1, weight: '', criteria: '' },
      { id: 2, weight: '', criteria: '' },
      { id: 3, weight: '', criteria: '' },
      { id: 4, weight: '', criteria: '' },
      { id: 5, weight: '', criteria: '' },
    ]);
  };

  return (
    <div>
      {ratedGymiProviders.length === 0 ? (
        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-semibold leading-tight mb-2">
              Nutzwertanalyse
            </h2>
          </div>
          <p>
            Bitte wählen Sie Kriterien, die für die Nutzwertanalyse verwendet
            werden sollen aus. <br />
            Die Kriterien müssen einzeln gewichtet werden. Die Endsumme muss 100% ergeben.
          </p>
          <form>
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
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-5 py-5 border-b border-gray-200 text-sm">
                          <select
                            className="h-full rounded border-gray-300 py-2 px-4 block w-full"
                            value={param.criteria}
                            onChange={(e) => handleContentChange(index, e.target.value)}
                          >
                            <option value="" disabled hidden>Kriterium auswählen</option>
                            <option value="price-performance">Preis-Leistungs-Verhältnis</option>
                            <option value="quality">Qualität des Unterrichts</option>
                            <option value="flexibility">Flexibilität der Kursgestaltung</option>
                            <option value="additional-services">Zusatzleistungen</option>
                            <option value="location">Standort</option>
                          </select>
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 text-sm">
                          <input
                            type="number"
                            placeholder="Gewichtung"
                            value={param.weight}
                            onChange={(e) => handleTitleChange(index, e.target.value)}
                            className="w-full rounded border-gray-300 py-2 px-4"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </form>
          <button
            onClick={saveChanges}
            className="bg-gray-700 text-white font-bold py-2 px-4 rounded mt-4 hover:bg-gray-800"
          >
            Ausrechnen
          </button>
        </div>
      ) : (
        <>
          <button onClick={deleteList} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4">
            Neu ausrechnen
          </button>
          <GymiProviderOverview gymiProviders={ratedGymiProviders} courseDetails={CourseDetails} />
        </>
      )}
    </div>
  );
};

export default UtilityAnalysisInteraction;