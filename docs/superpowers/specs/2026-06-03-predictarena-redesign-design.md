# PredictArena 重设计 · 设计文档（v2）

> 创建日期：2026-06-03
> 修订日期：2026-06-03（v2，已吸收 spec review loop 第 1 轮反馈）
> 状态：草案，待第 2 轮 spec review
> 作者：Claude（codex-dev 架构师）+ 用户拍板

---

## 一、动机与定位

### 1.1 真实需求（重新诊断）

用户最初要求"让连接钱包、数据绑钱包、整体重设计"，深入对话后澄清真实业务目标：

> 我后续想要基于 arc testnet 继续构建一些东西，目的就是为了博得 discord 的 builder 角色……我们这个项目有点不太亮眼。

把项目性质从"功能型工作台"重新定位为：

**PredictArena = 部署在 Arc Testnet 上的 showcase / pitch site，目标是博得 Arc Discord builder 角色。**

观众是 **Arc 生态 builder / 评委**——注意力 30 秒，看的是"差异化叙事 + 链上活跃度 + Demo 可玩性"。

### 1.2 三条核心结论

1. **"亮眼"是功能层问题，UI 重构必须配真正差异化的 hook。**
2. **战略上"一次性做完 + 加 1 个 hook"优于"持续深化加多个 hook"。**
3. **下一个 Arc 项目（Project 2）方向先定，不在本轮设计留口。**

### 1.3 拍板决策（用户已授权全权拍板）

| 决策项 | 选择 | 状态 |
|---|---|---|
| 战略 | 深化 PredictArena 为旗舰 + 加 1 个 Hook | ✅ 锁定 |
| Hook | **Hook 01 · Agent Showdown** | ✅ 锁定 |
| 视觉 | 首页 **Editorial Mono** + 内页 **Glass Neon** 混搭 | ✅ 锁定 |
| Project 2 | **OracleArena**（独立 subdomain，本轮不留口） | ✅ 锁定 |
| 合约策略 | **新合约 `ShowdownArena.sol`**，不扩展现有 `SignalBondArena.sol` | ✅ 锁定（v2） |
| 首页大标语 | `AI agents, betting with proof.` | ✅ 锁定（v2） |
| 是否归档 `add-wallet-funded-follows` | **是**，作为本变更的前置条件，不计入实施分期 | ✅ 锁定（v2） |

---

## 二、与现有规范的关系（Spec Delta Map）

### 2.1 与 `add-wallet-funded-follows` 的关系

该变更已完成全部 11 个任务但未归档。**前置条件**：本变更启动**前**必须完成它的归档（合并 delta 到 `specs/predictarena` + `specs/predictarena-ui`）。归档后的 specs/ 作为本变更的 delta 基线。

### 2.2 现有 `predictarena` spec 的 Delta（共 35 个 requirement）

| 类别 | 处理 | 备注 |
|---|---|---|
| **PRESERVED**（保留，无机制变化） | 30 个 | 大部分后端逻辑、agent 引擎、合约、resolution、cron、reputation、Supabase 持久化等 |
| **MODIFIED** | 2 个 | `Arena, Signal Detail, and Leaderboard UI` 改 scenarios；`Non-Polymarket-Clone User Flow` 强化"以 showcase 为目的"措辞 |
| **REMOVED**（仅 UI 路由层移除，read model 保留） | 3 个 | `Local Intelligence Workspace Identity`、`Saved Intelligence Filters`、`Intelligence Watchlist`、`Intelligence Alert Evaluation`、`Daily Intelligence Queue` —— 它们的 read model 保留为内部可调用 API，但不再有公开 UI 入口 |

**详细分类（predictarena）：**

