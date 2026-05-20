import {
  PrismaClient,
  type Market as PrismaMarket,
  type Scan as PrismaScan,
  type Signal as PrismaSignal,
  type SkippedMarket as PrismaSkippedMarket
} from '@prisma/client';
import type {
  ArenaRunResult,
  ArenaSignal,
  CommitmentRecord,
  DashboardStats,
  LeaderboardEntry,
  ParsedMarket,
  ScanRecord,
  SkippedMarket,
  SupportedAsset
} from '@/types/predictarena';
import { ensurePredictArenaDatabaseFile, resolvePredictArenaDatabaseUrl } from '@/lib/config/runtime-db';
import type { PredictArenaStore, SaveScanInput } from '@/lib/server/store/types';

interface PrismaStoreOptions {
  databaseUrl?: string;
  prismaClient?: PrismaClient;
}

const INITIALIZATION_STATEMENTS = [
  'PRAGMA foreign_keys = ON',
  `CREATE TABLE IF NOT EXISTS "Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "fallbackReason" TEXT,
    "liveMarketCount" INTEGER NOT NULL,
    "parsedMarketCount" INTEGER NOT NULL,
    "skippedMarketCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "thresholdCents" INTEGER NOT NULL,
    "expiryAt" DATETIME NOT NULL,
    "yesPriceBps" INTEGER NOT NULL,
    "noPriceBps" INTEGER NOT NULL,
    "liquidityScoreBps" INTEGER NOT NULL,
    "parseConfidenceBps" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanId" TEXT,
    CONSTRAINT "Market_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS "Market_scanId_idx" ON "Market"("scanId")',
  `CREATE TABLE IF NOT EXISTS "SkippedMarket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "question" TEXT,
    CONSTRAINT "SkippedMarket_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS "SkippedMarket_scanId_idx" ON "SkippedMarket"("scanId")',
  `CREATE TABLE IF NOT EXISTS "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "yesProbabilityBps" INTEGER NOT NULL,
    "noProbabilityBps" INTEGER NOT NULL,
    "confidenceBps" INTEGER NOT NULL,
    "edgeBps" INTEGER NOT NULL,
    "eligibleForCommit" BOOLEAN NOT NULL,
    "disabledReason" TEXT,
    "bondAmountMicroUsdc" INTEGER NOT NULL,
    "agentScoreBps" INTEGER NOT NULL,
    "reasons" TEXT NOT NULL,
    "committedTxHash" TEXT,
    "commitmentStatus" TEXT NOT NULL DEFAULT 'not_started',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS "Signal_marketId_idx" ON "Signal"("marketId")',
  `CREATE TABLE IF NOT EXISTS "Forecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "probabilityBps" INTEGER NOT NULL,
    "reasons" TEXT NOT NULL,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Forecast_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS "Forecast_marketId_idx" ON "Forecast"("marketId")',
  `CREATE TABLE IF NOT EXISTS "Commitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signalId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "bondAmountMicroUsdc" INTEGER NOT NULL,
    "committedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Commitment_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "Commitment_signalId_key" ON "Commitment"("signalId")'
] as const;

function emptyStats(): DashboardStats {
  return {
    totalScannedMarkets: 0,
    parsedMarkets: 0,
    skippedMarkets: 0,
    generatedSignals: 0,
    committedSignals: 0,
    usdcBondedMicro: 0,
    averageAgentScoreBps: 0
  };
}

function resolveScannedMarketCount(scan: ScanRecord): number {
  return Math.max(scan.liveMarketCount, scan.parsedMarketCount + scan.skippedMarketCount);
}

function buildLeaderboard(signals: ArenaSignal[], markets: ParsedMarket[]): LeaderboardEntry[] {
  const marketById = new Map(markets.map((market) => [market.id, market]));
  const grouped = new Map<SupportedAsset, LeaderboardEntry>();

  for (const signal of signals) {
    const market = marketById.get(signal.marketId);
    if (!market) {
      continue;
    }

    const current = grouped.get(market.asset) ?? {
      asset: market.asset,
      scoreBps: 0,
      signalCount: 0,
      committedCount: 0
    };

    current.scoreBps += signal.agentScoreBps;
    current.signalCount += 1;
    if (signal.committedTxHash) {
      current.committedCount += 1;
    }

    grouped.set(market.asset, current);
  }

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      scoreBps: entry.signalCount === 0 ? 0 : Math.round(entry.scoreBps / entry.signalCount)
    }))
    .sort((left, right) => right.scoreBps - left.scoreBps);
}

function parseReasons(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map((reason) => String(reason)) : [];
}

function serializeReasons(reasons: string[]): string {
  return JSON.stringify(reasons);
}

function hasCommittedState(
  signal?:
    | {
        committedTxHash: string | null | undefined;
        commitmentStatus: string;
      }
    | null
): boolean {
  return Boolean(signal?.committedTxHash) || signal?.commitmentStatus === 'committed';
}

function mapScan(record: PrismaScan): ScanRecord {
  return {
    id: record.id,
    source: record.source as ScanRecord['source'],
    fallbackReason: record.fallbackReason ?? undefined,
    liveMarketCount: record.liveMarketCount,
    parsedMarketCount: record.parsedMarketCount,
    skippedMarketCount: record.skippedMarketCount,
    createdAt: record.createdAt.toISOString()
  };
}

function mapMarket(record: PrismaMarket): ParsedMarket {
  return {
    id: record.id,
    eventId: record.eventId,
    slug: record.slug,
    question: record.question,
    asset: record.asset as ParsedMarket['asset'],
    direction: record.direction as ParsedMarket['direction'],
    thresholdCents: record.thresholdCents,
    expiryAt: record.expiryAt.toISOString(),
    yesPriceBps: record.yesPriceBps,
    noPriceBps: record.noPriceBps,
    liquidityScoreBps: record.liquidityScoreBps,
    parseConfidenceBps: record.parseConfidenceBps,
    source: record.source as ParsedMarket['source'],
    rawPayload: JSON.parse(record.rawPayload) as Record<string, unknown>
  };
}

function mapSkippedMarket(record: PrismaSkippedMarket): SkippedMarket {
  return {
    marketId: record.marketId,
    reason: record.reason as SkippedMarket['reason'],
    question: record.question ?? undefined
  };
}

function mapSignal(record: PrismaSignal): ArenaSignal {
  return {
    id: record.id,
    marketId: record.marketId,
    decision: record.decision as ArenaSignal['decision'],
    yesProbabilityBps: record.yesProbabilityBps,
    noProbabilityBps: record.noProbabilityBps,
    confidenceBps: record.confidenceBps,
    edgeBps: record.edgeBps,
    eligibleForCommit: record.eligibleForCommit,
    disabledReason: record.disabledReason ?? undefined,
    bondAmountMicroUsdc: record.bondAmountMicroUsdc,
    agentScoreBps: record.agentScoreBps,
    reasons: parseReasons(record.reasons),
    createdAt: record.createdAt.toISOString(),
    committedTxHash: record.committedTxHash ?? undefined,
    commitmentStatus: record.commitmentStatus as ArenaSignal['commitmentStatus']
  };
}

export class PrismaPredictArenaStore implements PredictArenaStore {
  private readonly prisma: PrismaClient;
  private readonly initPromise: Promise<void>;
  private queue = Promise.resolve();

  constructor(options: PrismaStoreOptions = {}) {
    const databaseUrl = resolvePredictArenaDatabaseUrl(options.databaseUrl);
    process.env.DATABASE_URL = databaseUrl;

    this.prisma =
      options.prismaClient ??
      new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl
          }
        }
      });
    this.initPromise = this.initialize(databaseUrl);
  }

  async disconnect(): Promise<void> {
    await this.initPromise.catch(() => undefined);
    await this.prisma.$disconnect();
  }

  private async initialize(databaseUrl: string): Promise<void> {
    await ensurePredictArenaDatabaseFile(databaseUrl);
    for (const statement of INITIALIZATION_STATEMENTS) {
      await this.prisma.$executeRawUnsafe(statement);
    }
  }

  private async read<T>(reader: () => Promise<T>): Promise<T> {
    await this.initPromise;
    return reader();
  }

  private async write<T>(writer: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      await this.initPromise;
      return writer();
    });

    this.queue = next.then(
      () => undefined,
      () => undefined
    );

    return next;
  }

  async saveScan(input: SaveScanInput): Promise<void> {
    await this.write(async () => {
      await this.prisma.$transaction(async (tx) => {
        await tx.forecast.deleteMany();
        await tx.scan.create({
          data: {
            id: input.scan.id,
            source: input.scan.source,
            fallbackReason: input.scan.fallbackReason ?? null,
            liveMarketCount: input.scan.liveMarketCount,
            parsedMarketCount: input.scan.parsedMarketCount,
            skippedMarketCount: input.scan.skippedMarketCount,
            createdAt: new Date(input.scan.createdAt)
          }
        });

        await tx.signal.deleteMany({
          where: {
            commitment: {
              is: null
            }
          }
        });

        if (input.markets.length > 0) {
          for (const market of input.markets) {
            await tx.market.upsert({
              where: {
                id: market.id
              },
              update: {
                eventId: market.eventId,
                slug: market.slug,
                question: market.question,
                asset: market.asset,
                direction: market.direction,
                thresholdCents: market.thresholdCents,
                expiryAt: new Date(market.expiryAt),
                yesPriceBps: market.yesPriceBps,
                noPriceBps: market.noPriceBps,
                liquidityScoreBps: market.liquidityScoreBps,
                parseConfidenceBps: market.parseConfidenceBps,
                source: market.source,
                rawPayload: JSON.stringify(market.rawPayload),
                scanId: input.scan.id,
                updatedAt: new Date(input.scan.createdAt)
              },
              create: {
                id: market.id,
                eventId: market.eventId,
                slug: market.slug,
                question: market.question,
                asset: market.asset,
                direction: market.direction,
                thresholdCents: market.thresholdCents,
                expiryAt: new Date(market.expiryAt),
                yesPriceBps: market.yesPriceBps,
                noPriceBps: market.noPriceBps,
                liquidityScoreBps: market.liquidityScoreBps,
                parseConfidenceBps: market.parseConfidenceBps,
                source: market.source,
                rawPayload: JSON.stringify(market.rawPayload),
                createdAt: new Date(input.scan.createdAt),
                updatedAt: new Date(input.scan.createdAt),
                scanId: input.scan.id
              }
            });
          }
        }

        if (input.skips.length > 0) {
          await tx.skippedMarket.createMany({
            data: input.skips.map((skip, index) => ({
              id: `${input.scan.id}-skip-${index}`,
              scanId: input.scan.id,
              marketId: skip.marketId,
              reason: skip.reason,
              question: skip.question ?? null
            }))
          });
        }

        await tx.market.deleteMany({
          where: {
            id: {
              notIn: input.markets.map((market) => market.id)
            },
            signals: {
              none: {}
            }
          }
        });
      });
    });
  }

  async getLatestScan(): Promise<ScanRecord | undefined> {
    return this.read(async () => {
      const record = await this.prisma.scan.findFirst({
        orderBy: {
          createdAt: 'desc'
        }
      });
      return record ? mapScan(record) : undefined;
    });
  }

  async getMarkets(): Promise<ParsedMarket[]> {
    return this.read(async () => {
      const latestScan = await this.prisma.scan.findFirst({
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true
        }
      });

      if (!latestScan) {
        return [];
      }

      const records = await this.prisma.market.findMany({
        where: {
          scanId: latestScan.id
        },
        orderBy: {
          id: 'asc'
        }
      });
      return records.map(mapMarket);
    });
  }

  async getSkips(): Promise<SkippedMarket[]> {
    return this.read(async () => {
      const latestScan = await this.prisma.scan.findFirst({
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true
        }
      });

      if (!latestScan) {
        return [];
      }

      const records = await this.prisma.skippedMarket.findMany({
        where: {
          scanId: latestScan.id
        },
        orderBy: {
          id: 'asc'
        }
      });
      return records.map(mapSkippedMarket);
    });
  }

  async getMarket(id: string): Promise<ParsedMarket | undefined> {
    return this.read(async () => {
      const record = await this.prisma.market.findUnique({
        where: {
          id
        }
      });
      return record ? mapMarket(record) : undefined;
    });
  }

  async saveArenaRuns(runs: ArenaRunResult[]): Promise<void> {
    await this.write(async () => {
      await this.prisma.$transaction(async (tx) => {
        const signalIds = runs.map((run) => run.signal.id);
        const [commitments, existingSignals] = await Promise.all([
          signalIds.length === 0
            ? []
            : tx.commitment.findMany({
                where: {
                  signalId: {
                    in: signalIds
                  }
                }
              }),
          signalIds.length === 0
            ? []
            : tx.signal.findMany({
                where: {
                  id: {
                    in: signalIds
                  }
                },
                select: {
                  id: true,
                  committedTxHash: true,
                  commitmentStatus: true
                }
              })
        ]);
        const commitmentBySignalId = new Map(
          commitments.map((commitment) => [commitment.signalId, commitment])
        );
        const existingSignalById = new Map(existingSignals.map((signal) => [signal.id, signal]));

        await tx.forecast.deleteMany();

        if (signalIds.length === 0) {
          await tx.signal.deleteMany({
            where: {
              commitment: {
                is: null
              }
            }
          });
          return;
        }

        await tx.signal.deleteMany({
          where: {
            id: {
              notIn: signalIds
            },
            commitment: {
              is: null
            }
          }
        });

        for (const run of runs) {
          const commitment = commitmentBySignalId.get(run.signal.id);
          const existingSignal = existingSignalById.get(run.signal.id);
          const committedTxHash =
            existingSignal?.committedTxHash ?? commitment?.txHash ?? run.signal.committedTxHash ?? null;
          const commitmentStatus =
            hasCommittedState(existingSignal) || commitment
              ? 'committed'
              : run.signal.commitmentStatus;

          await tx.signal.upsert({
            where: {
              id: run.signal.id
            },
            update: {
              marketId: run.signal.marketId,
              decision: run.signal.decision,
              yesProbabilityBps: run.signal.yesProbabilityBps,
              noProbabilityBps: run.signal.noProbabilityBps,
              confidenceBps: run.signal.confidenceBps,
              edgeBps: run.signal.edgeBps,
              eligibleForCommit: run.signal.eligibleForCommit,
              disabledReason: run.signal.disabledReason ?? null,
              bondAmountMicroUsdc: run.signal.bondAmountMicroUsdc,
              agentScoreBps: run.signal.agentScoreBps,
              reasons: serializeReasons(run.signal.reasons),
              committedTxHash,
              commitmentStatus,
              createdAt: new Date(run.signal.createdAt),
              updatedAt: new Date()
            },
            create: {
              id: run.signal.id,
              marketId: run.signal.marketId,
              decision: run.signal.decision,
              yesProbabilityBps: run.signal.yesProbabilityBps,
              noProbabilityBps: run.signal.noProbabilityBps,
              confidenceBps: run.signal.confidenceBps,
              edgeBps: run.signal.edgeBps,
              eligibleForCommit: run.signal.eligibleForCommit,
              disabledReason: run.signal.disabledReason ?? null,
              bondAmountMicroUsdc: run.signal.bondAmountMicroUsdc,
              agentScoreBps: run.signal.agentScoreBps,
              reasons: serializeReasons(run.signal.reasons),
              committedTxHash,
              commitmentStatus,
              createdAt: new Date(run.signal.createdAt),
              updatedAt: new Date(run.signal.createdAt)
            }
          });
        }

        const forecasts = runs.flatMap((run) => [
          {
            marketId: run.market.id,
            agent: run.volatility.agent,
            probabilityBps: run.volatility.probabilityBps,
            reasons: serializeReasons(run.volatility.reasons),
            rawPayload: null
          },
          {
            marketId: run.market.id,
            agent: run.momentum.agent,
            probabilityBps: run.momentum.probabilityBps,
            reasons: serializeReasons(run.momentum.reasons),
            rawPayload: null
          }
        ]);

        if (forecasts.length > 0) {
          await tx.forecast.createMany({
            data: forecasts
          });
        }
      });
    });
  }

  async getSignals(): Promise<ArenaSignal[]> {
    return this.read(async () => {
      const latestScan = await this.prisma.scan.findFirst({
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true
        }
      });

      if (!latestScan) {
        return [];
      }

      const records = await this.prisma.signal.findMany({
        where: {
          market: {
            is: {
              scanId: latestScan.id
            }
          }
        },
        orderBy: {
          id: 'asc'
        }
      });
      return records.map(mapSignal);
    });
  }

  async getSignal(id: string): Promise<ArenaSignal | undefined> {
    return this.read(async () => {
      const record = await this.prisma.signal.findUnique({
        where: {
          id
        }
      });
      return record ? mapSignal(record) : undefined;
    });
  }

  async saveCommitment(commitment: CommitmentRecord): Promise<void> {
    await this.write(async () => {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.commitment.findUnique({
          where: {
            signalId: commitment.signalId
          }
        });
        if (existing) {
          return;
        }

        await tx.commitment.create({
          data: {
            signalId: commitment.signalId,
            txHash: commitment.txHash,
            bondAmountMicroUsdc: commitment.bondAmountMicroUsdc,
            chainId: commitment.chainId,
            committedAt: new Date(commitment.committedAt)
          }
        });

        await tx.signal.update({
          where: {
            id: commitment.signalId
          },
          data: {
            committedTxHash: commitment.txHash,
            commitmentStatus: 'committed',
            updatedAt: new Date()
          }
        });
      });
    });
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return this.read(async () => {
      const scan = await this.prisma.scan.findFirst({
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!scan) {
        return emptyStats();
      }

      const [signals, commitments] = await Promise.all([
        this.prisma.signal.findMany({
          where: {
            market: {
              is: {
                scanId: scan.id
              }
            }
          },
          select: {
            agentScoreBps: true
          }
        }),
        this.prisma.commitment.findMany({
          select: {
            bondAmountMicroUsdc: true
          }
        })
      ]);

      const totalScore = signals.reduce((sum, signal) => sum + signal.agentScoreBps, 0);
      const totalBonded = commitments.reduce(
        (sum, commitment) => sum + commitment.bondAmountMicroUsdc,
        0
      );

      return {
        totalScannedMarkets: resolveScannedMarketCount(mapScan(scan)),
        parsedMarkets: scan.parsedMarketCount,
        skippedMarkets: scan.skippedMarketCount,
        generatedSignals: signals.length,
        committedSignals: commitments.length,
        usdcBondedMicro: totalBonded,
        averageAgentScoreBps: signals.length === 0 ? 0 : Math.round(totalScore / signals.length)
      };
    });
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.read(async () => {
      const [signals, markets] = await Promise.all([
        this.prisma.signal.findMany({
          orderBy: {
            id: 'asc'
          }
        }),
        this.prisma.market.findMany({
          orderBy: {
            id: 'asc'
          }
        })
      ]);
      return buildLeaderboard(signals.map(mapSignal), markets.map(mapMarket));
    });
  }
}

export function createPrismaStore(options?: PrismaStoreOptions): PredictArenaStore {
  return new PrismaPredictArenaStore(options);
}
