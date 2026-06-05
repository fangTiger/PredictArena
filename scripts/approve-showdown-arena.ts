import hre from 'hardhat';

const erc20Abi = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
] as const;

interface AgentApprovalTarget {
  label: string;
  privateKeyEnv: 'VOL_AGENT_PRIVATE_KEY' | 'MOMENTUM_AGENT_PRIVATE_KEY';
}

const AGENTS: AgentApprovalTarget[] = [
  { label: 'volatility', privateKeyEnv: 'VOL_AGENT_PRIVATE_KEY' },
  { label: 'momentum', privateKeyEnv: 'MOMENTUM_AGENT_PRIVATE_KEY' }
];

function readAddressEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} env var required`);
  }
  if (!hre.ethers.isAddress(value)) {
    throw new Error(`${name} must be an EVM address`);
  }
  return value;
}

function readPrivateKeyEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} env var required`);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed private key`);
  }
  return value;
}

async function approveAgent({
  label,
  privateKeyEnv,
  showdownArenaAddress,
  usdcAddress
}: AgentApprovalTarget & {
  showdownArenaAddress: string;
  usdcAddress: string;
}) {
  const wallet = new hre.ethers.Wallet(
    readPrivateKeyEnv(privateKeyEnv),
    hre.ethers.provider
  );
  const usdc = new hre.ethers.Contract(usdcAddress, erc20Abi, wallet);
  const currentAllowance = (await usdc.allowance(
    wallet.address,
    showdownArenaAddress
  )) as bigint;

  if (currentAllowance === hre.ethers.MaxUint256) {
    console.log(`[approve] ${label} ${wallet.address}: already max`);
    return;
  }

  console.log(
    `[approve] ${label} ${wallet.address}: current=${currentAllowance.toString()} approving max`
  );
  const tx = await usdc.approve(showdownArenaAddress, hre.ethers.MaxUint256);
  console.log(`[approve] ${label} tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[approve] ${label} confirmed in block ${receipt?.blockNumber}`);
}

async function main() {
  const showdownArenaAddress = readAddressEnv('NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS');
  const usdcAddress = readAddressEnv('ARC_USDC_ADDRESS');
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);

  console.log(`[approve] network=${hre.network.name} chainId=${chainId}`);
  console.log(`[approve] usdc=${usdcAddress}`);
  console.log(`[approve] spender=${showdownArenaAddress}`);

  for (const agent of AGENTS) {
    await approveAgent({
      ...agent,
      showdownArenaAddress,
      usdcAddress
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