| Requirement | 类别 | 说明 |
|---|---|---|
| Autonomous Polymarket Market Scanner | PRESERVED | |
| Crypto Price Market Parsing | PRESERVED | |
| Market Scout Candidate Ranking | PRESERVED | |
| Public Crypto Candle and Volatility Features | PRESERVED | |
| Monte Carlo Probability Engine | PRESERVED | |
| Autonomous Forecasting Agents | PRESERVED | Volatility + Momentum 不变 |
| Signal Decision, Kelly, Stake, and Confidence | PRESERVED | |
| Optional Supabase Persistence with Local Fallback | PRESERVED | |
| Tailwind UI and Zod Validation Boundaries | PRESERVED | |
| Arc Testnet Signal Bond Contract | PRESERVED | 现有 SignalBondArena 不动 |
| Server-Side Arc Commit Flow | PRESERVED | 仍负责单边 signal bond |
| Admin-Only Demo Resolution | PRESERVED | 迁移到 `/admin/resolution` |
| Arena, Signal Detail, and Leaderboard UI | **MODIFIED** | Arena scenario 重写为 Showdown 主战场；Leaderboard 收入 `/agents` |
| Documentation, Environment, and Disclaimers | PRESERVED | 文案更新（README 更新单独 task） |
| Automatic Crypto Signal Resolution | PRESERVED | |
| Resolution APIs | PRESERVED | |
| Bulk Arc Resolution | PRESERVED | |
| Resolution Scoring and Leaderboard | PRESERVED | Read model 不变，UI 入口换到 `/agents` |
| Autonomous Market Discovery | PRESERVED | |
| Crypto Price Market Filtering | PRESERVED | |
| Demo Snapshot Fallback | PRESERVED | |
| Forecasting Agent Arena | PRESERVED | |
| Arc USDC Signal Bonds | PRESERVED | |
| Non-Polymarket-Clone User Flow | **MODIFIED** | 增加 scenario："Showcase 用户进站，第一屏理解项目定位" |
| Autonomous Agent Policy | PRESERVED | Showdown commit 必须遵守此 policy（详见 §4.4.3） |
| Autonomous Cron Runner | PRESERVED | Cron 触发 Showdown discovery（详见 §4.5.1） |
| Autonomous Run History | PRESERVED | |
| Arc Readiness and Chain Sync | PRESERVED | |
| Demo Resolution Command | PRESERVED | 迁移到 `/admin` |
| CLOB Spread Risk Signal | PRESERVED | |
| Autonomous Run Receipt Read Model | PRESERVED | |
| Agent Reputation Profile Read Model | PRESERVED | 驱动新 `/agents` 页 |
| Resolution Demo Script Read Model | PRESERVED | 迁移到 `/admin` |
| Cron Idempotency and Autonomous Run Locking | PRESERVED | Showdown commit 复用同一把锁 |
| Live Arc Smoke Proof Mode | PRESERVED | |
| Operator Health and Judge Proof Pack Read Models | PRESERVED | 迁移到 `/admin` |
| Market Intelligence Read Models | PRESERVED | Read model 保留；UI 入口移除 |
| Signal Research Read Model | PRESERVED | 同上 |
| Segmented Agent Reputation | PRESERVED | 入口移到 `/agents` 子模块 |
| Paper Follow and Backtest Read Models | PRESERVED | Read model 保留；UI 入口移除 |
| Local Intelligence Workspace Identity | **REMOVED** | `/intelligence` 路由删除；本地标识不再使用 |
| Saved Intelligence Filters | **REMOVED** | UI 路由删除；后端 store 可保留为 dead code 待清理 |
| Intelligence Watchlist | **REMOVED** | 同上 |
| Intelligence Alert Evaluation | **REMOVED** | 同上 |
| Daily Intelligence Queue | **REMOVED** | 同上 |

### 2.3 现有 `predictarena-ui` spec 的 Delta（共 23 个 requirement）

| Requirement | 类别 | 说明 |
|---|---|---|
| War Room Prediction-Market Atmosphere | **MODIFIED** | 替换为新视觉 token（Editorial + Glass Neon） |
| Generated Visual Asset | PRESERVED | 视觉资产生成流程不变（用于 og:image 等） |
| Preserve Autonomous MVP Flow | PRESERVED | 自治流程不变 |
| Responsive Operational Layout | **MODIFIED** | 重新定义断点和优先级 |
| Autonomy Panel UI | **MODIFIED** | 入口从顶 nav 移到 `/agents` 内部子模块 |
| Agent Control Room / Arc Readiness Panel | **MODIFIED** | 迁移到 `/admin/control-room` |
| Signal Decision Trace | PRESERVED | 信号详情页保留 |
| Commit Queue UI | **MODIFIED** | 集成到新 Arena 页"Pending Showdowns"卡片组 |
| Hidden Admin Demo Resolution UI | **MODIFIED** | 路由从 `/demo-resolution` 改为 `/admin/resolution` |
| Autonomous Run Receipt UI | **MODIFIED** | 入口移到 `/admin/receipts` |
| Agent Reputation Profile UI | **MODIFIED** | 入口移到 `/agents/:id` 子路由 |
| Resolution Demo Script UI | **MODIFIED** | 迁移到 `/admin` |
| Judge Proof Pack UI | **MODIFIED** | 迁移到 `/admin/proof` |
| Operator Health UI | **MODIFIED** | 迁移到 `/admin/health` |
| Proof Smoke Controls UI | **MODIFIED** | 迁移到 `/admin/proof` |
| Market Intelligence Workspace UI | **REMOVED** | 公开入口删除 |
| Signal Research UI | **REMOVED** | 同上 |
| Segmented Agent Comparison UI | **REMOVED** | 数据入口移到 `/agents`（精简版） |
| Paper Follow UI | **REMOVED** | 公开入口删除 |
| Saved Intelligence Controls UI | **REMOVED** | 同上 |
| Watchlist UI | **REMOVED** | 同上 |
| Intelligence Alert Center UI | **REMOVED** | 同上 |
| Daily Research Queue UI | **REMOVED** | 同上 |

### 2.4 新增 Requirements（ADDED）

本次提案预计在 `specs/predictarena` 和 `specs/predictarena-ui` 中新增以下 requirement：

**predictarena 新增**：
- `Agent Showdown Lifecycle`（§3.3 / §4.4）
- `ShowdownArena Smart Contract`（§4.4）
- `Showdown Discovery and Commit Orchestration`（§4.5.1）
- `Wallet-Bound Data Aggregation`（§4.1）

**predictarena-ui 新增**：
- `Editorial Home Landing UI`（§5）
- `Glass Neon Arena UI`（§6）
- `Wallet-Bound /my Dashboard UI`（§7）
- `Admin-Only Operator Surface UI`（§3.2）

---

## 三、产品形态总览

### 3.1 信息架构

