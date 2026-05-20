import { ethers } from 'hardhat';

const DEFAULT_USDC = '0x3600000000000000000000000000000000000000';

async function main() {
  const treasury = process.env.ARC_TREASURY_ADDRESS;
  if (!treasury) {
    throw new Error('Missing ARC_TREASURY_ADDRESS');
  }

  const arenaFactory = await ethers.getContractFactory('SignalBondArena');
  const arena = await arenaFactory.deploy(process.env.ARC_USDC_ADDRESS ?? DEFAULT_USDC, treasury);
  await arena.waitForDeployment();

  console.log('SignalBondArena deployed to:', await arena.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
