import { z } from 'zod';

export const GymiProviderSchema = z.object({
  ID: z.number().int().positive(),
  Name: z.string().min(1, 'Name darf nicht leer sein'),
  URL: z.array(z.string().url()).nullable().optional(),

  'Intensiver Kurs': z.boolean(),
  Einzelkurse: z.boolean(),
  'E-Learning': z.boolean(),

  Mathematik: z.boolean().nullable().optional(),
  Deutsch: z.boolean().nullable().optional(),
  Franzoesisch: z.boolean().nullable().optional(),

  'Preis Intensiver Kurs': z.number().positive().nullable().optional(),
  'Preis Langzeit Kurs': z.number().positive().nullable().optional(),
  'Preis-Kategorie': z.enum(['A', 'B', 'C']),

  Aufsatzkorrektur: z.boolean(),
  Einstufungstest: z.boolean(),
  Onlinepruefung: z.boolean(),
  Pruefungssimultaion: z.boolean().nullable().optional(),

  'Maximale Anzahl der Teilnehmer': z.string().nullable().optional(),
  Mitarbeiter: z.number().int().positive().nullable().optional(),
});

export type GymiProvider = z.infer<typeof GymiProviderSchema>;

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