# PredictArena Deployment Notes

## Arc Testnet ShowdownArena

Deployment date: 2026-06-05

| Field | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| ShowdownArena | `0xC05b100D0439819666a02D7aa7dCa1Fc5FE5fA07` |
| USDC | `0x3600000000000000000000000000000000000000` |
| Treasury | `0x81d48d2c5D0744e8eF7A5c35cDceB0A27A1c707B` |
| Deployer | `0x81d48d2c5D0744e8eF7A5c35cDceB0A27A1c707B` |
| Deploy tx | `0xb0a97368e7ef4d5bb431937da33216b013de7a9433dd68438f7905c56b4ae0c5` |
| Deploy block | `45599732` |

Local env after deployment:

```env
NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS=0xC05b100D0439819666a02D7aa7dCa1Fc5FE5fA07
```

## Agent USDC Approvals

Both agent wallets approved `ShowdownArena` for max USDC allowance on Arc Testnet.

| Agent | Wallet | Approve tx | Block |
| --- | --- | --- | --- |
| Volatility | `0xf87f514d19Bf89833e87e8d9dDD0c7cFb80a1a98` | `0x59efe91d1180dbb281fd44e22c1bf545b008ee1b4dd2b48398e4bfe44660f50c` | `45600058` |
| Momentum | `0xeb3bA4697567E46A2D816fe7aA5B5670f1c1fb0D` | `0xe7013e187ed881329484a64a2533755741df7c6330b5b52a4bf6e242b4ea5412` | `45600063` |

The approval helper is idempotent:

```bash
set -a
source .env.local
set +a
npx hardhat run scripts/approve-showdown-arena.ts --network arcTestnet
```
