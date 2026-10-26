import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import {
  AUTH_COOKIE,
  app,
  deleteWithCsrf,
  getCookie,
  getCsrf,
  getWithCookies,
  joinCookies,
  patchWithCsrf,
  postWithCsrf,
  registerUser,
  resetRateLimits,
  sendWithCsrf,
} from './helpers';
import { resetEmailServiceForTests } from '../src/services/email.service';

interface Session {
  cookie: string;
  userId: string;
}

const newSession = async (email: string, name = 'Test User'): Promise<Session> => {
  const res = await registerUser({
    name,
    email,
    password: 'Password1',
    confirmPassword: 'Password1',
  });
  const cookie = getCookie(res, AUTH_COOKIE);
  if (!cookie) {
    throw new Error('Expected an auth cookie.');
  }
  return { cookie, userId: res.body.data.user.id };
};

const createLead = async (
  session: Session,
  overrides: Record<string, unknown> = {}
) =>
  postWithCsrf(
    '/api/leads',
    {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phoneNumber: '+1 (555) 010-2000',
      company: 'Acme Co',
      serviceInterested: 'Consulting',
      status: 'New',
      followUpDate: '2026-11-15',
      notes: 'Interested in a Q4 engagement.',
      ...overrides,
    },
    [session.cookie]
  );

const getLeads = async (session: Session, query = '') =>
  getWithCookies(`/api/leads${query}`, [session.cookie]);

