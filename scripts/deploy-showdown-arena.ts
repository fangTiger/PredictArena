import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import hre from 'hardhat';

const DEPLOYMENT_FILE = '.codex/showdown-arena-deployment.json';

interface DeploymentRecord {
  address: string;
  txHash: string;
  blockNumber: number;
  chainId: number;
  networkName: string;
  deployer: string;
  usdcAddress: string;
  treasuryAddress: string;
  timestampIso: string;
}

function readExistingDeployment(): DeploymentRecord | null {
  if (!existsSync(DEPLOYMENT_FILE)) {
    return null;
  }

  return JSON.parse(readFileSync(DEPLOYMENT_FILE, 'utf8')) as DeploymentRecord;
}

async function main() {
  const usdcAddress = process.env.USDC_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS;

  if (!usdcAddress) {
    throw new Error('USDC_ADDRESS env var required');
  }
  if (!treasuryAddress) {
    throw new Error('TREASURY_ADDRESS env var required');
  }

  const forceRedeploy = process.env.FORCE_REDEPLOY === '1';
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const networkName = hre.network.name;
  const existing = readExistingDeployment();

  if (existing && !forceRedeploy && existing.chainId === chainId) {
    console.log(`[deploy] existing deployment found for chainId=${chainId}, skipping.`);
    console.log(`[deploy] address: ${existing.address}`);
    console.log(`SHOWDOWN_ARENA_ADDRESS=${existing.address}`);
    console.log('[deploy] set FORCE_REDEPLOY=1 to redeploy.');
    return;
  }

  if (existing && existing.chainId !== chainId) {
    console.log(
      `[deploy] existing record chainId=${existing.chainId}, current chainId=${chainId}; deploying new record.`
    );
  }

  console.log(`[deploy] network=${networkName} chainId=${chainId}`);
  console.log(`[deploy] deployer=${deployer.address}`);
  console.log(`[deploy] usdc=${usdcAddress} treasury=${treasuryAddress}`);

  const ShowdownArena = await hre.ethers.getContractFactory('ShowdownArena');
  const arena = await ShowdownArena.deploy(usdcAddress, treasuryAddress);
  const deployTx = arena.deploymentTransaction();
  if (!deployTx) {
    throw new Error('no deployment transaction');
  }

  console.log(`[deploy] tx sent: ${deployTx.hash}`);

  const receipt = await deployTx.wait();
  if (!receipt) {
    throw new Error('no deployment receipt');
  }

  await arena.waitForDeployment();
  const address = await arena.getAddress();

  const record: DeploymentRecord = {
    address,
    txHash: deployTx.hash,
    blockNumber: receipt.blockNumber,
    chainId,
    networkName,
    deployer: deployer.address,
    usdcAddress,
    treasuryAddress,
    timestampIso: new Date().toISOString()
  };

  mkdirSync(dirname(DEPLOYMENT_FILE), { recursive: true });
  writeFileSync(DEPLOYMENT_FILE, JSON.stringify(record, null, 2) + '\n', 'utf8');

  console.log(`[deploy] ShowdownArena deployed at: ${address}`);
  console.log(`[deploy] block: ${receipt.blockNumber}`);
  console.log(`[deploy] record written to ${DEPLOYMENT_FILE}`);
  console.log(`SHOWDOWN_ARENA_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
