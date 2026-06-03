# 设计：自费钱包跟随信号

## 决策
第一版采用轻量自费跟随，不引入用户排行榜、账户页或复杂历史筛选。用户通过浏览器插件连接钱包，在 `/arena` 对合格信号执行 `Follow with Wallet`。前端负责请求账户、切换或添加 Arc Testnet、读取 USDC balance/allowance、发起 `approve` 和 `SignalBondArena.commitSignal`。服务端只接收交易哈希并读取 Arc receipt，验证 `SignalCommitted` 事件字段与本地信号一致后保存 wallet follow 记录。

## 状态模型
新增 `WalletFollowRecord`，按 `signalId + walletAddress + txHash` 记录自费跟随。它不写入 `AgentSignal.arcTxHash`，不改变 `SignalStatus`，不计入 `ArenaMetrics.committedSignals` 或 leaderboard 的 bonded/refunded/slashed 指标。信号卡和详情页只展示跟随数量、最近 tx、当前连接钱包是否已跟随。

## 安全边界
`/api/commit-signal` 保持 `public_commit_disabled`。新增确认接口不发送交易、不选择私钥、不接受任意字段作为可信事实；必须从链上 receipt 解码 `SignalCommitted` 并比对 signal id、market id、agentName、side、price/probability/confidence/edge、stake、modelHash、dataHash 和 follower address。验证失败时返回机器可读原因且不落库。

## UI 方向
保持现有 war-room 风格，只加一个紧凑钱包状态条和信号卡里的单一主按钮。状态文案限制为未连接、链错误、余额不足、需授权、提交中、已跟随。避免新增用户页、排行榜或复杂表格。
