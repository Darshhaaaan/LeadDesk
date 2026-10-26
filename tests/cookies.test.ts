import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { getCookieValues, getCookieValue } from '../src/lib/cookies';

const requestWithCookie = (cookie?: string): Request =>
  ({ headers: cookie === undefined ? {} : { cookie } }) as unknown as Request;

describe('cookie parsing', () => {
  it('returns every value for a duplicate cookie name in header order', () => {
    const req = requestWithCookie('csrf_token=first; other=value; csrf_token=second');

    expect(getCookieValues(req, 'csrf_token')).toEqual(['first', 'second']);
    expect(getCookieValue(req, 'csrf_token')).toBe('first');
  });

  it('keeps the exact cookie value without URL-decoding', () => {
    const req = requestWithCookie('csrf_token=a%2Bb%20c; theme=dark');

    expect(getCookieValue(req, 'csrf_token')).toBe('a%2Bb%20c');
  });

  it('trims surrounding whitespace from cookie names and values', () => {
    const req = requestWithCookie('  csrf_token =  token-value  ; theme=dark  ');

    expect(getCookieValue(req, 'csrf_token')).toBe('token-value');
  });

  it('ignores malformed and empty cookie segments without throwing', () => {
    const req = requestWithCookie('; =missing-name; csrf_token; theme=dark; csrf_token=bad%zz; csrf_token=');

    expect(() => getCookieValues(req, 'csrf_token')).not.toThrow();
    expect(getCookieValues(req, 'csrf_token')).toEqual(['bad%zz']);
  });

  it('preserves equals signs inside a cookie value', () => {
    const req = requestWithCookie('token=abc=def==; other=value');

    expect(getCookieValue(req, 'token')).toBe('abc=def==');
  });

  it('returns an empty list when the header or cookie name is absent', () => {
    expect(getCookieValues(requestWithCookie(), 'csrf_token')).toEqual([]);
    expect(getCookieValues(requestWithCookie('theme=dark'), 'csrf_token')).toEqual([]);
  });
});
