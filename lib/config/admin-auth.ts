import { timingSafeEqual } from 'node:crypto';

export const ADMIN_ACCESS_COOKIE_NAME = 'pa_admin';
export const ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

type EnvSource = Record<string, string | undefined>;
type CookieStoreLike = {
  get(name: string): { value?: string } | string | undefined;
};

function normalizeToken(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tokensMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function readAdminAccessToken(env: EnvSource = process.env): string | null {
  return normalizeToken(env.ADMIN_ACCESS_TOKEN);
}

export function readAdminSessionCookieValue(cookieStore: CookieStoreLike): string | null {
  const cookie = cookieStore.get(ADMIN_ACCESS_COOKIE_NAME);

  if (!cookie) {
    return null;
  }

  if (typeof cookie === 'string') {
    return normalizeToken(cookie);
  }

  return normalizeToken(cookie.value);
}

export function isAdminSessionAuthorized(
  candidateToken: string | null | undefined,
  env: EnvSource = process.env
): boolean {
  const expectedToken = readAdminAccessToken(env);
  const normalizedCandidate = normalizeToken(candidateToken);

  if (!expectedToken || !normalizedCandidate) {
    return false;
  }

  return tokensMatch(expectedToken, normalizedCandidate);
}

export function buildAdminSessionCookie(token: string) {
  return {
    name: ADMIN_ACCESS_COOKIE_NAME,
    value: token.trim(),
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production'
  };
}
