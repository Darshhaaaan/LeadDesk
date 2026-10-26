import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/errors';
import type { Prisma } from '../generated/prisma/client';
import {
  isDateOnly,
  parseLeadDate,
  type CreateLeadInput,
  type LeadListQuery,
  type UpdateLeadInput,
} from '../validation/lead.schemas';

export const leadSelect = {
  id: true,
  userId: true,
  name: true,
  email: true,
  phoneNumber: true,
  company: true,
  serviceInterested: true,
  status: true,
  followUpDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeadSelect;

export type LeadRecord = Prisma.LeadGetPayload<{ select: typeof leadSelect }>;

export interface LeadDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  company: string | null;
  serviceInterested: string | null;
  status: LeadRecord['status'];
  followUpDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface LeadListDto {
  items: LeadDto[];
  pagination: PaginationDto;
}

export interface LeadActivityDto {
  id: string;
  leadId: string;
  userId: string;
  type: string;
  description: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
}

export interface LeadStatsDto {
  total: number;
  byStatus: Record<string, number>;
  createdOverTime: Array<{ date: string; count: number }>;
  upcomingFollowUps: {
    count: number;
    leads: LeadDto[];
  };
}

const dateOnlyString = (date: Date | null): string | null =>
  date ? date.toISOString().slice(0, 10) : null;

export const toLeadDto = (lead: LeadRecord): LeadDto => ({
  id: lead.id,
  userId: lead.userId,
  name: lead.name,
  email: lead.email,
  phoneNumber: lead.phoneNumber,
  company: lead.company,
  serviceInterested: lead.serviceInterested,
  status: lead.status,
  followUpDate: dateOnlyString(lead.followUpDate),
  notes: lead.notes,
  createdAt: lead.createdAt.toISOString(),
  updatedAt: lead.updatedAt.toISOString(),
});

export const toLeadActivityDto = (activity: {
  id: string;
  leadId: string;
  userId: string;
  type: string;
  description: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: Date;
}): LeadActivityDto => ({
  id: activity.id,
  leadId: activity.leadId,
  userId: activity.userId,
  type: activity.type,
  description: activity.description,
  fromStatus: activity.fromStatus,
  toStatus: activity.toStatus,
  createdAt: activity.createdAt.toISOString(),
});

const leadNotFound = (): ApiError => new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found.');

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const endOfUtcDay = (date: Date): Date => {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
};

const buildDateRange = (
  from: string | undefined,
  to: string | undefined
): { gte?: Date; lte?: Date } | undefined => {
  if (!from && !to) {
    return undefined;
  }

  const range: { gte?: Date; lte?: Date } = {};

  if (from) {
    const parsed = parseLeadDate(from);
    if (!parsed) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid date filter.');
    }
    range.gte = parsed;
  }

  if (to) {
    const parsed = parseLeadDate(to);
    if (!parsed) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid date filter.');
    }
    range.lte = isDateOnly(to) ? endOfUtcDay(parsed) : parsed;
  }

  return range;
};

const normalizeDateOnly = (value: string | null): Date | null => {
  if (value === null) {
    return null;
  }

  const parsed = parseLeadDate(value);
  if (!parsed) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid follow-up date.');
  }

  return startOfUtcDay(parsed);
};

const buildWhere = (userId: string, query: LeadListQuery): Prisma.LeadWhereInput => {
  const where: Prisma.LeadWhereInput = { userId };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { phoneNumber: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.status) {
    where.status = query.status;
  }

  const createdRange = buildDateRange(query.createdFrom, query.createdTo);
  if (createdRange) {
    where.createdAt = createdRange;
  }

  const followUpRange = buildDateRange(query.followUpFrom, query.followUpTo);
  if (followUpRange) {
    where.followUpDate = followUpRange;
  }

  return where;
};

const buildOrderBy = (
  sortBy: LeadListQuery['sortBy'],
  sortOrder: LeadListQuery['sortOrder']
): Prisma.LeadOrderByWithRelationInput[] => {
  // The ID tiebreaker makes pagination deterministic even when the primary
  // sort column contains duplicate values.
  if (sortBy === 'followUpDate') {
    return [{ followUpDate: { sort: sortOrder, nulls: 'last' } }, { id: 'asc' }];
  }

  switch (sortBy) {
    case 'name':
      return [{ name: sortOrder }, { id: 'asc' }];
    case 'updatedAt':
      return [{ updatedAt: sortOrder }, { id: 'asc' }];
    case 'status':
      return [{ status: sortOrder }, { id: 'asc' }];
    case 'createdAt':
    default:
      return [{ createdAt: sortOrder }, { id: 'asc' }];
  }
};

export const listLeads = async (userId: string, query: LeadListQuery): Promise<LeadListDto> => {
  const where = buildWhere(userId, query);
  const orderBy = buildOrderBy(query.sortBy, query.sortOrder);
  const skip = (query.page - 1) * query.pageSize;

  const [leads, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      select: leadSelect,
    }),
    prisma.lead.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);

  return {
    items: leads.map(toLeadDto),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1 && totalPages > 0,
    },
  };
};

