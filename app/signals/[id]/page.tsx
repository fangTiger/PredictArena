import { notFound } from 'next/navigation';
import { AgentBadge } from '@/components/AgentBadge';
import { HeroPill, NavPill, PageHero, PageShell, SectionLabel } from '@/components/PageShell';
import { TxLink } from '@/components/TxLink';
import { getRuntimeStore } from '@/lib/persistence/store';
import { formatBps, formatMicroUsdc, formatUsd } from '@/lib/utils/format';
import { buildSignalExplanation, normalizeSignalIdParam } from '@/lib/utils/signal';

export const dynamic = 'force-dynamic';

export default async function SignalDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = getRuntimeStore();
  const signal = await store.getSignal(normalizeSignalIdParam(id));

  if (!signal) {
    notFound();
  }

  const explanation = buildSignalExplanation(signal);
  const modelParams = JSON.stringify(signal.modelParams, null, 2);
  const resolution = signal.resolution
    ? `${signal.resolution.outcomeCorrect ? 'Correct' : 'Incorrect'} at ${signal.resolution.resolvedAt}`
    : 'Pending';

  return (
    <PageShell>
      <PageHero
        eyebrow={
          <>
            <HeroPill tone="sky">Signal Detail</HeroPill>
            <HeroPill tone={signal.agentName === 'volatility' ? 'mint' : 'sky'}>
              {signal.agentName}
            </HeroPill>
          </>
        }
        title={signal.marketQuestion}
        description="A deterministic signal record with model inputs, hashes, risk flags, and Arc bond status in the same dashboard shell as the arena."
        size="compact"
        actions={
          <>
            <NavPill href="/arena">Back to Arena</NavPill>
            <NavPill href="/leaderboard">Leaderboard</NavPill>
          </>
        }
        side={
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <AgentBadge agent={signal.agentName} />
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">
                {signal.side}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                {signal.confidence} confidence
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Signal Edge</p>
                <strong className="mt-2 block font-display text-2xl text-white">
                  {formatBps(signal.edgeBps)}
                </strong>
                <p className="mt-2 text-sm text-slate-400">
                  Kelly cap {formatBps(signal.kellyBps)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Bond</p>
                <strong className="mt-2 block font-display text-2xl text-white">
                  {formatMicroUsdc(signal.stakeMicroUsdc)}
                </strong>
                <p className="mt-2 text-sm text-slate-400">{signal.status}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <SectionLabel>Arc Tx</SectionLabel>
              <div className="mt-2">
                <TxLink hash={signal.arcTxHash} />
              </div>
            </div>
          </div>
        }
      />

      <section className="grid items-start gap-6 lg:grid-cols-[1.4fr,0.9fr]">
        <article className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6 shadow-panel backdrop-blur">
          <h2 className="font-display text-2xl text-white">Deterministic Thesis</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">{explanation}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Signal Edge</p>
              <strong className="mt-2 block font-display text-3xl text-white">
                {formatBps(signal.edgeBps)}
              </strong>
              <p className="mt-2 text-sm text-slate-400">
                Market {formatBps(signal.marketPriceBps)} vs agent {formatBps(signal.agentProbabilityBps)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Bond</p>
              <strong className="mt-2 block font-display text-3xl text-white">
                {formatMicroUsdc(signal.stakeMicroUsdc)}
              </strong>
              <p className="mt-2 text-sm text-slate-400">Kelly cap {formatBps(signal.kellyBps)}</p>
            </div>
          </div>
        </article>

        <aside className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6 shadow-panel backdrop-blur">
          <h2 className="font-display text-2xl text-white">Audit Trail</h2>
          <dl className="mt-5 space-y-4 text-sm text-slate-300">
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Signal ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-300">{signal.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Run ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-300">{signal.runId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Market ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-300">{signal.marketId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Asset</dt>
              <dd className="mt-1 text-base text-white">{signal.asset}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Condition Type</dt>
              <dd className="mt-1 text-base text-white">{signal.conditionType}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</dt>
              <dd className="mt-1 text-base text-white">{signal.status}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Source</dt>
              <dd className="mt-1 text-base text-white">{signal.source}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Created</dt>
              <dd className="mt-1 text-base text-white">{signal.createdAt}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Updated</dt>
              <dd className="mt-1 text-base text-white">{signal.updatedAt}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Threshold</dt>
              <dd className="mt-1 text-base text-white">{formatUsd(signal.thresholdUsd)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Expiry</dt>
              <dd className="mt-1 text-base text-white">{signal.expiresAt}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">pYes</dt>
              <dd className="mt-1 text-base text-white">{formatBps(signal.pYesBps)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">YES Price</dt>
              <dd className="mt-1 text-base text-white">{formatBps(signal.yesPriceBps)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Confidence Bps</dt>
              <dd className="mt-1 text-base text-white">{formatBps(signal.confidenceBps)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Risk Flags</dt>
              <dd className="mt-1 text-base text-white">
                {signal.riskFlags.length > 0 ? signal.riskFlags.join(', ') : 'None'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Resolution</dt>
              <dd className="mt-1 text-base text-white">{resolution}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Model Hash</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-300">{signal.modelHash}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Data Hash</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-300">{signal.dataHash}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Model Params</dt>
              <dd className="mt-1">
                <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 text-slate-300">
                  {modelParams}
                </pre>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Arc Tx</dt>
              <dd className="mt-1">
                <TxLink hash={signal.arcTxHash} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Market Link</dt>
              <dd className="mt-1">
                {signal.marketUrl ? (
                  <a
                    href={signal.marketUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky underline-offset-4 hover:underline"
                  >
                    Open Polymarket market
                  </a>
                ) : (
                  <span className="text-slate-500">Unavailable</span>
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </PageShell>
  );
}
