# 变更：新增自费钱包跟随信号

## 为什么
PredictArena 目前只有服务端自治/证明提交路径，公开 `/api/commit-signal` 按安全规范保持禁用。用户希望通过浏览器插件主动连接钱包，用自己的 Arc Testnet USDC 自费跟随合格信号，同时保持操作简约。

## 变更内容
- 新增浏览器插件钱包连接与 Arc Testnet 自费跟随信号流程。
- 新增 wallet follow receipt 确认接口，服务端只做链上 receipt/log 只读验证与落库。
- 自费跟随记录独立于 agent commit，不改变 agent leaderboard、agent reputation、自治预算或 proof 预算。
- 默认首页直接进入 `/arena`，让钱包自费跟随成为首屏核心流程。
- `Run Agents` 生成信号后自动选择一个当前用户钱包尚未跟随的合格信号，并触发同一套连接、切链、授权、提交、确认流程。
- `/arena` 资金状态只展示当前连接用户钱包的 USDC balance/allowance，不展示 agent/operator 钱包余额作为前台操作依据。
- 保持公开服务端钱包花钱路径禁用，不暴露任何服务器私钥。

## 影响范围
- 受影响的规范：`predictarena`、`predictarena-ui`
- 受影响的代码：`components/arena-dashboard.tsx`、`app/signals/[id]/page.tsx`、`app/api/wallet/follows/route.ts`、`lib/arc/*`、`lib/persistence/*`、相关测试
