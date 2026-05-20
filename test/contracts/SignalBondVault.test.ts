import { time } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs.js';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers } = hre;

describe('SignalBondVault', () => {
  async function deployFixture() {
    const [owner, trader] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const SignalBondVault = await ethers.getContractFactory('SignalBondVault');
    const vault = await SignalBondVault.deploy(await usdc.getAddress(), 3600);
    await vault.waitForDeployment();

    await usdc.mint(trader.address, 100_000_000n);
    await usdc.connect(trader).approve(await vault.getAddress(), 100_000_000n);

    return { owner, trader, usdc, vault };
  }

  it('accepts a USDC signal bond and emits a commitment event', async () => {
    const { trader, usdc, vault } = await deployFixture();

    await expect(
      vault
        .connect(trader)
        .commitSignal('signal-1', 'market-1', true, 8200, 25_000_000, ethers.id('signal-1'))
    )
      .to.emit(vault, 'SignalCommitted')
      .withArgs(1n, 'signal-1', 'market-1', trader.address, true, 8200, 25_000_000, anyValue);

    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(25_000_000n);
  });

  it('rejects zero-size bonds', async () => {
    const { trader, vault } = await deployFixture();

    await expect(
      vault.connect(trader).commitSignal('signal-2', 'market-2', false, 4100, 0, ethers.id('signal-2'))
    ).to.be.revertedWith('bond required');
  });

  it('rejects duplicate commitments for the same signal without charging a second bond', async () => {
    const { trader, usdc, vault } = await deployFixture();

    await vault
      .connect(trader)
      .commitSignal('signal-dup', 'market-dup', true, 8200, 25_000_000, ethers.id('signal-dup'));

    await expect(
      vault
        .connect(trader)
        .commitSignal('signal-dup', 'market-dup', true, 8200, 25_000_000, ethers.id('signal-dup'))
    ).to.be.revertedWith('signal already committed');

    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(25_000_000n);
    expect(await usdc.balanceOf(trader.address)).to.equal(75_000_000n);
  });

  it('allows the original committer to refund after the refund window', async () => {
    const { trader, usdc, vault } = await deployFixture();

    await vault
      .connect(trader)
      .commitSignal('signal-3', 'market-3', true, 7900, 10_000_000, ethers.id('signal-3'));

    await time.increase(3601);

    await expect(vault.connect(trader).refund(1)).to.emit(vault, 'SignalRefunded').withArgs(1n, trader.address);
    expect(await usdc.balanceOf(trader.address)).to.equal(100_000_000n);
  });
});
