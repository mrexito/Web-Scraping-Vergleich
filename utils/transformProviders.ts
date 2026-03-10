import type { GymiProvider } from '@/schemas/gymiProviderSchema';
import type { TransformedGymiProviders } from '@/components/UtilityAnalysisInteraction';

export function transformProviders(providers: GymiProvider[]): TransformedGymiProviders[] {
  return providers.map((provider) => ({
    id: provider.ID,
    name: provider.Name,
    pricePerformance: provider['Preis Langzeit Kurs'] ?? provider['Preis Intensiver Kurs'] ?? 'Nicht verfügbar',
    additionalServices:
      provider['E-Learning'] || provider.Aufsatzkorrektur || provider.Einzelkurse ? 'Ja' : 'Nein',
    URL: provider.URL ?? [],
    'Preis-Kategorie': provider['Preis-Kategorie'],
    'Maximale Anzahl der Teilnehmer': provider['Maximale Anzahl der Teilnehmer'],
    'E-Learning': provider['E-Learning'],
    Aufsatzkorrektur: provider.Aufsatzkorrektur,
    Einzelkurse: provider.Einzelkurse,
    'Intensiver Kurs': provider['Intensiver Kurs'],
    Einstufungstest: provider.Einstufungstest,
    Onlinepruefung: provider.Onlinepruefung,
  }));
}