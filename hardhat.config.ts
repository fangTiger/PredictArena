import { fileURLToPath } from 'node:url';
import { HardhatUserConfig, subtask } from 'hardhat/config.js';
import '@nomicfoundation/hardhat-toolbox';
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from 'hardhat/builtin-tasks/task-names.js';

const solcJsPath = fileURLToPath(new URL('./node_modules/solc/soljson.js', import.meta.url));

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async () => ({
  version: '0.8.26',
  longVersion: '0.8.26+commit.8a97fa7a',
  compilerPath: solcJsPath,
  isSolcJs: true
}));

const config: HardhatUserConfig = {
  solidity: '0.8.26',
  paths: {
    tests: './test/contracts',
    cache: './cache/hardhat'
  }
};

export default config;
