import { NextResponse } from 'next/server';
import { scanAndLoadDashboardState } from '@/lib/services/dashboard-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await scanAndLoadDashboardState();
  return NextResponse.json(state);
}
