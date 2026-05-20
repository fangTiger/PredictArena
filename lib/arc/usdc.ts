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
  }
] as const;

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
  const allowance = (await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [ownerAddress, spender]
  })) as bigint;

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