describe('Leads API', () => {
  let session: Session;

  beforeEach(async () => {
    await resetRateLimits();
    resetEmailServiceForTests();
    await prisma.user.deleteMany({});
    session = await newSession('owner@example.com', 'Owner User');
  });

  describe('POST /api/leads', () => {
    it('creates a lead owned by the authenticated user and ignores client userId', async () => {
      const other = await newSession('other@example.com', 'Other User');

      const res = await createLead(session, { userId: other.userId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lead).toMatchObject({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phoneNumber: '+1 (555) 010-2000',
        company: 'Acme Co',
        serviceInterested: 'Consulting',
        status: 'New',
        followUpDate: '2026-11-15',
        notes: 'Interested in a Q4 engagement.',
        userId: session.userId,
      });
      expect(res.body.data.lead.id).toBeTruthy();
      expect(res.body.data.lead.createdAt).toBeTruthy();
      expect(res.body.data.lead.updatedAt).toBeTruthy();
    });

    it('creates a lead with defaults and records creation activity', async () => {
      const res = await postWithCsrf(
        '/api/leads',
        { name: 'Minimal Lead', email: 'minimal@example.com' },
        [session.cookie]
      );

      expect(res.status).toBe(201);
      expect(res.body.data.lead.status).toBe('New');
      expect(res.body.data.lead.followUpDate).toBeNull();
      expect(res.body.data.lead.company).toBeNull();

      const activities = await prisma.leadActivity.findMany({
        where: { leadId: res.body.data.lead.id },
      });
      expect(activities).toHaveLength(1);
      expect(activities[0]).toMatchObject({
        userId: session.userId,
        type: 'Created',
        toStatus: 'New',
      });
    });

    it.each([
      [{ name: '', email: 'valid@example.com' }, 'name'],
      [{ name: 'Valid Name', email: 'not-an-email' }, 'email'],
      [{ name: 'Valid Name', email: 'valid@example.com', status: 'Prospect' }, 'status'],
      [{ name: 'Valid Name', email: 'valid@example.com', followUpDate: '2026-02-31' }, 'date'],
      [{ name: 'Valid Name', email: 'valid@example.com', phoneNumber: 'call me' }, 'phone'],
    ])('rejects invalid lead payloads (%#)', async (payload, _label) => {
      const res = await postWithCsrf('/api/leads', payload, [session.cookie]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.lead.count()).toBe(0);
    });

    it('requires authentication and CSRF protection', async () => {
      const unauthenticated = await sendWithCsrf('post', '/api/leads', {
        name: 'No Auth',
        email: 'noauth@example.com',
      });
      expect(unauthenticated.status).toBe(401);

      const csrf = await getCsrf();
      const noCsrf = await request(app)
        .post('/api/leads')
        .set('Cookie', session.cookie)
        .send({ name: 'No CSRF', email: 'nocsrf@example.com' });
      expect(noCsrf.status).toBe(403);
      expect(noCsrf.body.error.code).toBe('CSRF_ERROR');
      expect(csrf.token).toBeTruthy();
      expect(await prisma.lead.count()).toBe(0);
    });
  });

  describe('GET /api/leads', () => {
    it('lists only the authenticated user leads with pagination', async () => {
      const other = await newSession('other@example.com', 'Other User');
      await createLead(other, { name: 'Other Lead', email: 'other-lead@example.com' });

      for (let index = 1; index <= 3; index += 1) {
        const created = await createLead(session, {
          name: `Lead ${index}`,
          email: `lead${index}@example.com`,
        });
        expect(created.status).toBe(201);
      }

      const res = await getLeads(session, '?page=2&pageSize=2');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.pagination).toMatchObject({
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      });
      expect(res.body.data.items.every((lead: { userId: string }) => lead.userId === session.userId)).toBe(true);
    });

    it('searches by name, email, and phone number', async () => {
      await createLead(session, {
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        phoneNumber: '+1 555 010 2000',
      });
      await createLead(session, {
        name: 'Bob Smith',
        email: 'bob.smith@example.com',
        phoneNumber: '+1 555 010 3000',
      });

      const byName = await getLeads(session, '?search=alice');
      expect(byName.body.data.items).toHaveLength(1);
      expect(byName.body.data.items[0].name).toBe('Alice Johnson');

      const byEmail = await getLeads(session, '?search=SMITH%40example');
      expect(byEmail.body.data.items).toHaveLength(1);
      expect(byEmail.body.data.items[0].name).toBe('Bob Smith');

      const byPhone = await getLeads(session, '?search=010%203000');
      expect(byPhone.body.data.items).toHaveLength(1);
      expect(byPhone.body.data.items[0].name).toBe('Bob Smith');

      const noMatch = await getLeads(session, '?search=nobody');
      expect(noMatch.body.data.items).toHaveLength(0);
      expect(noMatch.body.data.pagination.total).toBe(0);
      expect(noMatch.body.data.pagination.totalPages).toBe(0);
    });

    it('filters by status, creation date, and follow-up date', async () => {
      const leadA = await createLead(session, {
        name: 'Filter A',
        email: 'filter-a@example.com',
        status: 'New',
        followUpDate: '2026-11-01',
      });
      const leadB = await createLead(session, {
        name: 'Filter B',
        email: 'filter-b@example.com',
        status: 'Qualified',
        followUpDate: '2026-12-01',
      });
      await createLead(session, {
        name: 'Filter C',
        email: 'filter-c@example.com',
        status: 'Lost',
        followUpDate: '2027-01-01',
      });

      await prisma.lead.update({
        where: { id: leadA.body.data.lead.id },
        data: { createdAt: new Date('2026-01-15T10:00:00.000Z') },
      });
      await prisma.lead.update({
        where: { id: leadB.body.data.lead.id },
        data: { createdAt: new Date('2026-02-15T10:00:00.000Z') },
      });

      const qualified = await getLeads(session, '?status=Qualified');
      expect(qualified.body.data.items.map((lead: { name: string }) => lead.name)).toEqual(['Filter B']);

      const created = await getLeads(session, '?createdFrom=2026-02-01&createdTo=2026-02-28');
      expect(created.body.data.items.map((lead: { name: string }) => lead.name)).toEqual(['Filter B']);

      const followUps = await getLeads(session, '?followUpFrom=2026-11-15&followUpTo=2026-12-31');
      expect(followUps.body.data.items.map((lead: { name: string }) => lead.name)).toEqual(['Filter B']);
    });

    it('uses documented stable sorting with an ID tiebreaker', async () => {
      await createLead(session, { name: 'Same Name', email: 'same1@example.com' });
      await createLead(session, { name: 'Same Name', email: 'same2@example.com' });
      await createLead(session, { name: 'Alpha Name', email: 'alpha@example.com' });

      const ascending = await getLeads(session, '?sortBy=name&sortOrder=asc');
      expect(ascending.body.data.items.map((lead: { name: string }) => lead.name)).toEqual([
        'Alpha Name',
        'Same Name',
        'Same Name',
      ]);

      const ids = ascending.body.data.items
        .filter((lead: { name: string }) => lead.name === 'Same Name')
        .map((lead: { id: string }) => lead.id);
      expect(ids).toEqual([...ids].sort());

      const descending = await getLeads(session, '?sortBy=createdAt&sortOrder=desc');
      expect(descending.body.data.items).toHaveLength(3);
    });

    it.each([
      '?page=0',
      '?page=abc',
      '?pageSize=0',
      '?pageSize=101',
      '?status=Prospect',
      '?createdFrom=not-a-date',
      '?createdFrom=2026-03-01&createdTo=2026-02-01',
      '?sortBy=passwordHash',
    ])('rejects invalid query parameters (%s)', async (query) => {
      const res = await getLeads(session, query);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('requires authentication', async () => {
      const res = await getWithCookies('/api/leads', []);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/leads/:id', () => {
    it('returns a lead with its activity history', async () => {
      const created = await createLead(session);
      const id = created.body.data.lead.id;

      const res = await getWithCookies(`/api/leads/${id}`, [session.cookie]);
      expect(res.status).toBe(200);
      expect(res.body.data.lead.id).toBe(id);

      const activities = await getWithCookies(`/api/leads/${id}/activities`, [session.cookie]);
      expect(activities.status).toBe(200);
      expect(activities.body.data.activities).toHaveLength(1);
      expect(activities.body.data.activities[0].type).toBe('Created');
    });

    it('rejects invalid lead IDs', async () => {
      const res = await getWithCookies('/api/leads/not-a-uuid', [session.cookie]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for a missing lead', async () => {
      const res = await getWithCookies('/api/leads/00000000-0000-4000-8000-000000000000', [
        session.cookie,
      ]);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('LEAD_NOT_FOUND');
    });
  });

  describe('PATCH /api/leads/:id', () => {
    it('updates fields and records a status-change activity', async () => {
      const created = await createLead(session);
      const id = created.body.data.lead.id;

      const res = await patchWithCsrf(
        `/api/leads/${id}`,
        {
          status: 'Qualified',
          notes: 'Updated notes',
          company: null,
          followUpDate: '2026-12-24',
        },
        [session.cookie]
      );

      expect(res.status).toBe(200);
      expect(res.body.data.lead).toMatchObject({
        status: 'Qualified',
        notes: 'Updated notes',
        company: null,
        followUpDate: '2026-12-24',
      });

      const activity = await prisma.leadActivity.findFirst({
        where: { leadId: id, type: 'StatusChanged' },
      });
      expect(activity).toMatchObject({
        fromStatus: 'New',
        toStatus: 'Qualified',
        userId: session.userId,
      });
    });

    it('rejects empty updates, invalid fields, and invalid dates', async () => {
      const created = await createLead(session);
      const id = created.body.data.lead.id;

      const empty = await patchWithCsrf(`/api/leads/${id}`, {}, [session.cookie]);
      expect(empty.status).toBe(400);

      const invalidStatus = await patchWithCsrf(`/api/leads/${id}`, { status: 'Unknown' }, [
        session.cookie,
      ]);
      expect(invalidStatus.status).toBe(400);

      const invalidDate = await patchWithCsrf(`/api/leads/${id}`, { followUpDate: '2026-13-01' }, [
        session.cookie,
      ]);
      expect(invalidDate.status).toBe(400);

      const invalidId = await patchWithCsrf('/api/leads/not-a-uuid', { name: 'Nope' }, [
        session.cookie,
      ]);
      expect(invalidId.status).toBe(400);
    });

    it('enforces CSRF protection', async () => {
      const created = await createLead(session);
      const id = created.body.data.lead.id;
      const csrf = await getCsrf();

      const res = await request(app)
        .patch(`/api/leads/${id}`)
        .set('Cookie', joinCookies(session.cookie, csrf.cookie))
        .send({ name: 'No CSRF' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_ERROR');

      const mismatched = `${csrf.token[0] === '0' ? '1' : '0'}${csrf.token.slice(1)}`;
      const mismatchRes = await request(app)
        .patch(`/api/leads/${id}`)
        .set('Cookie', joinCookies(session.cookie, csrf.cookie))
        .set('X-XSRF-TOKEN', mismatched)
        .send({ name: 'Bad CSRF' });
      expect(mismatchRes.status).toBe(403);
    });
  });

  describe('DELETE /api/leads/:id', () => {
    it('deletes a lead and cascades its activity rows', async () => {
      const created = await createLead(session);
      const id = created.body.data.lead.id;
      expect(await prisma.leadActivity.count({ where: { leadId: id } })).toBe(1);

      const res = await deleteWithCsrf(`/api/leads/${id}`, undefined, [session.cookie]);
      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Lead deleted successfully.');
      expect(await prisma.lead.findUnique({ where: { id } })).toBeNull();
      expect(await prisma.leadActivity.count({ where: { leadId: id } })).toBe(0);

      const again = await deleteWithCsrf(`/api/leads/${id}`, undefined, [session.cookie]);
      expect(again.status).toBe(404);
    });

    it('enforces CSRF protection', async () => {
      const created = await createLead(session);
      const id = created.body.data.lead.id;
      const csrf = await getCsrf();

      const res = await request(app)
        .delete(`/api/leads/${id}`)
        .set('Cookie', joinCookies(session.cookie, csrf.cookie));
      expect(res.status).toBe(403);
      expect(await prisma.lead.count({ where: { id } })).toBe(1);
    });
  });

  describe('ownership isolation', () => {
    it('prevents another user from reading, updating, deleting, or listing a lead', async () => {
      const created = await createLead(session);
      const id = created.body.data.lead.id;
      const other = await newSession('intruder@example.com', 'Intruder User');

      const getRes = await getWithCookies(`/api/leads/${id}`, [other.cookie]);
      expect(getRes.status).toBe(404);

      const activitiesRes = await getWithCookies(`/api/leads/${id}/activities`, [other.cookie]);
      expect(activitiesRes.status).toBe(404);

      const patchRes = await patchWithCsrf(`/api/leads/${id}`, { name: 'Hijacked' }, [other.cookie]);
      expect(patchRes.status).toBe(404);

      const deleteRes = await deleteWithCsrf(`/api/leads/${id}`, undefined, [other.cookie]);
      expect(deleteRes.status).toBe(404);

      const listRes = await getLeads(other);
      expect(listRes.body.data.items).toHaveLength(0);
      expect(listRes.body.data.pagination.total).toBe(0);

      const stillThere = await prisma.lead.findUnique({ where: { id } });
      expect(stillThere?.name).toBe('Alice Johnson');
      expect(stillThere?.userId).toBe(session.userId);
    });

    it('ignores attempts to reassign ownership through the update body', async () => {
      const created = await createLead(session);
      const id = created.body.data.lead.id;
      const other = await newSession('new-owner@example.com', 'New Owner');

      const res = await patchWithCsrf(
        `/api/leads/${id}`,
        { name: 'Renamed', userId: other.userId },
        [session.cookie]
      );

      expect(res.status).toBe(200);
      expect(res.body.data.lead.userId).toBe(session.userId);
      expect(res.body.data.lead.name).toBe('Renamed');
    });

    it('scopes statistics to the authenticated user', async () => {
      await createLead(session);
      const other = await newSession('stats-other@example.com', 'Stats Other');

      const res = await getWithCookies('/api/leads/stats', [other.cookie]);
      expect(res.status).toBe(200);
      expect(res.body.data.stats.total).toBe(0);
      expect(res.body.data.stats.byStatus).toEqual({
        New: 0,
        Contacted: 0,
        Qualified: 0,
        Converted: 0,
        Lost: 0,
      });
    });
  });

  describe('GET /api/leads/stats', () => {
    it('returns totals, status counts, trend data, and upcoming follow-ups', async () => {
      const today = new Date();
      const futureDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 5));
      const futureDateString = futureDate.toISOString().slice(0, 10);
      const pastDateString = '2020-01-01';

      await createLead(session, { name: 'New Lead', email: 'new@example.com', status: 'New', followUpDate: futureDateString });
      await createLead(session, { name: 'Qualified Lead', email: 'qualified@example.com', status: 'Qualified', followUpDate: futureDateString });
      await createLead(session, { name: 'Converted Lead', email: 'converted@example.com', status: 'Converted', followUpDate: pastDateString });
      await createLead(session, { name: 'Lost Lead', email: 'lost@example.com', status: 'Lost', followUpDate: pastDateString });

      const res = await getWithCookies('/api/leads/stats', [session.cookie]);
      expect(res.status).toBe(200);

      const stats = res.body.data.stats;
      expect(stats.total).toBe(4);
      expect(stats.byStatus).toEqual({
        New: 1,
        Contacted: 0,
        Qualified: 1,
        Converted: 1,
        Lost: 1,
      });
      expect(stats.createdOverTime).toHaveLength(30);
      expect(stats.createdOverTime.at(-1).date).toBe(
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
          .toISOString()
          .slice(0, 10)
      );
      expect(stats.createdOverTime.reduce((sum: number, point: { count: number }) => sum + point.count, 0)).toBe(4);
      expect(stats.upcomingFollowUps.count).toBe(2);
      expect(stats.upcomingFollowUps.leads).toHaveLength(2);
      expect(stats.upcomingFollowUps.leads.every((lead: { followUpDate: string }) => lead.followUpDate >= futureDateString)).toBe(true);
    });
  });
});