```
当前 (10 个公开 segment)          重设计 (4 公开 + 1 隐藏 admin)
─────────                          ────────────────
/ (redirect to arena)              / · Home (Editorial 着陆页)
/arena                             /arena · Live Showdowns
/signals                ─┐
/intelligence            ├──→     /agents · Agent Profiles + 历史
/agents                  │              └─ /agents/:id (子路由)
/autonomy               ─┘
/leaderboard            ─┐
/proof                   ├──→     /my · 钱包绑定数据（已连钱包可见）
/demo-resolution        ─┘
                                   /admin · 隐藏管理面（详见 §3.2）
                                       ├─ /admin/control-room
                                       ├─ /admin/resolution
                                       ├─ /admin/proof
                                       ├─ /admin/receipts
                                       └─ /admin/health
```

**4 个顶层公开角色**：

| 区 | 角色 | 主受众 |
|---|---|---|
| **/** | 30 秒钩子。讲清楚"是什么 + 为什么在 Arc" | Arc builder 评委、Twitter 路过者 |
| **/arena** | 主秀场。看 Showdown 实时对决 | 上述 + 想看 demo 的访客 |
| **/agents** | 深度页。每个 agent 画像 + 历史 + 声誉 | 想深入了解的研究者 |
| **/my** | 个人页。已连钱包后看自己 follows/bonds/tx | 已连接的用户 |

### 3.2 `/admin` 隐藏管理面

**访问控制**：不在公开 nav 中显示，仅通过直接 URL 访问。受 `ADMIN_ACCESS_TOKEN` 环境变量 + cookie 校验保护（沿用现有 demo-resolution 的访问机制）。

**子路由对应原页面**：

| 新 admin 路由 | 原来源 | 用途 |
|---|---|---|
| `/admin/control-room` | Agent Control Room / Arc Readiness Panel | 运营状态总览 |
| `/admin/resolution` | `/demo-resolution` | 手动结算 + demo script |
| `/admin/proof` | `/proof` | Judge Proof Pack + Proof Smoke |
| `/admin/receipts` | Autonomous Run Receipt UI | 自治 run 历史 |
| `/admin/health` | Operator Health UI | 系统健康指标 |

**不进入公开 nav，不进入 sitemap**。Showcase 用户不可见。

### 3.3 视觉风格混搭

| 区 | 风格 | 关键元素 |
|---|---|---|
| **/**（首页） | **Editorial Mono** | 深色 `#0c0c0c`；大标语 64px；橙红 `#ff5e3a` 单色点缀；等宽小字标签 |
| **/arena**, **/agents**, **/my** | **Glass Neon** | 玻璃拟态（`backdrop-filter: blur(20px)`）；紫青双色（`#7c5cff` + `#00d1ff`）；radial 渐变光晕 |
| **/admin** | **极简灰阶** | 深灰背景；无渐变；表格密度优先 |
| 通用 token | 字体 `-apple-system, system-ui`；行高 1.6-1.75；圆角 12-16px | |

### 3.4 Hook 01 · Agent Showdown 落地

**核心机制**：当两个 agent 在同一市场对同一问题给出方向相反的预测时，operator 服务端检测到，调用合约 `openShowdown` 原子开局，settle 时由 operator 触发。

详见 §4.4 和 §4.5。

---

## 四、组件与数据流

### 4.1 钱包绑定的数据模型

**核心原则**：钱包地址（lowercase）是用户身份的唯一锚点。无 KYC、无 email、无注册。

#### 4.1.1 数据结构（TypeScript）

```typescript
// lib/persistence/walletBindings.ts 新增

export interface WalletFollow {
  id: string;                    // UUID
  walletAddress: string;         // lowercase 0x...
  signalId: string;              // 外部 signal id
  marketId: string;
  side: 'YES' | 'NO';
  bondedMicroUsdc: bigint;       // 用户自费的 USDC（micro = 6 位小数）
  followTxHash: string;          // 跟单时的 Arc tx
  status: 'pending' | 'confirmed' | 'resolved-win' | 'resolved-loss';
  followedAt: string;            // ISO 时间
  resolvedAt: string | null;
  payoutMicroUsdc: bigint | null;
}

// 用户对 showdown 的"押其中一方赢"动作。
// v2 决策：本次范围内不实现用户押 showdown，故类型化为 never。
// 任何意外使用会在编译期报错，防止后续 schema 漂移。
// 实际可观察的 showdown 数据通过 §4.3 /api/showdowns 查询，不绑定到 wallet。
export type WalletShowdownStake = never;

export interface WalletTxHistoryItem {
  txHash: string;
  blockNumber: number;
  timestamp: string;
  kind: 'follow-commit' | 'follow-resolve' | 'wallet-self';
  // 'wallet-self' = 用户自己发起的非 PredictArena 关联 tx，从链上 RPC 拉取
  amountMicroUsdc: bigint | null;
  status: 'success' | 'failed';
  arcExplorerUrl: string;        // 预生成的浏览器链接
}

export interface WalletSummary {
  walletAddress: string;
  usdcBalanceMicro: bigint;      // 实时链上读取
  usdcAllowanceMicro: bigint;    // 对 SignalBondArena 的授权额度
  arcChainSynced: boolean;       // 是否在 Arc Testnet 上
  follows: WalletFollow[];       // 最近 50 条
  txHistory: WalletTxHistoryItem[]; // 最近 50 条
  cumulativeBondedMicro: bigint; // 累计跟过的 bond
  cumulativePayoutMicro: bigint; // 累计 payout
  currentNetPnlMicro: bigint;    // payout - bonded（包括 pending 估值=0）
}
```

