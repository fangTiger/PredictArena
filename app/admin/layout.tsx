import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import {
  isAdminSessionAuthorized,
  readAdminSessionCookieValue
} from '@/lib/config/admin-auth';

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const adminCookie = readAdminSessionCookieValue(cookieStore);

  if (!isAdminSessionAuthorized(adminCookie)) {
    redirect('/admin/login');
  }

  return (
    <div className="admin-page" style={{ minHeight: '100vh', padding: '1.25rem' }}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
