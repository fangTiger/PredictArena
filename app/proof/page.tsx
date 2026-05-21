import Link from 'next/link';
import { HeroPill, PageHero, PageShell, SectionLabel } from '@/components/PageShell';
import { TxLink } from '@/components/TxLink';
import { buildProofPackView } from '@/lib/proof/service';
import type { OperatorHealthItem } from '@/lib/ops/operatorHealth';
import { formatBps, formatIsoDateTime, formatMicroUsdc } from '@/lib/utils/format';
import { ProofSmokeConsole } from './ProofSmokeConsole';

export const dynamic = 'force-dynamic';

function shortAddress(value: string | null): string {
  if (!value) {
    return 'Not configured';
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function healthTone(item: OperatorHealthItem): string {
  if (item.impact === 'read_only_proof_safe') {
    return 'status-chip status-ready';
  }

  if (item.impact === 'demo_attention_needed' || item.impact === 'autonomy_dry_run_or_off') {
    return 'status-chip status-amber';
  }

  return 'status-chip status-risk';
}

function impactLabel(item: OperatorHealthItem): string {
  return item.impact.replaceAll('_', ' ');
}

export default async function ProofPage() {
  const proofPack = await buildProofPackView();
  const latestReceipt = proofPack.latestReceipt;
  const healthItems = proofPack.operatorHealth.items;
  const wallets = Object.entries(proofPack.smoke.wallets);

  return (
    <PageShell>
      <PageHero
        size="compact"
        eyebrow={
          <>
            <HeroPill tone={proofPack.smoke.commitPreconditions.commitAvailable ? 'mint' : 'neutral'}>
              {proofPack.smoke.commitPreconditions.commitAvailable ? 'Proof Ready' : 'Read-only Proof'}
            </HeroPill>
            <HeroPill tone={proofPack.persistenceMode === 'local_atomic' ? 'sky' : 'neutral'}>
              {proofPack.persistenceMode === 'local_atomic' ? 'Local Atomic' : 'Supabase Best Effort'}
            </HeroPill>
          </>
        }
        title="Proof Pack"
        description="Latest autonomous receipt, Arc readiness, wallet facts, health state, and bounded proof controls in one operator view."
        actions={
          <>
            <Link className="icon-link" href="/arena">
              Arena
            </Link>
            <Link className="icon-link" href="/demo-resolution">
              Demo Script
            </Link>
          </>
        }
        side={
          <dl className="proof-hero-metrics">
            <div>
              <dt>Latest Receipt</dt>
              <dd>{latestReceipt ? latestReceipt.runId : 'No run yet'}</dd>
            </div>
            <div>
              <dt>Latest Tx</dt>
              <dd>
                <TxLink hash={proofPack.latestTxHash} />
              </dd>
            </div>
            <div>
              <dt>Bonded USDC</dt>
              <dd>{formatMicroUsdc(proofPack.bondedUsdcMicroUsdc)}</dd>
            </div>
            <div>
              <dt>Next Demo Action</dt>
              <dd>{proofPack.nextDemoAction}</dd>
            </div>
          </dl>
        }
      />

      <section className="proof-grid" aria-label="Proof Pack summary">
        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <SectionLabel>Latest Receipt</SectionLabel>
              <h2>Autonomous Run</h2>
            </div>
            {latestReceipt ? (
              <Link className="icon-link" href={`/autonomy/runs/${encodeURIComponent(latestReceipt.runId)}`}>
                Open Receipt
              </Link>
            ) : null}
          </div>
          {latestReceipt ? (
            <dl className="proof-fact-grid">
              <div>
                <dt>Triggered</dt>
                <dd>{formatIsoDateTime(latestReceipt.triggeredAt)}</dd>
              </div>
              <div>
                <dt>Markets</dt>
                <dd>{latestReceipt.marketCount}</dd>
              </div>
              <div>
                <dt>Signals</dt>
                <dd>{latestReceipt.generatedSignalCount}</dd>
              </div>
              <div>
                <dt>Committed</dt>
                <dd>{latestReceipt.committedCount}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Run agents or trigger cron to create the first receipt.</p>
          )}
        </article>

        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <SectionLabel>Arc Readiness</SectionLabel>
              <h2>Contract and Chain</h2>
            </div>
            <span className={proofPack.smoke.commitPreconditions.commitAvailable ? 'status-chip status-ready' : 'status-chip status-amber'}>
              {proofPack.smoke.commitPreconditions.commitAvailable ? 'Commit available' : 'Read-only'}
            </span>
          </div>
          <dl className="proof-fact-grid">
            <div>
              <dt>Arc Chain</dt>
              <dd>{proofPack.smoke.chainId}</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>{shortAddress(proofPack.smoke.contract.arenaAddress)}</dd>
            </div>
            <div>
              <dt>USDC</dt>
              <dd>{shortAddress(proofPack.smoke.contract.usdcAddress)}</dd>
            </div>
            <div>
              <dt>Decimals</dt>
              <dd>{proofPack.smoke.contract.usdcDecimals}</dd>
            </div>
          </dl>
        </article>

        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <SectionLabel>Top Reputation</SectionLabel>
              <h2>Agent Profile</h2>
            </div>
            {proofPack.topReputation ? (
              <Link className="icon-link" href={`/agents/${proofPack.topReputation.agentName}`}>
                Open Agent
              </Link>
            ) : null}
          </div>
          {proofPack.topReputation ? (
            <dl className="proof-fact-grid">
              <div>
                <dt>Agent</dt>
                <dd>{proofPack.topReputation.displayName}</dd>
              </div>
              <div>
                <dt>Accuracy</dt>
                <dd>{formatBps(proofPack.topReputation.accuracyBps)}</dd>
              </div>
              <div>
                <dt>Resolved</dt>
                <dd>{proofPack.topReputation.resolvedSignals}</dd>
              </div>
              <div>
                <dt>Brier</dt>
                <dd>
                  {proofPack.topReputation.brierScoreBps === null
                    ? 'Pending'
                    : formatBps(proofPack.topReputation.brierScoreBps)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted">No generated agent profile yet.</p>
          )}
        </article>

        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <SectionLabel>Resolution Summary</SectionLabel>
              <h2>Settlement Memory</h2>
            </div>
          </div>
          <dl className="proof-fact-grid">
            <div>
              <dt>Resolved</dt>
              <dd>{proofPack.resolutionSummary.resolvedSignals}</dd>
            </div>
            <div>
              <dt>Open Signals</dt>
              <dd>{proofPack.resolutionSummary.openSignals}</dd>
            </div>
            <div>
              <dt>Refunded</dt>
              <dd>{formatMicroUsdc(proofPack.resolutionSummary.refundedMicroUsdc)}</dd>
            </div>
            <div>
              <dt>Slashed</dt>
              <dd>{formatMicroUsdc(proofPack.resolutionSummary.slashedMicroUsdc)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="proof-grid proof-grid-wide" aria-label="Proof operations">
        <section className="panel proof-health-panel" aria-labelledby="operator-health-title">
          <div className="panel-header">
            <div>
              <SectionLabel>Operator Health</SectionLabel>
              <h2 id="operator-health-title">Blocking Facts</h2>
            </div>
            <span className={healthItems.length === 0 ? 'status-chip status-ready' : 'status-chip status-amber'}>
              {healthItems.length === 0 ? 'Ready' : `${healthItems.length} signals`}
            </span>
          </div>
          <div className="proof-health-list">
            {healthItems.length === 0 ? (
              <article className="proof-health-item">
                <span className="status-chip status-ready">ready</span>
                <strong>All public proof checks are clear.</strong>
                <p>Read-only proof and bounded proof transactions can use the configured caps.</p>
                <small>No operator action required.</small>
              </article>
            ) : (
              healthItems.map((item) => (
                <article key={`${item.scope}:${item.reasonCode}:${item.impact}`} className="proof-health-item">
                  <span className={healthTone(item)}>{impactLabel(item)}</span>
                  <strong>{item.reasonCode}</strong>
                  <p>{item.blockingFact}</p>
                  <small>{item.nextAction}</small>
                </article>
              ))
            )}
          </div>
        </section>

        <ProofSmokeConsole smoke={proofPack.smoke} />
      </section>

      <section className="panel proof-wallet-panel" aria-labelledby="wallet-facts-title">
        <div className="panel-header">
          <div>
            <SectionLabel>Wallet Facts</SectionLabel>
            <h2 id="wallet-facts-title">Agent Wallets</h2>
          </div>
        </div>
        <div className="proof-wallet-grid">
          {wallets.map(([agentName, wallet]) => (
            <article key={agentName}>
              <strong>{agentName}</strong>
              <dl>
                <div>
                  <dt>Address</dt>
                  <dd>{shortAddress(wallet.publicAddress)}</dd>
                </div>
                <div>
                  <dt>USDC Balance</dt>
                  <dd>
                    {wallet.usdcBalanceMicroUsdc === null
                      ? 'Unavailable'
                      : formatMicroUsdc(Number(wallet.usdcBalanceMicroUsdc))}
                  </dd>
                </div>
                <div>
                  <dt>Allowance</dt>
                  <dd>
                    {wallet.allowanceMicroUsdc === null
                      ? 'Unavailable'
                      : formatMicroUsdc(Number(wallet.allowanceMicroUsdc))}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