#### 4.1.2 Facade 接口

```typescript
// lib/persistence/walletBindings.ts

export interface WalletBindingsFacade {
  // 写入跟单记录（add-wallet-funded-follows 已实现，本变更复用）
  recordFollow(input: Omit<WalletFollow, 'id' | 'followedAt' | 'status'>): Promise<WalletFollow>;

  // 查询单个钱包的全量数据（驱动 /my 页 + /api/wallet/:address/summary）
  getSummary(walletAddress: string): Promise<WalletSummary>;

  // 列出钱包的跟单记录（分页，最多 50）
  listFollows(walletAddress: string, opts?: { limit?: number; cursor?: string }): Promise<WalletFollow[]>;

  // 列出钱包关联的 tx（合并 follow tx + 从链上 RPC 拉取的钱包自身 tx）
  listTxHistory(walletAddress: string, opts?: { limit?: number }): Promise<WalletTxHistoryItem[]>;
}
```

**存储策略**：
- `WalletFollow` 持久化：现有 Supabase / 本地 JSON 双轨（来自 `add-wallet-funded-follows`），本变更不动
- `WalletTxHistoryItem`：**不持久化**，运行时从 Arc RPC 拉取（`getLogs` + 客户端钱包 `eth_getLogs`），合并 follow tx 后返回
- `WalletSummary`：聚合视图，每次 `/api/wallet/:address/summary` 调用时实时计算

**关键决策**：不引入新的数据库表，不引入用户表。钱包地址直接做查询 key。

### 4.2 核心组件（components/）

| 组件 | 状态 | 用途 |
|---|---|---|
| `WalletConnectButton.tsx` | **保留**，视觉调整 | 全站右上角，连 Arc Testnet |
| `arena-dashboard.tsx` | **重写**（见 §4.2.1） | 改为 Showdown 主战场 |
| `LeaderboardTable.tsx` | **保留**，迁移到 `/agents` | |
| `MetricsStrip.tsx` | **保留**，新增首页 data strip 变体 | |
| `PageShell.tsx` | **保留**，新增首页变体（Editorial） | |
| `ShowdownCard.tsx` | **新增** | Hook 01 的视觉主体 |
| `HomeHero.tsx` | **新增** | 首页第一屏 Editorial 大标语 |
| `HomeDataStrip.tsx` | **新增** | 首页 4 列实时数据条 |
| `AgentProfileCard.tsx` | **新增** | `/agents` 列表卡片 |
| `MyDashboard.tsx` | **新增** | `/my` 页根容器 |
| `AdminShell.tsx` | **新增** | `/admin/*` 的极简灰阶 shell |

#### 4.2.1 `arena-dashboard.tsx` 重写范围

**保留**：钱包连接状态、Run Agents 按钮、信号跟单按钮、Tx 链接、Commit eligible signals 按钮、Arc Readiness 指示。

**移除**：Market Radar 视觉、Watchlist 切换、Saved Filters、Alert Center、Paper Follow 卡片、Daily Queue 入口。

**新增**：Showdown 卡片网格（活跃 + 已结算）。

**结构**（伪代码）：
```
<ArenaDashboard>
  <ArenaTopBar />                  {/* 钱包状态 + Arc readiness */}
  <ArenaActionRow>                 {/* Run Agents / Commit / Refresh */}
  <ShowdownGrid>                   {/* 主区域：5 active + 15 settled */}
  <PendingFollowsRow />            {/* 用户已连钱包时显示 */}
</ArenaDashboard>
```

### 4.3 关键 API 变更

#### 4.3.1 新增端点

```typescript
// GET /api/showdowns
// Query: ?status=active|resolving|settled|all (default: active)
//        ?limit=20 (max 50)
// Response 200:
{
  showdowns: Array<{
    id: string;                       // bytes32 hex（合约里的 showdownId）
    onchainId: bigint;                // 合约自增 id（便于读取）
    marketId: string;
    marketQuestion: string;
    agentA: { address: string; name: string; side: 'YES' | 'NO'; probabilityBps: number; bondMicroUsdc: bigint };
    agentB: { address: string; name: string; side: 'YES' | 'NO'; probabilityBps: number; bondMicroUsdc: bigint };
    deadline: string;                 // ISO
    status: 'Open' | 'Resolving' | 'SettledA' | 'SettledB';
    openTxHash: string;
    settleTxHash: string | null;
    resolvedOutcome: 'YES' | 'NO' | null;
    resolvedPriceLabel: string | null; // 例 "ETH closed at $5,032"
  }>;
  nextCursor: string | null;
}

// POST /api/showdowns/discover
// Body: (none)
// 由 cron 或 admin 触发。扫描当前活跃 signals，检测有效对手对，提交 openShowdown。
// Response 200: { discovered: number; opened: number; skippedReasons: string[] }
// 受 ADMIN_ACCESS_TOKEN 保护（不公开）

// POST /api/showdowns/:id/settle
// Path: id = uint256 onchainId（合约自增 id），不是 bytes32 externalId
// 由 cron 或 admin 触发。检查 showdown 是否已到 deadline 且有 resolution 结果，调用合约 settleShowdown。
// Response 200: { settled: boolean; winner: 'A' | 'B' | null; txHash: string | null }
// 受 ADMIN_ACCESS_TOKEN 保护

// GET /api/wallet/:address/summary
// Path: address = 0x...（不区分大小写，内部归一化为 lowercase）
// Response 200: WalletSummary (见 §4.1.1)
// 公开端点，无需鉴权（数据本来就在链上）
```

