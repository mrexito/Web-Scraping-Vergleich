import type { GymiProvider } from '@/schemas/gymiProviderSchema';
import type { TransformedGymiProviders } from '@/components/UtilityAnalysisInteraction';

export function transformProviders(providers: GymiProvider[]): TransformedGymiProviders[] {
  return providers.map((provider) => ({
    id: provider.ID,
    name: provider.Name,
    // Beide Preise weitergeben — Store wählt je nach Kurstyp den richtigen
    pricePerformance: provider['Preis Langzeit Kurs'] ?? 'Nicht verfügbar',
    priceIntensiv: provider['Preis Intensiver Kurs'] ?? 'Nicht verfügbar',
    additionalServices:
      provider['E-Learning'] || provider.Aufsatzkorrektur || provider.Einzelkurse
        ? 'Ja'
        : 'Nein',
    URL: provider.URL ?? [],
    'Maximale Anzahl der Teilnehmer': provider['Maximale Anzahl der Teilnehmer'],
    'E-Learning': provider['E-Learning'],
    Aufsatzkorrektur: provider.Aufsatzkorrektur,
    Einzelkurse: provider.Einzelkurse,
    Einstufungstest: provider.Einstufungstest,
    Onlinepruefung: provider.Onlinepruefung,
    Pruefungssimultaion: provider.Pruefungssimultaion ?? false,
  }));
}