'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  buildAdminSessionCookie,
  isAdminSessionAuthorized
} from '@/lib/config/admin-auth';

export async function submitAdminLogin(formData: FormData) {
  const submittedToken = formData.get('token');
  const normalizedToken =
    typeof submittedToken === 'string' ? submittedToken.trim() : '';

  if (!isAdminSessionAuthorized(normalizedToken)) {
    redirect('/admin/login?error=1');
  }

  const cookieStore = await cookies();
  cookieStore.set(buildAdminSessionCookie(normalizedToken));

  redirect('/admin');
}
