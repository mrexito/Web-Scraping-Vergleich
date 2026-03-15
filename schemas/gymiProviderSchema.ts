import { z } from 'zod';

export const GymiProviderSchema = z.object({
  ID: z.number().int().positive(),
  Name: z.string().min(1, 'Name darf nicht leer sein'),
  URL: z.array(z.string().url()).nullable().optional(),

  // Preise (Fixpreise je Kurstyp)
  'Preis Intensiver Kurs': z.number().positive().nullable().optional(),
  'Preis Langzeit Kurs': z.number().positive().nullable().optional(),

  // Kursangebot
  Einzelkurse: z.boolean(),
  'E-Learning': z.boolean(),

  // Zusatzleistungen
  Aufsatzkorrektur: z.boolean(),
  Einstufungstest: z.boolean(),
  Onlinepruefung: z.boolean(),
  Pruefungssimultaion: z.boolean().nullable().optional(),

  // Kapazität
  'Maximale Anzahl der Teilnehmer': z.string().nullable().optional(),
});

export type GymiProvider = z.infer<typeof GymiProviderSchema>;

// Preis-Kategorie wird dynamisch berechnet (ersetzt manuell gepflegtes DB-Feld)
export type PreisKategorie = 'A' | 'B' | 'C';

export const getPreisKategorie = (
  preis: number | null | undefined
): PreisKategorie => {
  if (!preis) return 'C';
  if (preis < 2500) return 'A';
  if (preis < 3200) return 'B';
  return 'C';
};

export const parseGymiProvider = (raw: unknown): GymiProvider => {
  const result = GymiProviderSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues
      .map((e) => `[${String(e.path.join('.'))}] ${e.message}`)
      .join(', ');
    throw new Error(`GymiProvider Validierungsfehler: ${messages}`);
  }
  return result.data;
};

export const parseGymiProviders = (rawList: unknown[]): GymiProvider[] => {
  const valid: GymiProvider[] = [];
  for (const raw of rawList) {
    const result = GymiProviderSchema.safeParse(raw);
    if (result.success) {
      valid.push(result.data);
    } else {
      console.warn(
        'Ungültiger GymiProvider übersprungen:',
        result.error.issues
          .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
          .join(', ')
      );
    }
  }
  return valid;
};