export const getLead = async (userId: string, leadId: string): Promise<LeadDto> => {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, userId },
    select: leadSelect,
  });

  if (!lead) {
    throw leadNotFound();
  }

  return toLeadDto(lead);
};

export const createLead = async (userId: string, input: CreateLeadInput): Promise<LeadDto> => {
  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        userId,
        name: input.name,
        email: input.email,
        phoneNumber: input.phoneNumber ?? null,
        company: input.company ?? null,
        serviceInterested: input.serviceInterested ?? null,
        status: input.status,
        followUpDate: input.followUpDate ? normalizeDateOnly(input.followUpDate) : null,
        notes: input.notes ?? null,
      },
      select: leadSelect,
    });

    await tx.leadActivity.create({
      data: {
        leadId: created.id,
        userId,
        type: 'Created',
        description: 'Lead created.',
        toStatus: created.status,
      },
    });

    return created;
  });

  return toLeadDto(lead);
};

const buildUpdateData = (input: UpdateLeadInput): Prisma.LeadUncheckedUpdateInput => {
  const data: Prisma.LeadUncheckedUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) data.email = input.email;
  if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber;
  if (input.company !== undefined) data.company = input.company;
  if (input.serviceInterested !== undefined) data.serviceInterested = input.serviceInterested;
  if (input.status !== undefined) data.status = input.status;
  if (input.followUpDate !== undefined) data.followUpDate = normalizeDateOnly(input.followUpDate);
  if (input.notes !== undefined) data.notes = input.notes;

  return data;
};

export const updateLead = async (
  userId: string,
  leadId: string,
  input: UpdateLeadInput
): Promise<LeadDto> => {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({
      where: { id: leadId, userId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw leadNotFound();
    }

    const lead = await tx.lead.update({
      where: { id: existing.id },
      data: buildUpdateData(input),
      select: leadSelect,
    });

    const statusChanged = lead.status !== existing.status;

    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        userId,
        type: statusChanged ? 'StatusChanged' : 'Updated',
        description: statusChanged
          ? `Status changed from ${existing.status} to ${lead.status}.`
          : 'Lead details updated.',
        fromStatus: statusChanged ? existing.status : null,
        toStatus: statusChanged ? lead.status : null,
      },
    });

    return lead;
  });

  return toLeadDto(updated);
};

export const deleteLead = async (userId: string, leadId: string): Promise<void> => {
  const result = await prisma.lead.deleteMany({
    where: { id: leadId, userId },
  });

  if (result.count === 0) {
    throw leadNotFound();
  }
};

export const getLeadActivities = async (
  userId: string,
  leadId: string
): Promise<LeadActivityDto[]> => {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, userId },
    select: { id: true },
  });

  if (!lead) {
    throw leadNotFound();
  }

  const activities = await prisma.leadActivity.findMany({
    where: { leadId, userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 20,
  });

  return activities.map((activity) =>
    toLeadActivityDto({
      ...activity,
      type: activity.type,
      fromStatus: activity.fromStatus,
      toStatus: activity.toStatus,
    })
  );
};

export const getLeadStats = async (userId: string): Promise<LeadStatsDto> => {
  const today = startOfUtcDay(new Date());
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - 29);

  const [statusGroups, recentCreatedLeads, upcomingCount, upcomingLeads] = await prisma.$transaction([
    prisma.lead.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.lead.findMany({
      where: { userId, createdAt: { gte: windowStart } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.lead.count({
      where: { userId, followUpDate: { gte: today } },
    }),
    prisma.lead.findMany({
      where: { userId, followUpDate: { gte: today } },
      orderBy: [{ followUpDate: 'asc' }, { id: 'asc' }],
      take: 5,
      select: leadSelect,
    }),
  ]);

  const byStatus: Record<string, number> = {
    New: 0,
    Contacted: 0,
    Qualified: 0,
    Converted: 0,
    Lost: 0,
  };

  for (const group of statusGroups) {
    byStatus[group.status] = group._count._all;
  }

  const total = statusGroups.reduce((sum, group) => sum + group._count._all, 0);

  const countsByDay = new Map<string, number>();
  for (const lead of recentCreatedLeads) {
    const key = lead.createdAt.toISOString().slice(0, 10);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const createdOverTime: Array<{ date: string; count: number }> = [];
  for (let index = 0; index < 30; index += 1) {
    const date = new Date(windowStart);
    date.setUTCDate(windowStart.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    createdOverTime.push({ date: key, count: countsByDay.get(key) ?? 0 });
  }

  return {
    total,
    byStatus,
    createdOverTime,
    upcomingFollowUps: {
      count: upcomingCount,
      leads: upcomingLeads.map(toLeadDto),
    },
  };
};
