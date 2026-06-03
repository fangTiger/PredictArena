import { describe, expect, it } from 'vitest';
import nextConfig from '@/next.config';
import {
  ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS,
  ADMIN_ACCESS_COOKIE_NAME,
  buildAdminSessionCookie,
  isAdminSessionAuthorized,
  readAdminAccessToken,
  readAdminSessionCookieValue
} from '@/lib/config/admin-auth';

describe('admin auth helpers', () => {
  it('reads ADMIN_ACCESS_TOKEN and treats blank values as missing', () => {
    expect(readAdminAccessToken({ ADMIN_ACCESS_TOKEN: 'showcase-token' })).toBe(
      'showcase-token'
    );
    expect(readAdminAccessToken({ ADMIN_ACCESS_TOKEN: '   ' })).toBeNull();
    expect(readAdminAccessToken({})).toBeNull();
  });

  it('reads pa_admin cookie values from a cookie store-like object', () => {
    const cookieStore = {
      get(name: string) {
        if (name === ADMIN_ACCESS_COOKIE_NAME) {
          return { value: 'showcase-token' };
        }

        return undefined;
      }
    };

    expect(readAdminSessionCookieValue(cookieStore)).toBe('showcase-token');
    expect(readAdminSessionCookieValue({ get: () => undefined })).toBeNull();
  });

  it('authorizes only when cookie and env token match', () => {
    const env = { ADMIN_ACCESS_TOKEN: 'showcase-token' };

    expect(isAdminSessionAuthorized('showcase-token', env)).toBe(true);
    expect(isAdminSessionAuthorized('wrong-token', env)).toBe(false);
    expect(isAdminSessionAuthorized(null, env)).toBe(false);
    expect(isAdminSessionAuthorized('showcase-token', {})).toBe(false);
  });

  it('builds an httpOnly 12-hour admin session cookie', () => {
    const cookie = buildAdminSessionCookie('showcase-token');

    expect(cookie).toEqual(
      expect.objectContaining({
        name: ADMIN_ACCESS_COOKIE_NAME,
        value: 'showcase-token',
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: ADMIN_ACCESS_COOKIE_MAX_AGE_SECONDS
      })
    );
  });

  it('rewrites /admin/login to /admin-login outside the gated tree', async () => {
    const rewrites = await nextConfig.rewrites?.();

    expect(rewrites).toEqual(
      expect.arrayContaining([
        {
          source: '/admin/login',
          destination: '/admin-login'
        }
      ])
    );
  });
});
