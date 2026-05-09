import { z } from 'zod';

export const ZapInfoScopeSchema = z.enum(['langgymi', 'kurzgymi', 'fms', 'bms', 'ims', 'k_und_s']);

export const ExamSubjectSchema = z.object({
  name: z.string(),
  duration: z.string(),
});

export const ZapInfoSchema = z.object({
  id: z.number().int().positive(),
  scope: ZapInfoScopeSchema,
  school_year: z.string(),
  registration_start: z.string().nullable().optional(),
  registration_end: z.string().nullable().optional(),
  exam_date: z.string().nullable().optional(),
  exam_time_info: z.string().nullable().optional(),
  result_announcement_date: z.string().nullable().optional(),
  school_start_date: z.string().nullable().optional(),
  exam_subjects: z.array(ExamSubjectSchema).nullable().optional(),
  exam_subjects_en: z.array(ExamSubjectSchema).nullable().optional(),
  notes: z.string().nullable().optional(),
  notes_en: z.string().nullable().optional(),
  source_url: z.string().url(),
  last_verified_at: z.string(),
  updated_by: z.string(),
});

export type ZapInfo = z.infer<typeof ZapInfoSchema>;
export type ZapInfoScope = z.infer<typeof ZapInfoScopeSchema>;
export type ExamSubject = z.infer<typeof ExamSubjectSchema>;

export const parseZapInfos = (rawList: unknown[]): ZapInfo[] => {
  const valid: ZapInfo[] = [];
  for (const raw of rawList) {
    const result = ZapInfoSchema.safeParse(raw);
    if (result.success) {
      valid.push(result.data);
    } else {
      console.warn(
        'Ungültiger ZapInfo-Eintrag übersprungen:',
        result.error.issues.map((e) => `${String(e.path.join('.'))}: ${e.message}`).join(', '),
      );
    }
  }
  return valid;
};