#### 4.3.2 现有端点保持

- 所有 `add-wallet-funded-follows` 已实现端点不动
- `/api/commit-signal` 保持禁用
- `/api/run-agents`、`/api/markets`、`/api/leaderboard` 等读模型 API 不动

### 4.4 ShowdownArena 智能合约

#### 4.4.1 合约决策（v2 锁定）

**新合约 `contracts/ShowdownArena.sol`**，不扩展 `SignalBondArena.sol`。

理由：
- `SignalBondArena` 已部署且承载现有 signal bonds，扩展风险大
- 状态机不同（signal = 单边 bond；showdown = 双边对局）
- 测试隔离更清晰
- 部署后两个合约地址独立，运维更安全

#### 4.4.2 合约状态机

```
┌──────────┐  openShowdown   ┌──────┐  settleShowdown  ┌───────────┐
│ (none)   │ ───────────────→│ Open │ ────────────────→│ SettledA  │
└──────────┘  (atomic)       └──────┘  (operator)     └───────────┘
                                │
                                │ settleShowdown(B wins)
                                ↓
                            ┌───────────┐
                            │ SettledB  │
                            └───────────┘
```

**没有 Pending 状态。没有 Cancelled 状态。** 因为 `openShowdown` 是 operator 调用的单笔原子交易：要么两边的 bond 都成功转入合约、Showdown 进入 Open；要么交易 revert，链上无任何记录。

#### 4.4.3 合约接口（关键摘录）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

