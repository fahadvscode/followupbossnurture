import { cookies } from 'next/headers';

const AUTH_COOKIE = 'drip_auth';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function verifyPassword(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminPassword) {
    console.error(
      'ADMIN_PASSWORD is not set (or empty); set it in Vercel → Environment Variables and redeploy.'
    );
    return false;
  }
  return (password ?? '').trim() === adminPassword;
}

export async function setAuthCookie() {
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + SESSION_DURATION);
  cookieStore.set(AUTH_COOKIE, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  });
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const auth = cookieStore.get(AUTH_COOKIE);
  return auth?.value === 'authenticated';
}

export async function clearAuth() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}
