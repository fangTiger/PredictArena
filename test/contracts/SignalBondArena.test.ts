import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs.js';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers } = hre;

describe('SignalBondArena', () => {
  async function deployFixture() {
    const [owner, volatilityAgent, treasury, outsider] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const SignalBondArena = await ethers.getContractFactory('SignalBondArena');
    const arena = await SignalBondArena.deploy(await usdc.getAddress(), treasury.address);
    await arena.waitForDeployment();

    await usdc.mint(volatilityAgent.address, 100_000_000n);
    await usdc.connect(volatilityAgent).approve(await arena.getAddress(), 100_000_000n);

    return { owner, volatilityAgent, treasury, outsider, usdc, arena };
  }

  it('transfers USDC on commit, stores signal fields, and exposes getters', async () => {
    const { volatilityAgent, usdc, arena } = await deployFixture();

    await expect(
      arena
        .connect(volatilityAgent)
        .commitSignal(
          'signal-1',
          'market-1',
          'volatility',
          true,
          5400,
          7600,
          7600,
          2200,
          50_000,
          ethers.id('model-1'),
          ethers.id('data-1')
        )
    )
      .to.emit(arena, 'SignalCommitted')
      .withArgs(
        1n,
        'signal-1',
        'market-1',
        volatilityAgent.address,
        'volatility',
        true,
        5400,
        7600,
        7600,
        2200,
        50_000,
        anyValue,
        anyValue
      );

    expect(await usdc.balanceOf(await arena.getAddress())).to.equal(50_000n);
    expect(await arena.signalCount()).to.equal(1n);

    const stored = await arena.signals(1);
    expect(stored.externalSignalId).to.equal('signal-1');
    expect(stored.agent).to.equal(volatilityAgent.address);
    expect(stored.agentName).to.equal('volatility');
    expect(stored.sideYes).to.equal(true);
    expect(stored.stakeMicroUsdc).to.equal(50_000n);
  });

  it('refunds correct signals to the agent and slashes incorrect signals to treasury', async () => {
    const { owner, volatilityAgent, treasury, usdc, arena } = await deployFixture();

    await arena
      .connect(volatilityAgent)
      .commitSignal(
        'signal-correct',
        'market-correct',
        'volatility',
        true,
        5400,
        7600,
        7600,
        2200,
        25_000,
        ethers.id('model-correct'),
        ethers.id('data-correct')
      );
    await arena
      .connect(volatilityAgent)
      .commitSignal(
        'signal-wrong',
        'market-wrong',
        'volatility',
        false,
        4600,
        7800,
        7800,
        3200,
        25_000,
        ethers.id('model-wrong'),
        ethers.id('data-wrong')
      );

    await expect(arena.connect(owner).resolveSignal(1, true))
      .to.emit(arena, 'SignalResolved')
      .withArgs(1n, true, volatilityAgent.address, 25_000n);
    await expect(arena.connect(owner).resolveSignal(2, false))
      .to.emit(arena, 'SignalResolved')
      .withArgs(2n, false, treasury.address, 25_000n);

    expect(await usdc.balanceOf(volatilityAgent.address)).to.equal(99_975_000n);
    expect(await usdc.balanceOf(treasury.address)).to.equal(25_000n);

    const resolvedCorrect = await arena.signals(1);
    const resolvedWrong = await arena.signals(2);
    expect(resolvedCorrect.resolved).to.equal(true);
    expect(resolvedCorrect.outcomeCorrect).to.equal(true);
    expect(resolvedWrong.resolved).to.equal(true);
    expect(resolvedWrong.outcomeCorrect).to.equal(false);
  });

  it('rejects non-owner resolution', async () => {
    const { volatilityAgent, outsider, arena } = await deployFixture();

    await arena
      .connect(volatilityAgent)
      .commitSignal(
        'signal-3',
        'market-3',
        'volatility',
        true,
        5400,
        7600,
        7600,
        2200,
        25_000,
        ethers.id('model-3'),
        ethers.id('data-3')
      );

    await expect(arena.connect(outsider).resolveSignal(1, true)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });
});
