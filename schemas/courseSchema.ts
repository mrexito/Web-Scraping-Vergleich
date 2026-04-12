import { z } from 'zod';

export const CourseSchema = z.object({
  provider_id: z.number().int().positive().nullable(),
  title: z.string().nullable().optional(),
  price_chf: z.number().positive().nullable(),
  price_regular_chf: z.number().positive().nullable().optional(),
  discount_valid_until: z.string().nullable().optional(),
  course_type: z.enum(['langgymi', 'kurzgymi']).nullable(),
  location: z.string().nullable(),
  occurrence: z.string().nullable(),
  course_time: z.string().nullable().optional(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable().optional(),
  verfuegbarkeit: z.enum(['viele', 'wenige', 'ausgebucht']).nullable(),
  is_online: z.boolean().nullable(),
  course_url: z.string().url().nullable(),
});

export type Course = z.infer<typeof CourseSchema>;

export const parseCourse = (raw: unknown): Course => {
  const result = CourseSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues
      .map((e) => `[${String(e.path.join('.'))}] ${e.message}`)
      .join(', ');
    throw new Error(`Course Validierungsfehler: ${messages}`);
  }
  return result.data;
};

export const parseCourses = (rawList: unknown[]): Course[] => {
  const valid: Course[] = [];
  for (const raw of rawList) {
    const result = CourseSchema.safeParse(raw);
    if (result.success) {
      valid.push(result.data);
    } else {
      console.warn(
        'Ungültiger Course übersprungen:',
        result.error.issues
          .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
          .join(', ')
      );
    }
  }
  return valid;
};