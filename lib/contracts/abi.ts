export const erc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  }
] as const;

export const signalBondVaultAbi = [
  {
    type: 'function',
    name: 'commitSignal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'signalId', type: 'string' },
      { name: 'marketId', type: 'string' },
      { name: 'buyYes', type: 'bool' },
      { name: 'confidenceBps', type: 'uint16' },
      { name: 'bondAmount', type: 'uint256' },
      { name: 'commitmentHash', type: 'bytes32' }
    ],
    outputs: [{ name: 'commitmentId', type: 'uint256' }]
  }
] as const;
