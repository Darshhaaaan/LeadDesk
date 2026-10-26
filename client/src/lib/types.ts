export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';

export const LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  userId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  company: string | null;
  serviceInterested: string | null;
  status: LeadStatus;
  followUpDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface LeadList {
  items: Lead[];
  pagination: Pagination;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  userId: string;
  type: 'Created' | 'Updated' | 'StatusChanged';
  description: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  createdAt: string;
}

export interface LeadStats {
  total: number;
  byStatus: Record<LeadStatus, number>;
  createdOverTime: Array<{ date: string; count: number }>;
  upcomingFollowUps: {
    count: number;
    leads: Lead[];
  };
}

export interface LeadFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus | '';
  createdFrom?: string;
  createdTo?: string;
  followUpFrom?: string;
  followUpTo?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'followUpDate' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateLeadPayload {
  name: string;
  email: string;
  phoneNumber?: string | null;
  company?: string | null;
  serviceInterested?: string | null;
  status?: LeadStatus;
  followUpDate?: string | null;
  notes?: string | null;
}

export type UpdateLeadPayload = Partial<CreateLeadPayload>;

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
