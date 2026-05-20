import { ethers } from 'hardhat';

const ARC_TESTNET_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

async function main() {
  const vaultFactory = await ethers.getContractFactory('SignalBondVault');
  const vault = await vaultFactory.deploy(ARC_TESTNET_USDC_ADDRESS, 3600);
  await vault.waitForDeployment();

  console.log('SignalBondVault deployed to:', await vault.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
