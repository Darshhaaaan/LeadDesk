export const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  // Date-only values represent calendar dates (such as follow-up dates) and
  // must not shift to the previous day in western time zones.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(isDateOnly ? { timeZone: 'UTC' } : {}),
  }).format(date);
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const formatChartDate = (value: string): string => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

/** Converts a `YYYY-MM-DD` API date to a value usable by `<input type="date">`. */
export const toDateInputValue = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
};

/** Today's local calendar date as `YYYY-MM-DD`. */
export const todayInputValue = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const isOverdue = (value: string | null): boolean => {
  if (!value) {
    return false;
  }
  return value.slice(0, 10) < todayInputValue();
};

export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;
