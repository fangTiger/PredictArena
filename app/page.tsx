import { ArenaDashboard } from '@/components/arena-dashboard';
import { ensureDashboardState } from '@/lib/services/dashboard-service';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialState = await ensureDashboardState();
  return <ArenaDashboard initialState={initialState} />;
}
