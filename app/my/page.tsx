import React from 'react';
import { MyDashboard } from '@/components/MyDashboard';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'My · PredictArena'
};

export default function MyPage() {
  return <MyDashboard />;
}
