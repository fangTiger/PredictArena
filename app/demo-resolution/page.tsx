import { HeroPill, NavPill, PageHero, PageShell } from '@/components/PageShell';
import { DemoResolutionConsole } from '@/app/demo-resolution/DemoResolutionConsole';
import { buildResolutionDemoScript } from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

export default async function DemoResolutionPage() {
  const script = buildResolutionDemoScript(await getRuntimeStore().getArenaState());

  return (
    <PageShell>
      <PageHero
        eyebrow={
          <>
            <HeroPill tone="sky">Demo Resolution Flow</HeroPill>
            <HeroPill tone="neutral">Demo/Admin Only</HeroPill>
          </>
        }
        title="Resolution Demo Script"
        description="A guided operator surface for showing the prediction-to-bond-to-settlement loop while keeping settlement clearly labelled as admin/demo behavior, not an oracle."
        size="compact"
        actions={
          <>
            <NavPill href="/arena">Arena</NavPill>
            <NavPill href="/leaderboard">Leaderboard</NavPill>
          </>
        }
      />
      <DemoResolutionConsole initialScript={script} />
    </PageShell>
  );
}
