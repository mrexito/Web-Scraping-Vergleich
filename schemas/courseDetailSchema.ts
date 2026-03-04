import { z } from 'zod';

export const CourseDetailSchema = z.object({
  ID: z.number().int().positive(),

  'Kursart (Intensiv- oder Langzeitkurs)': z
    .enum(['Intensiv', 'Lang', 'Beides'])
    .nullable()
    .optional(),
  Unterrichttag: z.string().nullable().optional(),
  'Dauer der Kurse in Std. Kurzzeitkurs': z.number().nonnegative().nullable().optional(),
  'Dauer der Kurse in Wochen Langzeitkurs': z.number().positive().nullable().optional(),

  'Preis pro Std. Intensiverkurs': z.number().nonnegative().nullable().optional(),
  'Preis pro Woche Langzeitkurs': z.number().positive().nullable().optional(),

  Standort: z.string().nullable().optional(),

  Qualitaetsbewertung: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),

  Beratungsgespraech: z.boolean(),
  'Eigene Lernunterlagen': z.boolean(),
  Experten: z.boolean(),
  FAQ: z.boolean(),
  'info freien Plaetze?': z.boolean(),
  'Info zur Erfolgsquote': z.boolean(),
  Nachholmoeglichkeiten: z.boolean(),
  Pruefungsarchiv: z.boolean(),
  'Unterstuezung ausserhalb Unterrichtszeit': z.boolean(),

  Spezielles: z.string().nullable().optional(),
});

export type CourseDetail = z.infer<typeof CourseDetailSchema>;

export const parseCourseDetail = (raw: unknown): CourseDetail => {
  const result = CourseDetailSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues
      .map((e) => `[${String(e.path.join('.'))}] ${e.message}`)
      .join(', ');
    throw new Error(`CourseDetail Validierungsfehler: ${messages}`);
  }
  return result.data;
};

export const parseCourseDetails = (rawList: unknown[]): CourseDetail[] => {
  const valid: CourseDetail[] = [];
  for (const raw of rawList) {
    const result = CourseDetailSchema.safeParse(raw);
    if (result.success) {
      valid.push(result.data);
    } else {
      console.warn(
        'Ungültiges CourseDetail übersprungen:',
        result.error.issues
          .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
          .join(', ')
      );
    }
  }
  return valid;
};