import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.ts';
import { csrfProtection } from '../middleware/csrf.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { leadWriteLimiter } from '../middleware/rateLimit.ts';
import { sendSuccess } from '../lib/response.ts';
import { ApiError } from '../lib/errors.ts';
import * as leadService from '../services/lead.service.ts';
import {
  createLeadSchema,
  leadIdSchema,
  leadListQuerySchema,
  updateLeadSchema,
} from '../validation/lead.schemas.ts';

const router = Router();

const parseWith = <S extends z.ZodType>(schema: S, value: unknown): z.infer<S> => {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation failed.');
  }

  return parsed.data;
};

const getUserId = (req: Request): string => {
  if (!req.userId) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }
  return req.userId;
};

// CSRF protection applies to every state-changing lead request. Ownership is
// always derived from the authenticated session, never from client input.
router.use(csrfProtection);
router.use(requireAuth);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await leadService.getLeadStats(getUserId(req));
    sendSuccess(res, 200, { stats });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseWith(leadListQuerySchema, req.query);
    const result = await leadService.listLeads(getUserId(req), query);
    sendSuccess(res, 200, result);
  })
);

router.post(
  '/',
  leadWriteLimiter,
  asyncHandler(async (req, res) => {
    const input = parseWith(createLeadSchema, req.body ?? {});
    const lead = await leadService.createLead(getUserId(req), input);
    sendSuccess(res, 201, { lead });
  })
);

router.get(
  '/:id/activities',
  asyncHandler(async (req, res) => {
    const { id } = parseWith(leadIdSchema, req.params);
    const activities = await leadService.getLeadActivities(getUserId(req), id);
    sendSuccess(res, 200, { activities });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseWith(leadIdSchema, req.params);
    const lead = await leadService.getLead(getUserId(req), id);
    sendSuccess(res, 200, { lead });
  })
);

router.patch(
  '/:id',
  leadWriteLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseWith(leadIdSchema, req.params);
    const input = parseWith(updateLeadSchema, req.body ?? {});
    const lead = await leadService.updateLead(getUserId(req), id, input);
    sendSuccess(res, 200, { lead });
  })
);

router.delete(
  '/:id',
  leadWriteLimiter,
  asyncHandler(async (req, res) => {
    const { id } = parseWith(leadIdSchema, req.params);
    await leadService.deleteLead(getUserId(req), id);
    sendSuccess(res, 200, { message: 'Lead deleted successfully.' });
  })
);

export default router;
