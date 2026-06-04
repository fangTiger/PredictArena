import { expect } from 'chai';
import hre from 'hardhat';
import solc from 'solc';

const { ethers } = hre;

const BOND_MICRO_USDC = 250_000_000n;
const DEADLINE_OFFSET_SEC = 86_400n;
const STATE_AWARE_USDC_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IShowdownArenaObserver {
    function showdownCount() external view returns (uint256);
    function lookupByExternalId(bytes32 externalId) external view returns (uint256);
}

contract StateAwareUSDC {
    struct ShowdownPayload {
        uint256 id;
        bytes32 externalId;
        string marketId;
        string marketQuestion;
        address agentA;
        string agentNameA;
        bool sideAYes;
        uint16 agentAProbabilityBps;
        address agentB;
        string agentNameB;
        uint16 agentBProbabilityBps;
        uint256 bondPerSideMicroUsdc;
        uint64 deadline;
        uint64 openedAt;
        uint64 settledAt;
        uint8 status;
    }

    string public constant name = "State Aware USDC";
    string public constant symbol = "sUSDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;

    address public expectedArena;
    bytes32 public expectedExternalId;
    uint256 public expectedShowdownId;
    uint256 public expectedBond;
    address public expectedAgentA;
    address public expectedAgentB;
    string public expectedMarketId;
    string public expectedMarketQuestion;
    string public expectedAgentNameA;
    string public expectedAgentNameB;
    bool public expectedSideAYes;
    uint16 public expectedAgentAProbabilityBps;
    uint16 public expectedAgentBProbabilityBps;
    uint64 public expectedDeadline;
    uint64 public expectedOpenedAt;
    uint8 public expectedStatus;
    address public expectedWinner;
    uint256 public expectedPayout;
    bool public enforceOpenState;
    bool public enforceSettlementState;
    bool public failPayoutTransfer;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function setPrimedStateExpectation(
        address arena,
        bytes32 externalId,
        uint256 showdownId,
        uint256 bond,
        address agentA,
        address agentB,
        string calldata marketId,
        string calldata marketQuestion,
        string calldata agentNameA,
        bool sideAYes,
        uint16 agentAProbabilityBps,
        string calldata agentNameB,
        uint16 agentBProbabilityBps,
        uint64 deadline
    ) external {
        expectedArena = arena;
        expectedExternalId = externalId;
        expectedShowdownId = showdownId;
        expectedBond = bond;
        expectedAgentA = agentA;
        expectedAgentB = agentB;
        expectedMarketId = marketId;
        expectedMarketQuestion = marketQuestion;
        expectedAgentNameA = agentNameA;
        expectedAgentNameB = agentNameB;
        expectedSideAYes = sideAYes;
        expectedAgentAProbabilityBps = agentAProbabilityBps;
        expectedAgentBProbabilityBps = agentBProbabilityBps;
        expectedDeadline = deadline;
        expectedOpenedAt = 0;
        expectedStatus = 1;
        expectedWinner = address(0);
        expectedPayout = 0;
        enforceOpenState = true;
        enforceSettlementState = false;
        failPayoutTransfer = false;
    }

    function setSettlementStateExpectation(
        address arena,
        uint256 showdownId,
        uint64 openedAt,
        uint8 status,
        address winner,
        uint256 payout,
        bool failTransferAfterCheck
    ) external {
        expectedArena = arena;
        expectedShowdownId = showdownId;
        expectedOpenedAt = openedAt;
        expectedStatus = status;
        expectedWinner = winner;
        expectedPayout = payout;
        enforceOpenState = false;
        enforceSettlementState = true;
        failPayoutTransfer = failTransferAfterCheck;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (enforceSettlementState) {
            require(msg.sender == expectedArena, "unexpected payout caller");
            require(to == expectedWinner, "unexpected winner");
            require(amount == expectedPayout, "unexpected payout");

            (bool ok, bytes memory returndata) = expectedArena.staticcall(
                abi.encodeWithSignature("getShowdown(uint256)", expectedShowdownId)
            );
            require(ok, "settlement view failed");

            ShowdownPayload memory actualShowdown = abi.decode(returndata, (ShowdownPayload));
            require(actualShowdown.id == expectedShowdownId, "settlement id not primed");
            require(actualShowdown.bondPerSideMicroUsdc * 2 == expectedPayout, "settlement payout mismatch");
            require(actualShowdown.openedAt == expectedOpenedAt, "openedAt changed unexpectedly");
            require(actualShowdown.settledAt == uint64(block.timestamp), "settledAt not primed");
            require(actualShowdown.status == expectedStatus, "status not primed");

            if (failPayoutTransfer) {
                return false;
            }
        }

        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (enforceOpenState) {
            require(to == expectedArena, "unexpected arena");
            require(amount == expectedBond, "unexpected bond");
            require(from == expectedAgentA || from == expectedAgentB, "unexpected agent");
            require(
                IShowdownArenaObserver(expectedArena).showdownCount() == expectedShowdownId,
                "count not primed"
            );
            require(
                IShowdownArenaObserver(expectedArena).lookupByExternalId(expectedExternalId) == expectedShowdownId,
                "mapping not primed"
            );

            (bool ok, bytes memory returndata) = expectedArena.staticcall(
                abi.encodeWithSignature("getShowdown(uint256)", expectedShowdownId)
            );
            require(ok, "showdown view failed");

            ShowdownPayload memory expectedShowdown = ShowdownPayload({
                id: expectedShowdownId,
                externalId: expectedExternalId,
                marketId: expectedMarketId,
                marketQuestion: expectedMarketQuestion,
                agentA: expectedAgentA,
                agentNameA: expectedAgentNameA,
                sideAYes: expectedSideAYes,
                agentAProbabilityBps: expectedAgentAProbabilityBps,
                agentB: expectedAgentB,
                agentNameB: expectedAgentNameB,
                agentBProbabilityBps: expectedAgentBProbabilityBps,
                bondPerSideMicroUsdc: expectedBond,
                deadline: expectedDeadline,
                openedAt: uint64(block.timestamp),
                settledAt: 0,
                status: 1
            });
            bytes memory expectedReturn = abi.encode(expectedShowdown);
            require(keccak256(returndata) == keccak256(expectedReturn), "showdown payload not primed");
        }

        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "allowance exceeded");
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "balance too low");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
`;

type CompiledContractArtifact = {
  abi: any[];
  bytecode: `0x${string}`;
};

let stateAwareUsdcArtifact: CompiledContractArtifact | null = null;

function getStateAwareUsdcArtifact(): CompiledContractArtifact {
  if (stateAwareUsdcArtifact) {
    return stateAwareUsdcArtifact;
  }

  const input = {
    language: 'Solidity',
    sources: {
      'StateAwareUSDC.sol': {
        content: STATE_AWARE_USDC_SOURCE
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true,
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
    contracts?: Record<
      string,
      Record<string, { abi: any[]; evm: { bytecode: { object: string } } }>
    >;
    errors?: Array<{ severity: string; formattedMessage: string }>;
  };

  const errors = output.errors?.filter((error) => error.severity === 'error') ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.formattedMessage).join('\n'));
  }

  const contract = output.contracts?.['StateAwareUSDC.sol']?.StateAwareUSDC;
  if (!contract?.evm.bytecode.object) {
    throw new Error('StateAwareUSDC compilation missing bytecode');
  }

  stateAwareUsdcArtifact = {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}` as `0x${string}`
  };

  return stateAwareUsdcArtifact;
}

