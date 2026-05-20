import { fileURLToPath } from 'node:url';
import { HardhatUserConfig, subtask } from 'hardhat/config.js';
import '@nomicfoundation/hardhat-toolbox';
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from 'hardhat/builtin-tasks/task-names.js';

const ARC_TESTNET_CHAIN_ID = 5_042_002;
const ARC_TESTNET_RPC_URL = 'https://rpc.testnet.arc.network';
const solcJsPath = fileURLToPath(new URL('./node_modules/solc/soljson.js', import.meta.url));
const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY?.trim();

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async () => ({
  version: '0.8.26',
  longVersion: '0.8.26+commit.8a97fa7a',
  compilerPath: solcJsPath,
  isSolcJs: true
}));

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.26',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  paths: {
    tests: './test/contracts',
    cache: './cache/hardhat'
  },
  networks: {
    arcTestnet: {
      url: process.env.ARC_RPC_URL ?? ARC_TESTNET_RPC_URL,
      chainId: ARC_TESTNET_CHAIN_ID,
      accounts: adminPrivateKey ? [adminPrivateKey] : []
    }
  }
};

export default config;