contract ShowdownArena {
    enum Status { None, Open, SettledA, SettledB }

    struct Showdown {
        uint256 id;
        bytes32 externalId;          // 服务端生成的稳定 id（uuid hash）
        string marketId;
        string marketQuestion;
        address agentA;
        string agentNameA;
        bool sideAYes;               // A 持 YES 时 true
        uint16 agentAProbabilityBps;
        address agentB;
        string agentNameB;
        // (B side 必然与 A 相反，无需 bool)
        uint16 agentBProbabilityBps;
        uint256 bondPerSideMicroUsdc;
        uint64 deadline;
        uint64 openedAt;
        uint64 settledAt;
        Status status;
    }

    IERC20 public immutable usdc;
    address public owner;            // operator 钱包
    address public treasury;
    uint256 public showdownCount;
    mapping(uint256 => Showdown) public showdowns;
    mapping(bytes32 => uint256) public externalIdToId;

    event ShowdownOpened(
        uint256 indexed showdownId,
        bytes32 indexed externalId,
        string marketId,
        address indexed agentA,
        bool sideAYes,
        address agentB,
        uint256 bondPerSideMicroUsdc,
        uint64 deadline
    );

    event ShowdownSettled(
        uint256 indexed showdownId,
        Status indexed result,        // SettledA or SettledB
        address indexed winner,
        uint256 payoutMicroUsdc
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    constructor(address usdcAddress, address treasuryAddress) {
        require(usdcAddress != address(0) && treasuryAddress != address(0));
        usdc = IERC20(usdcAddress);
        owner = msg.sender;
        treasury = treasuryAddress;
    }

    /// 原子开局：operator 调用，必须事先持有两边 agent 的 USDC approval。
    /// 一笔 tx 内完成：transferFrom(agentA) + transferFrom(agentB) + 记录 + emit。
    function openShowdown(
        bytes32 externalId,
        string calldata marketId,
        string calldata marketQuestion,
        address agentA,
        string calldata agentNameA,
        bool sideAYes,
        uint16 agentAProbabilityBps,
        address agentB,
        string calldata agentNameB,
        uint16 agentBProbabilityBps,
        uint256 bondPerSideMicroUsdc,
        uint64 deadline
    ) external onlyOwner returns (uint256 showdownId);

    /// operator 在 resolution engine 给出 YES/NO 结果后调用。
    /// agentAWins = (resolved outcome == agentA's side)
    function settleShowdown(uint256 showdownId, bool agentAWins) external onlyOwner;

    /// View 函数：返回 showdown 完整结构（discovery 算法用，避免依赖 auto-getter）。
    function getShowdown(uint256 showdownId) external view returns (Showdown memory);

    /// View 函数：根据 externalId 查询 onchainId（discovery 算法防重用）。
    function lookupByExternalId(bytes32 externalId) external view returns (uint256);
}
```

**关键不变式**：
- `bondPerSideMicroUsdc > 0`
- `agentA != agentB`
- `deadline > openedAt`
- 同一 `externalId` 不能开两次（`externalIdToId[externalId] == 0` 才能开）
- `settleShowdown` 只能对 `Status.Open` 调用
- 赢家 payout = `bondPerSideMicroUsdc * 2`，转给 winner 地址；输家 bond 已经在合约内，转出后合约余额为 0
- 重入保护：使用 checks-effects-interactions 顺序（先改 status，再 transfer）。不需要 ReentrancyGuard，但合约里转 ERC20 之前必须先写状态

#### 4.4.4 与 Autonomous Agent Policy 的关系

现有 `Autonomous Agent Policy` 规定每个 agent 有 daily / per-signal USDC 预算上限。Showdown commit 走的是**同一个 agent 钱包**，因此：

- `openShowdown` 前，operator 必须检查两个 agent 各自的剩余预算 ≥ `bondPerSideMicroUsdc`
- 检查失败 → 跳过这次 showdown，记录 skip reason
- 成功 → 在调用 `openShowdown` 后立即在持久化层 deduct 双方预算
- 预算扣减与链上 commit 是分离的两步（链上成功后才扣减）

详见 §4.5.1 discovery 流程。

### 4.5 Showdown 服务端编排

#### 4.5.1 Discovery 流程（detection + open）

**触发器**：
- 自动：`Autonomous Cron Runner` 每个周期跑完 `run-agents` 后调用 `POST /api/showdowns/discover`
- 手动：admin 在 `/admin/control-room` 点击 "Discover Showdowns" 按钮

**算法**（伪代码）：
```
for each marketId in 当前有活跃 signal 的市场:
  signals = get active signals for marketId
  pairs = []
  for each (agentX, agentY) 组合 where agentX.side != agentY.side:
    if (agentX, agentY) 已有未结算 showdown for this marketId: skip
    if 任一 agent 的剩余预算 < bondPerSide: skip-budget
    pairs.append((agentX, agentY))
  
  if pairs.length == 0: skip-no-pair
  // 同一市场最多 1 个 showdown（N>2 agents 时只取置信度差最大的对）
  // 排序键：|probabilityA - probabilityB| 降序
  // Tie-break: 较低 agent 地址（lexicographic）的 pair 优先，保证确定性
  selected = pairs.sortedBy([
    (p) => -Math.abs(p.agentX.probability - p.agentY.probability),  // 主键：差值降序
    (p) => min(p.agentX.address, p.agentY.address).toLowerCase()    // 次键：地址升序
  ]).first
  externalId = keccak256(marketId || agentA || agentB || now)
  txHash = await ShowdownArena.openShowdown(...)
  deduct budgets in persistence
  log: discovered → opened
```

**幂等性**：复用 `Cron Idempotency and Autonomous Run Locking` 的同一把锁，防止同一个 showdown 被开两次。

#### 4.5.2 Settle 流程

**触发器**：
- 自动：`Autonomous Cron Runner` 每个周期检查所有 `Open` 状态且 `deadline < now` 的 showdown
- 手动：admin 在 `/admin/control-room` 触发

**算法**：
```
for each showdown where status == Open && deadline < now:
  resolution = await ResolutionEngine.resolveMarket(showdown.marketId, showdown.deadline)
  if resolution == null:
    skip-no-data (retry next cycle)
    // 若 (now - showdown.deadline) > 24h, 额外记录 stuck flag 用于 admin 告警
    if (now - showdown.deadline) > 24h: log-stuck-flag
    continue
  agentAWins = (resolution.outcomeYes == showdown.sideAYes)
  txHash = await ShowdownArena.settleShowdown(showdown.onchainId, agentAWins)
  update persistence: status, settleTxHash, resolvedOutcome, resolvedPriceLabel
```

#### 4.5.3 Resolution → Winner 映射规则

```
showdown.sideAYes = true:
  outcomeYes = true  → agentAWins = true  → SettledA
  outcomeYes = false → agentAWins = false → SettledB

showdown.sideAYes = false:
  outcomeYes = true  → agentAWins = false → SettledB
  outcomeYes = false → agentAWins = true  → SettledA
```

**约束**：showdown 开局时合约 enforces `sideAYes != sideBYes`，所以一定有唯一赢家。

---

## 五、首页详细设计

### 5.1 第一屏（above the fold）

```
┌────────────────────────────────────────────────────────┐
│ PREDICTARENA          HOME ARENA AGENTS MY    [● CONNECT]│
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ LIVE ON ARC TESTNET · BLOCK 8,412,390                  │
│                                                        │
│ AI agents,                                             │
│ betting with proof.                                    │
│                                                        │
│ Autonomous AI agents make BTC/ETH/SOL price            │
│ predictions, post USDC bonds on Arc, and resolve       │
│ on-chain. Watch them disagree, bet against each        │
│ other, and pay the price.                              │
│                                                        │
│ ──────────────────────────────────────────────────     │
│ ACTIVE SIGNALS | USDC BONDED | ACCURACY | SHOWDOWNS    │
│      12        |   24,580    |  68.4%   |     47       │
│ ↗ 3 in 1hr     | ↗ +1.2k 24h | ↗ +2.1pp | Vol leads    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**实现细节**：
- 大标语：`<h1>` italic 部分用 `<em>`，文案锁定为 `"AI agents, betting with proof."`
- 数据条：SWR 客户端 fetcher，`revalidateOnFocus: true`，`refreshInterval: 30000`（30 秒）
- 顶部 nav：4 项 + 右侧 Connect Wallet。**未连接钱包时 `MY` 项仍可见但点击跳到 wallet connect**
- "LIVE ON ARC TESTNET · BLOCK xxx"：从 `useArcChainSync()` 实时读取最新 block number

### 5.2 第二屏（叙事 + CTA）

两栏布局：左 "The Premise"（项目主张），右 "How to Watch"（怎么玩）。

文案锁定（v2）：
- **The Premise** 段落 1：
  > Most prediction markets ask *humans* to bet. PredictArena asks *algorithms* to bet — and forces them to back their conviction with USDC bonds on Arc.
- **The Premise** 段落 2：
  > When two agents disagree, they fight on-chain. The winner takes the loser's bond. Track records, transaction hashes, and resolution proofs are all on-chain. There's nowhere to hide.
- **How to Watch**：
  > → Visit *Arena* to watch live agent showdowns settle on Arc.
  > → Visit *Agents* to study each AI's track record and segment reputation.
  > → Connect wallet to enter *My* — track signals you followed, your bonds, your tx history.

---

## 六、Arena 页详细设计

### 6.1 Showdown 卡片视觉

详见 mockup（`docs/superpowers/specs/...` 下未来附图）。卡片关键字段：

**Open 状态**：
- 顶部市场问题 + ⚔ SHOWDOWN tag
- 左侧 agent A（YES 边）：probability、bond、side label
- 中部 VS 区
- 右侧 agent B（NO 边）：同样字段
- 底部：openTxHash + 截止时间

**Settled 状态**：
- 顶部市场问题 + ✓ RESOLVED tag（绿色）
- 双侧加 `+ X USDC` / `- X USDC` 标签
- 底部：settleTxHash + 结算结果文案（`"ETH closed at $5,032"`）

### 6.2 列表组织

- 顶部标题：`Live Showdowns` + 副标题 `N active · M resolving · Block X`
- 中部：活跃 showdown 卡片（按 deadline 升序）
- 下部：折叠的"已结算 showdown"，默认展开最近 5 个，点击 "Show more" 加载下 15 个
- **上限 50 张**（5 active + 45 settled），更多走 `/agents` 看个体历史
- 超过上限：底部显示 `View 100+ settled showdowns →` 跳到 `/agents`（不分页）

### 6.3 用户已连钱包时的额外区

钱包已连接时，Arena 页顶部 nav 下方多一行 `My Active Follows`：显示用户当前还未结算的跟单（最多 3 个 chip），点击跳 `/my`。

---

## 七、`/my` 页（钱包绑定数据中心）

### 7.1 未连钱包状态

整页只显示一个大的 Connect Wallet 引导卡 + 一句话说明。不显示任何空 state 卡片占位。

### 7.2 已连钱包状态

按以下顺序展示 3 个 section（**Section 2.4 / v1 中的 "Agent I Watch" 已删除**）：

1. **Overview Strip** — 当前 USDC balance、累计 bonded、累计 payout、当前净 PnL
2. **My Follows** — 我跟过的信号列表（最多 50 条），按 followedAt 倒序。每行：market question / side / bonded USDC / status badge / Arc explorer link
3. **Tx History** — 钱包关联 tx 列表（最多 50 条），按时间倒序。每行：tx hash（链接）/ kind label / amount / block / status

**钱包地址切换监听**：在 `WalletConnectButton` 内部使用 `useEffect` 订阅 EIP-1193 `accountsChanged` 事件。触发后调用 SWR 的 global mutate 清空所有钱包绑定缓存：

```typescript
import { mutate } from 'swr';
// 清空所有以 /api/wallet/ 开头的 cache key，不立即 revalidate，让组件下次挂载时拉
mutate(
  (key) => typeof key === 'string' && key.startsWith('/api/wallet/'),
  undefined,
  { revalidate: false }
);
```

然后 `router.push('/my')` 重新进入页面，新地址数据按需加载。

### 7.3 数据获取

页面初始化：`GET /api/wallet/:address/summary` 一次性拿全部数据。
后续：每 60 秒静默 revalidate。

---

## 八、错误处理与边界情况

| 场景 | 处理 |
|---|---|
| 用户没有钱包 | Connect Wallet 按钮变 `Install wallet`，点击跳 MetaMask 下载页 |
| 用户在错误链上 | 按钮变 `Switch to Arc`，点击触发 `wallet_switchEthereumChain` |
| `openShowdown` revert（任一边 transferFrom 失败） | 整笔 tx 失败，链上无记录；服务端记录 `open-failed` 日志，retry next cron cycle |
| `settleShowdown` resolution 数据缺失 | Showdown 保持 Open，每个 cron cycle 重试；超 24h 后日志标 `stuck`，admin 手动介入 |
| `/my` 钱包数据加载失败 | 显示"链上数据获取中"占位符，不显示假数据；3 次重试后显示 error toast |
| 用户切换钱包地址 | `accountsChanged` 事件 → 全站 SWR cache 清空 → 重定向到 `/my` 重新加载 |
| Arena 上同一市场两个 agent 同侧 | discovery 不开 showdown，记录 skip reason `same-side` |
| 同一市场 N>2 agents 多方观点 | 只取置信度差最大的对（详见 §4.5.1） |
| 同一对 agent 在同一市场已有 Open showdown | discovery skip，reason `existing-open` |
| Agent 预算不足 | discovery skip，reason `budget-exhausted` |
| Operator 钱包 ETH 余额不足支付 gas | discovery skip，reason `operator-gas-low`，触发 admin 告警 |

---

## 九、测试策略

| 层 | 工具 | 覆盖范围 | 验收阈值 |
|---|---|---|---|
| 单元测试 | vitest | `lib/persistence/walletBindings.ts`、showdown discovery 算法、resolution mapping、WalletSummary 聚合 | 每个核心函数 ≥ 1 happy + 1 error |
| 合约测试 | hardhat | `ShowdownArena.sol` 的 openShowdown / settleShowdown / 不变式 / 重入 / 权限 | 100% branch coverage |
| 集成测试 | vitest + jsdom | `ShowdownCard.tsx`、`HomeHero.tsx`、`MyDashboard.tsx`、wallet connection 流程 | 每组件 ≥ 1 渲染 + 1 交互 |
| E2E | playwright | 关键流程：访问 / → 看 Arena → 连钱包 → 看 /my | 3 个 happy path scenarios |

**每个 task 在 tasks.md 中必须显式声明它对应的测试。**

---

## 十、Project 2 · OracleArena（仅作记录，不在本次实现）

**定位**：Arc 原生众包预测结算 oracle。任何人提交"resolve this market" → Arc 上 USDC 持有者押注投票 → 多数派赢，少数派输 bond → 结果上链。
**与 PredictArena 关系**：PredictArena 成为 OracleArena 的第一个消费者（自动用 OracleArena 结算 showdown）。
**实施时机**：本次 redesign 完成、PredictArena 部署上线后另起 OpenSpec 提案，独立 subdomain。

---

## 十一、范围边界（YAGNI）

**显式不在本次范围内**：

- ❌ Hook 02 Signal NFT
- ❌ Hook 03 Proof-of-Prediction（commit-reveal）
- ❌ Hook 04 Signal Subscription
- ❌ "Agent I Watch" 功能（v1 草稿删除）
- ❌ 用户押 showdown（`WalletShowdownStake` 仅占位）
- ❌ 多账号体系 / KYC / email
- ❌ 暗色模式以外的 theme 切换
- ❌ i18n（中文注释 + 英文 UI）
- ❌ 真正的去信任化 oracle
- ❌ 移动端原生 app
- ❌ Project 2 OracleArena 的任何实现
- ❌ 老的 `/intelligence` 路由相关 UI（保留 read model）
- ❌ Showdown 取消/撤回机制（原子开局，无需取消）

**响应式**：核心页面在 768px 以下保持可读（不堆栈崩溃），但不做专门的移动 UX。

---

## 十二、实施分期

**前置条件（不计入本次分期）**：
- 归档 `add-wallet-funded-follows`（合并 delta 到 `specs/`，跑 `openspec validate --strict`）

| 阶段 | 内容 | 预计 |
|---|---|---|
| **1. IA 重组** | 新路由结构、PageShell 改造、nav 收敛到 4 项、admin 路由骨架 | 1.5 天 |
| **2. 首页** | HomeHero + HomeDataStrip + 叙事段落 | 1 天 |
| **3. Arena 重构** | ShowdownCard + arena 页面重写（去掉 intelligence/watchlist 等） | 1.5 天 |
| **4. Hook 01 合约** | ShowdownArena.sol + 100% branch coverage 合约测试 | 1 天 |
| **5. Hook 01 接入** | discovery 算法 + settle 算法 + 3 个新 API endpoint + cron 接入 | 1.5 天 |
| **6. /my 页面** | walletBindings facade + 钱包绑定数据聚合 + 3 section UI | 1 天 |
| **7. /agents 页面** | 从现有 leaderboard + reputation read model 迁移 | 1 天 |
| **8. /admin 路由** | 把 control-room / proof / resolution / receipts / health 迁到 admin 子树 | 0.5 天 |
| **9. 视觉细节 + E2E** | 颜色 token、间距、playwright 用例 | 1 天 |
| **10. 部署** | 生产环境部署 + ShowdownArena 部署到 Arc Testnet | 0.5 天 |

**总计**：约 10.5 工程日。压缩到 2-3 周（含三方审查）。

---

## 十三、所有决策已锁定 ✅

v2 修订完成后，无任何 ⏳ 待决项。详见 §1.3 决策表。

---

## 附录 A · 视觉混搭风险与对策

**风险**：首页 Editorial 风格 + 内页 Glass Neon 风格的切换可能让用户觉得"两个站"。

**对策**：
- 共享 nav header（同样的 logo / 同样的字体）
- 共享 wallet button 设计语言（橙红 active / 紫青 connected）
- 首页底部加一条过渡条："Enter Arena →"，视觉从黑底切到 glass 渐变
- 关键 token（圆角、字体、行高）跨风格统一

## 附录 B · ShowdownArena 部署清单

1. 在 Arc Testnet 部署 `ShowdownArena.sol`
2. 部署后给 owner 钱包写入 contract address：`NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS`
3. 给两个 agent 钱包对 ShowdownArena 做 USDC `approve(MAX_UINT256)`
4. 在 `lib/contracts/` 下添加 ShowdownArena typed client
5. 配置 cron 在 `run-agents` 后调用 discovery

## 附录 C · 与 Codex 实施者的契约

本设计文档完成 spec review 后，将作为 **codex-handoff** 上下文包的核心组成。Codex 收到的指令将明确：
- 严格按本文档 §4.1-4.5 实现，不自创 schema 或 endpoint
- §4.4 合约接口为最低契约，可加 view 函数和 event，但不可改字段名/参数顺序
- §2.2-2.3 的 Spec Delta Map 直接对应 OpenSpec proposal 的 spec deltas，按表逐条产出
- §9 测试策略对应 tasks.md 中每个 task 的验收条件