describe('ShowdownArena', () => {
  function buildOpenArgs(opts: {
    externalId: string;
    marketId?: string;
    marketQuestion?: string;
    agentA: string;
    agentNameA?: string;
    sideAYes?: boolean;
    agentAProbabilityBps?: number;
    agentB: string;
    agentNameB?: string;
    agentBProbabilityBps?: number;
    bondPerSideMicroUsdc?: bigint;
    deadline: bigint;
  }) {
    return [
      ethers.id(opts.externalId),
      opts.marketId ?? 'market-btc-100k-eoy',
      opts.marketQuestion ?? 'BTC > 100k by EOY',
      opts.agentA,
      opts.agentNameA ?? 'volatility',
      opts.sideAYes ?? true,
      opts.agentAProbabilityBps ?? 6200,
      opts.agentB,
      opts.agentNameB ?? 'momentum',
      opts.agentBProbabilityBps ?? 3100,
      opts.bondPerSideMicroUsdc ?? BOND_MICRO_USDC,
      opts.deadline
    ] as const;
  }

  async function deployFixture() {
    const [owner, agentA, agentB, treasury, outsider] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const ShowdownArena = await ethers.getContractFactory('ShowdownArena');
    const arena = await ShowdownArena.deploy(await usdc.getAddress(), treasury.address);
    await arena.waitForDeployment();

    await usdc.mint(agentA.address, BOND_MICRO_USDC * 10n);
    await usdc.mint(agentB.address, BOND_MICRO_USDC * 10n);
    await usdc.connect(agentA).approve(await arena.getAddress(), BOND_MICRO_USDC * 10n);
    await usdc.connect(agentB).approve(await arena.getAddress(), BOND_MICRO_USDC * 10n);

    const latestBlock = await ethers.provider.getBlock('latest');
    const deadline = BigInt(latestBlock!.timestamp) + DEADLINE_OFFSET_SEC;

    return { owner, agentA, agentB, treasury, outsider, usdc, arena, deadline };
  }

  async function deployStateAwareFixture() {
    const [owner, agentA, agentB, treasury, outsider] = await ethers.getSigners();
    const artifact = getStateAwareUsdcArtifact();
    const StateAwareUSDC = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
    const usdc = await StateAwareUSDC.deploy();
    await usdc.waitForDeployment();

    const ShowdownArena = await ethers.getContractFactory('ShowdownArena');
    const arena = await ShowdownArena.deploy(await usdc.getAddress(), treasury.address);
    await arena.waitForDeployment();

    await usdc.mint(agentA.address, BOND_MICRO_USDC * 10n);
    await usdc.mint(agentB.address, BOND_MICRO_USDC * 10n);
    await usdc.connect(agentA).approve(await arena.getAddress(), BOND_MICRO_USDC * 10n);
    await usdc.connect(agentB).approve(await arena.getAddress(), BOND_MICRO_USDC * 10n);

    const latestBlock = await ethers.provider.getBlock('latest');
    const deadline = BigInt(latestBlock!.timestamp) + DEADLINE_OFFSET_SEC;

    return { owner, agentA, agentB, treasury, outsider, usdc, arena, deadline };
  }

  async function primeSettlementExpectation({
    usdc,
    arena,
    showdownId,
    showdown,
    winner,
    status,
    payout,
    failTransferAfterCheck
  }: {
    usdc: any;
    arena: any;
    showdownId: bigint;
    showdown: {
      externalId: string;
      marketId: string;
      marketQuestion: string;
      agentA: string;
      agentNameA: string;
      sideAYes: boolean;
      agentAProbabilityBps: bigint;
      agentB: string;
      agentNameB: string;
      agentBProbabilityBps: bigint;
      bondPerSideMicroUsdc: bigint;
      deadline: bigint;
      openedAt: bigint;
    };
    winner: string;
    status: number;
    payout: bigint;
    failTransferAfterCheck: boolean;
  }) {
    await usdc.setSettlementStateExpectation(
      await arena.getAddress(),
      showdownId,
      showdown.openedAt,
      status,
      winner,
      payout,
      failTransferAfterCheck
    );
  }

  it('deploys with owner = deployer and treasury set', async () => {
    const { owner, treasury, arena } = await deployFixture();

    expect(await arena.owner()).to.equal(owner.address);
    expect(await arena.treasury()).to.equal(treasury.address);
  });

  describe('openShowdown', () => {
    it('opens a showdown, pulls bond from both agents, emits event, and exposes view lookups', async () => {
      const { agentA, agentB, usdc, arena, deadline } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-1',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });

      await expect(arena.openShowdown(...args))
        .to.emit(arena, 'ShowdownOpened')
        .withArgs(
          1n,
          ethers.id('sd-1'),
          'market-btc-100k-eoy',
          agentA.address,
          true,
          agentB.address,
          BOND_MICRO_USDC,
          deadline
        );

      expect(await arena.showdownCount()).to.equal(1n);
      expect(await usdc.balanceOf(await arena.getAddress())).to.equal(BOND_MICRO_USDC * 2n);
      expect(await arena.lookupByExternalId(ethers.id('sd-1'))).to.equal(1n);

      const showdown = await arena.getShowdown(1n);
      expect(showdown.id).to.equal(1n);
      expect(showdown.externalId).to.equal(ethers.id('sd-1'));
      expect(showdown.marketId).to.equal('market-btc-100k-eoy');
      expect(showdown.marketQuestion).to.equal('BTC > 100k by EOY');
      expect(showdown.agentA).to.equal(agentA.address);
      expect(showdown.agentNameA).to.equal('volatility');
      expect(showdown.sideAYes).to.equal(true);
      expect(showdown.agentAProbabilityBps).to.equal(6200n);
      expect(showdown.agentB).to.equal(agentB.address);
      expect(showdown.agentNameB).to.equal('momentum');
      expect(showdown.agentBProbabilityBps).to.equal(3100n);
      expect(showdown.bondPerSideMicroUsdc).to.equal(BOND_MICRO_USDC);
      expect(showdown.deadline).to.equal(deadline);
      expect(showdown.openedAt).to.be.greaterThan(0n);
      expect(showdown.settledAt).to.equal(0n);
      expect(showdown.status).to.equal(1n);
    });

    it('reverts when called by non-owner', async () => {
      const { agentA, agentB, arena, deadline, outsider } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-owner',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });

      await expect(arena.connect(outsider).openShowdown(...args)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('primes showdown storage before calling transferFrom on the token', async () => {
      const { agentA, agentB, usdc, arena, deadline } = await deployStateAwareFixture();
      const externalId = ethers.id('sd-cei-order');
      const args = buildOpenArgs({
        externalId: 'sd-cei-order',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });

      await usdc.setPrimedStateExpectation(
        await arena.getAddress(),
        externalId,
        1n,
        BOND_MICRO_USDC,
        agentA.address,
        agentB.address,
        'market-btc-100k-eoy',
        'BTC > 100k by EOY',
        'volatility',
        true,
        6200,
        'momentum',
        3100,
        deadline
      );

      await expect(arena.openShowdown(...args))
        .to.emit(arena, 'ShowdownOpened')
        .withArgs(
          1n,
          externalId,
          'market-btc-100k-eoy',
          agentA.address,
          true,
          agentB.address,
          BOND_MICRO_USDC,
          deadline
        );
    });

    it('reverts when externalId is reused', async () => {
      const { agentA, agentB, arena, deadline } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-dupe',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });

      await arena.openShowdown(...args);
      await expect(arena.openShowdown(...args)).to.be.revertedWith('external id reused');
    });

    it('reverts when agents are identical', async () => {
      const { agentA, arena, deadline } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-same-agent',
        agentA: agentA.address,
        agentB: agentA.address,
        deadline
      });

      await expect(arena.openShowdown(...args)).to.be.revertedWith('agents must differ');
    });

    it('reverts when either agent is the zero address', async () => {
      const { agentB, arena, deadline } = await deployFixture();
      const zeroAgentAArgs = buildOpenArgs({
        externalId: 'sd-zero-a',
        agentA: ethers.ZeroAddress,
        agentB: agentB.address,
        deadline
      });
      const zeroAgentBArgs = buildOpenArgs({
        externalId: 'sd-zero-b',
        agentA: agentB.address,
        agentB: ethers.ZeroAddress,
        deadline
      });

      await expect(arena.openShowdown(...zeroAgentAArgs)).to.be.revertedWith('zero agent');
      await expect(arena.openShowdown(...zeroAgentBArgs)).to.be.revertedWith('zero agent');
    });

    it('reverts when bond is zero', async () => {
      const { agentA, agentB, arena, deadline } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-zero-bond',
        agentA: agentA.address,
        agentB: agentB.address,
        bondPerSideMicroUsdc: 0n,
        deadline
      });

      await expect(arena.openShowdown(...args)).to.be.revertedWith('bond required');
    });

    it('reverts when deadline is in the past', async () => {
      const { agentA, agentB, arena } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-past-deadline',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline: 1n
      });

      await expect(arena.openShowdown(...args)).to.be.revertedWith('deadline in past');
    });

    it('reverts atomically when agent A transferFrom fails', async () => {
      const { agentA, agentB, usdc, arena, deadline } = await deployFixture();
      const arenaAddress = await arena.getAddress();
      const agentABalance = await usdc.balanceOf(agentA.address);
      const agentBBalance = await usdc.balanceOf(agentB.address);
      const args = buildOpenArgs({
        externalId: 'sd-transfer-a',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });

      await usdc.connect(agentA).approve(arenaAddress, 0n);

      await expect(arena.openShowdown(...args)).to.be.reverted;
      expect(await arena.showdownCount()).to.equal(0n);
      expect(await arena.lookupByExternalId(ethers.id('sd-transfer-a'))).to.equal(0n);
      expect(await usdc.balanceOf(arenaAddress)).to.equal(0n);
      expect(await usdc.balanceOf(agentA.address)).to.equal(agentABalance);
      expect(await usdc.balanceOf(agentB.address)).to.equal(agentBBalance);
    });

    it('reverts atomically when agent B transferFrom fails after agent A succeeds', async () => {
      const { agentA, agentB, usdc, arena, deadline } = await deployFixture();
      const arenaAddress = await arena.getAddress();
      const agentABalance = await usdc.balanceOf(agentA.address);
      const agentBBalance = await usdc.balanceOf(agentB.address);
      const args = buildOpenArgs({
        externalId: 'sd-transfer-b',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });

      await usdc.connect(agentB).approve(arenaAddress, 0n);

      await expect(arena.openShowdown(...args)).to.be.reverted;
      expect(await arena.showdownCount()).to.equal(0n);
      expect(await arena.lookupByExternalId(ethers.id('sd-transfer-b'))).to.equal(0n);
      expect(await arena.getShowdown(1n)).to.deep.equal([
        0n,
        ethers.ZeroHash,
        '',
        '',
        ethers.ZeroAddress,
        '',
        false,
        0n,
        ethers.ZeroAddress,
        '',
        0n,
        0n,
        0n,
        0n,
        0n,
        0n
      ]);
      expect(await usdc.balanceOf(arenaAddress)).to.equal(0n);
      expect(await usdc.balanceOf(agentA.address)).to.equal(agentABalance);
      expect(await usdc.balanceOf(agentB.address)).to.equal(agentBBalance);
    });

    it('returns zero for unknown externalId lookups', async () => {
      const { arena } = await deployFixture();
      expect(await arena.lookupByExternalId(ethers.id('sd-missing'))).to.equal(0n);
    });
  });

  describe('settleShowdown', () => {
    it('settles to agent A, pays 2x bond, zeros contract balance, and records SettledA', async () => {
      const { agentA, agentB, usdc, arena, deadline } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-settle-a',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });
      await arena.openShowdown(...args);

      const balanceBefore = await usdc.balanceOf(agentA.address);

      await expect(arena.settleShowdown(1n, true))
        .to.emit(arena, 'ShowdownSettled')
        .withArgs(1n, 2n, agentA.address, BOND_MICRO_USDC * 2n);

      expect(await usdc.balanceOf(agentA.address)).to.equal(balanceBefore + BOND_MICRO_USDC * 2n);
      expect(await usdc.balanceOf(await arena.getAddress())).to.equal(0n);

      const showdown = await arena.getShowdown(1n);
      expect(showdown.status).to.equal(2n);
      expect(showdown.settledAt).to.be.greaterThan(0n);
    });

    it('settles to agent B, pays 2x bond, and records SettledB', async () => {
      const { agentA, agentB, usdc, arena, deadline } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-settle-b',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });
      await arena.openShowdown(...args);

      const balanceBefore = await usdc.balanceOf(agentB.address);

      await expect(arena.settleShowdown(1n, false))
        .to.emit(arena, 'ShowdownSettled')
        .withArgs(1n, 3n, agentB.address, BOND_MICRO_USDC * 2n);

      expect(await usdc.balanceOf(agentB.address)).to.equal(balanceBefore + BOND_MICRO_USDC * 2n);

      const showdown = await arena.getShowdown(1n);
      expect(showdown.status).to.equal(3n);
      expect(showdown.settledAt).to.be.greaterThan(0n);
    });

    it('primes settled status and settledAt before calling payout transfer', async () => {
      const { agentA, agentB, usdc, arena, deadline } = await deployStateAwareFixture();
      const args = buildOpenArgs({
        externalId: 'sd-settle-cei',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });
      await arena.openShowdown(...args);

      const showdownBeforeSettle = await arena.getShowdown(1n);
      await primeSettlementExpectation({
        usdc,
        arena,
        showdownId: 1n,
        showdown: showdownBeforeSettle,
        winner: agentA.address,
        status: 2,
        payout: BOND_MICRO_USDC * 2n,
        failTransferAfterCheck: false
      });

      await expect(arena.settleShowdown(1n, true))
        .to.emit(arena, 'ShowdownSettled')
        .withArgs(1n, 2n, agentA.address, BOND_MICRO_USDC * 2n);
    });

    it('reverts atomically when payout transfer fails after settlement state is primed', async () => {
      const { agentA, agentB, usdc, arena, deadline } = await deployStateAwareFixture();
      const args = buildOpenArgs({
        externalId: 'sd-settle-payout-fail',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });
      await arena.openShowdown(...args);

      const showdownBeforeSettle = await arena.getShowdown(1n);
      const arenaAddress = await arena.getAddress();
      const balanceBeforeArena = await usdc.balanceOf(arenaAddress);
      const balanceBeforeA = await usdc.balanceOf(agentA.address);
      const balanceBeforeB = await usdc.balanceOf(agentB.address);

      await primeSettlementExpectation({
        usdc,
        arena,
        showdownId: 1n,
        showdown: showdownBeforeSettle,
        winner: agentA.address,
        status: 2,
        payout: BOND_MICRO_USDC * 2n,
        failTransferAfterCheck: true
      });

      await expect(arena.settleShowdown(1n, true)).to.be.revertedWith('payout failed');

      const showdownAfterFailure = await arena.getShowdown(1n);
      expect(showdownAfterFailure.status).to.equal(1n);
      expect(showdownAfterFailure.settledAt).to.equal(0n);
      expect(await usdc.balanceOf(arenaAddress)).to.equal(balanceBeforeArena);
      expect(await usdc.balanceOf(agentA.address)).to.equal(balanceBeforeA);
      expect(await usdc.balanceOf(agentB.address)).to.equal(balanceBeforeB);
    });

    it('reverts when called by non-owner', async () => {
      const { agentA, agentB, arena, deadline, outsider } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-settle-owner',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });
      await arena.openShowdown(...args);

      await expect(arena.connect(outsider).settleShowdown(1n, true)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('reverts when showdown is already settled', async () => {
      const { agentA, agentB, arena, deadline } = await deployFixture();
      const args = buildOpenArgs({
        externalId: 'sd-settle-twice',
        agentA: agentA.address,
        agentB: agentB.address,
        deadline
      });
      await arena.openShowdown(...args);
      await arena.settleShowdown(1n, true);

      await expect(arena.settleShowdown(1n, false)).to.be.revertedWith('not open');
    });

    it('reverts when showdown does not exist', async () => {
      const { arena } = await deployFixture();
      await expect(arena.settleShowdown(999n, true)).to.be.revertedWith('not open');
    });
  });
});
