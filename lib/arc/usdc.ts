export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
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
  }
] as const;

export async function readUsdcBalance({
  publicClient,
  ownerAddress,
  usdcAddress
}: {
  publicClient: {
    readContract: (...args: any[]) => Promise<unknown>;
  };
  ownerAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
}): Promise<bigint> {
  return (await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [ownerAddress]
  })) as bigint;
}

export async function readUsdcAllowance({
  publicClient,
  ownerAddress,
  spender,
  usdcAddress
}: {
  publicClient: {
    readContract: (...args: any[]) => Promise<unknown>;
  };
  ownerAddress: `0x${string}`;
  spender: `0x${string}`;
  usdcAddress: `0x${string}`;
}): Promise<bigint> {
  return (await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [ownerAddress, spender]
  })) as bigint;
}

export async function ensureUsdcAllowance({
  publicClient,
  walletClient,
  ownerAddress,
  spender,
  usdcAddress,
  amount
}: {
  publicClient: {
    readContract: (...args: any[]) => Promise<unknown>;
    waitForTransactionReceipt: (...args: any[]) => Promise<unknown>;
  };
  walletClient: {
    writeContract: (...args: any[]) => Promise<`0x${string}`>;
  };
  ownerAddress: `0x${string}`;
  spender: `0x${string}`;
  usdcAddress: `0x${string}`;
  amount: bigint;
}): Promise<void> {
  const allowance = await readUsdcAllowance({
    publicClient,
    ownerAddress,
    spender,
    usdcAddress
  });

  if (allowance >= amount) {
    return;
  }

  const approvalHash = await walletClient.writeContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount]
  });

  await publicClient.waitForTransactionReceipt({ hash: approvalHash });
}
