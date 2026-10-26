import { z } from 'zod';

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const LEAD_SORTS = ['createdAt', 'updatedAt', 'name', 'followUpDate', 'status'] as const;
export type LeadSortValue = (typeof LEAD_SORTS)[number];

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Accepts `YYYY-MM-DD` or a full ISO date-time. Date-only values are treated
 * as UTC calendar dates, which matches how the `@db.Date` column is stored.
 */
export const parseLeadDate = (value: string): Date | null => {
  const candidate = DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00.000Z` : value;
  const parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    // Reject impossible dates such as 2026-02-31 that JS would otherwise roll over.
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }
  }

  return parsed;
};

export const isDateOnly = (value: string): boolean => DATE_ONLY_PATTERN.test(value);

const dateInputSchema = z
  .string()
  .trim()
  .min(1, 'Date filter cannot be empty.')
  .max(64, 'Date filter is too long.')
  .refine((value) => parseLeadDate(value) !== null, 'Please provide a valid ISO date or date-time.');

const optionalText = (max: number, label: string) =>
  z
    .union([z.string().trim().max(max, `${label} must be at most ${max} characters long.`), z.null()])
    .optional();

const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters long.`);

const leadEmailSchema = z
  .string()
  .trim()
  .email('Please provide a valid email address.')
  .max(320, 'Email must be at most 320 characters long.');

const phoneSchema = z
  .string()
  .trim()
  .max(40, 'Phone number must be at most 40 characters long.')
  .regex(/^[+()\d\s.-]+$/, 'Phone number may contain only digits, spaces, parentheses, dots, dashes, and a leading plus sign.');

export const createLeadSchema = z.object({
  name: requiredText(120, 'Name'),
  email: leadEmailSchema,
  phoneNumber: z.union([phoneSchema, z.null()]).optional(),
  company: optionalText(160, 'Company'),
  serviceInterested: optionalText(160, 'Service interested'),
  status: z.enum(LEAD_STATUSES).default('New'),
  followUpDate: z.union([dateInputSchema, z.null()]).optional(),
  notes: optionalText(5000, 'Notes'),
});

export const updateLeadSchema = z
  .object({
    name: requiredText(120, 'Name').optional(),
    email: leadEmailSchema.optional(),
    phoneNumber: z.union([phoneSchema, z.null()]).optional(),
    company: optionalText(160, 'Company'),
    serviceInterested: optionalText(160, 'Service interested'),
    status: z.enum(LEAD_STATUSES).optional(),
    followUpDate: z.union([dateInputSchema, z.null()]).optional(),
    notes: optionalText(5000, 'Notes'),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const leadIdSchema = z.object({
  id: z.string().uuid('Lead ID must be a valid UUID.'),
});

export const leadListQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int('Page must be a whole number.')
      .min(1, 'Page must be at least 1.')
      .max(100000, 'Page is too large.')
      .default(1),
    pageSize: z.coerce
      .number()
      .int('Page size must be a whole number.')
      .min(1, 'Page size must be at least 1.')
      .max(100, 'Page size must be at most 100.')
      .default(10),
    search: z.string().trim().max(100, 'Search must be at most 100 characters long.').optional(),
    status: z.enum(LEAD_STATUSES).optional(),
    createdFrom: dateInputSchema.optional(),
    createdTo: dateInputSchema.optional(),
    followUpFrom: dateInputSchema.optional(),
    followUpTo: dateInputSchema.optional(),
    sortBy: z.enum(LEAD_SORTS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    (data) => {
      if (!data.createdFrom || !data.createdTo) {
        return true;
      }
      const from = parseLeadDate(data.createdFrom);
      const to = parseLeadDate(data.createdTo);
      return Boolean(from && to && from <= to);
    },
    { message: 'createdFrom must be before or equal to createdTo.', path: ['createdFrom'] }
  )
  .refine(
    (data) => {
      if (!data.followUpFrom || !data.followUpTo) {
        return true;
      }
      const from = parseLeadDate(data.followUpFrom);
      const to = parseLeadDate(data.followUpTo);
      return Boolean(from && to && from <= to);
    },
    { message: 'followUpFrom must be before or equal to followUpTo.', path: ['followUpFrom'] }
  );

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
